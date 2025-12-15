// src/app/api/competitors/suggest/route.js
import { NextResponse } from "next/server";
import { getDomain } from "tldts";

export const runtime = "nodejs";

/**
 * In-memory cache (per Node process)
 */
const g = globalThis;
if (!g.__competitorSuggestCache) {
  g.__competitorSuggestCache = {
    suggest: new Map(), // key -> { expiresAt, value }
    inflight: new Map(), // key -> Promise
  };
}
const CCACHE = g.__competitorSuggestCache;

function cacheGet(map, key) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    map.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(map, key, value, ttlMs) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function normalizeHost(input) {
  if (!input || typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  try {
    if (!/^https?:\/\//.test(s)) s = `https://${s}`;
    const u = new URL(s);
    s = u.hostname || s;
  } catch {
    s = s.replace(/^https?:\/\//, "").split("/")[0];
  }
  return s.replace(/^www\./, "");
}

// fallback-only, used if tldts fails
function naiveRoot(host) {
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");
  const twoPartCctlds = new Set(["co.in", "org.in", "net.in", "ac.in", "co.uk", "org.uk"]);
  if (twoPartCctlds.has(last2) && parts.length >= 3) return last3;
  return last2;
}

/**
 * Real eTLD+1
 * - about.google -> about.google   (not a domain; then we still exclude via self check)
 * - accounts.google.com -> google.com
 * - sell.amazon.com -> amazon.com
 */
function getRootHost(hostOrUrl) {
  const host = normalizeHost(hostOrUrl);
  if (!host) return "";
  const d = getDomain(host);
  return d || naiveRoot(host);
}

function inferLocationAndLanguage(host) {
  const h = String(host || "").toLowerCase();
  const isIndia =
    h.endsWith(".in") ||
    h.endsWith(".co.in") ||
    h.endsWith(".org.in") ||
    h.endsWith(".net.in");
  return isIndia
    ? { location_name: "India", language_code: "en" }
    : { location_name: "United States", language_code: "en" };
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function safeStr(x) {
  return String(x || "").trim();
}

function tokenise(s) {
  return safeStr(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function extractDomainFromUrl(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Always collapse candidates to root host:
 *  - sell.amazon.com -> amazon.com
 *  - accounts.google.com -> google.com
 */
function normalizeCandidateDomain(d) {
  const host = normalizeHost(d);
  if (!host) return "";
  return getRootHost(host);
}

/**
 * Hard exclude same property:
 * - candidateRoot === rootHost
 * - candidateHost endswith .rootHost
 * - also exclude same brand-ish "about.google" when scanning google.com
 */
function isSelfDomain(candidateHost, rootHost) {
  const cHost = normalizeHost(candidateHost);
  const rHost = normalizeHost(rootHost);
  if (!cHost || !rHost) return false;

  const cRoot = getRootHost(cHost);
  const rRoot = getRootHost(rHost);

  // classic cases: accounts.google.com, support.google.com, etc.
  if (cHost === rHost || cHost.endsWith(`.${rHost}`)) return true;

  // root match: google.com
  if (cRoot && rRoot && cRoot === rRoot) return true;

  // brand-ish cases like about.google when root is google.com
  // (tldts returns about.google as its "domain" sometimes; still block by brand token)
  const brand = rRoot.split(".")[0];
  if (brand && (cHost === `about.${brand}` || cRoot === `about.${brand}`)) return true;

  return false;
}

/**
 * Noise filters
 */
const BLOCK_DOMAINS = new Set([
  "wikipedia.org",
  "reddit.com",
  "quora.com",
  "medium.com",
  "pinterest.com",
  "github.com",
  "stackoverflow.com",
  "play.google.com",
  "apps.apple.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
]);

function isBlockedDomain(domain) {
  if (!domain) return true;
  const d = domain.toLowerCase();
  if (BLOCK_DOMAINS.has(d)) return true;
  return false;
}

/**
 * Call internal routes using request origin (no NEXT_PUBLIC_APP_URL headaches)
 */
async function postJson(origin, path, body) {
  const res = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/**
 * --------------- SERP ---------------
 * DataForSEO SERP (primary)
 */
async function dataForSeoSerpDomains({
  keyword,
  login,
  password,
  location_name,
  language_code,
  depth = 10,
}) {
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  const payload = [{ keyword, location_name, language_code, depth, device: "desktop" }];

  const res = await fetch(
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("DataForSEO SERP error:", res.status, json);
    throw new Error(`DataForSEO SERP failed (${res.status})`);
  }

  const items =
    json?.tasks?.[0]?.result?.[0]?.items &&
    Array.isArray(json.tasks[0].result[0].items)
      ? json.tasks[0].result[0].items
      : [];

  const urls = items.map((it) => it?.url).filter(Boolean);
  return urls.map(extractDomainFromUrl).filter(Boolean);
}

/**
 * Serper fallback
 */
async function serperSerpDomains({ keyword, serperKey }) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: keyword, gl: "us", hl: "en" }),
  });

  if (!res.ok) throw new Error(`Serper failed (${res.status})`);
  const data = await res.json().catch(() => null);

  const organic = Array.isArray(data?.organic) ? data.organic : [];
  const urls = organic.map((r) => r?.link).filter(Boolean);
  return urls.map(extractDomainFromUrl).filter(Boolean);
}

async function serpDomains({
  keyword,
  dfsLogin,
  dfsPass,
  serperKey,
  location_name,
  language_code,
}) {
  try {
    if (dfsLogin && dfsPass) {
      return await dataForSeoSerpDomains({
        keyword,
        login: dfsLogin,
        password: dfsPass,
        location_name,
        language_code,
        depth: 10,
      });
    }
  } catch {
    // fall through
  }
  if (serperKey) return await serperSerpDomains({ keyword, serperKey });
  return [];
}

/**
 * --------------- LIGHT CRAWL INTENT FILTER ---------------
 * Fetch candidate homepage quickly and classify its primary role:
 * - search_engine
 * - ai_answer_engine
 * - ecommerce
 * - payments
 * - dictionary
 * - music
 * - maps
 * - social
 * - other
 */
async function fetchWithTimeout(url, ms = 6500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "DrFizzSEO/1.0 (+competitor-profiler)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctl.signal,
    });
    if (!res.ok) return "";
    const txt = await res.text();
    return txt || "";
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleAndDesc(html) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "";
  const desc =
    /<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i.exec(
      html
    )?.[1] || "";
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || "";
  return stripTags(`${title} ${desc} ${h1}`);
}

function classifyRole(text) {
  const t = (text || "").toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));

  // search engines
  if (
    has("search the web", "web search", "search engine", "search results", "private search") ||
    has("duckduckgo", "brave search", "bing search", "yandex", "ecosia")
  ) return "search_engine";

  // answer engines / ai search
  if (
    has("answer engine", "ai answers", "ask anything", "powered by ai", "search and answer") ||
    has("perplexity", "you.com", "and you can ask", "ai search")
  ) return "ai_answer_engine";

  if (has("add to cart", "checkout", "shop", "store", "buy now", "shipping")) return "ecommerce";
  if (has("payments", "accept payments", "pos", "invoices", "merchant")) return "payments";
  if (has("dictionary", "definition", "thesaurus")) return "dictionary";
  if (has("listen", "music", "playlist", "podcasts")) return "music";
  if (has("maps", "directions", "route planner", "navigation")) return "maps";

  // disqualify portals
  if (has("sign in", "log in", "create account") && has("support", "help center")) return "support_portal";

  if (has("social network", "friends", "followers", "posts")) return "social";

  return "other";
}

/**
 * Decide main intent of the scanned site
 */
function detectPrimaryIntent(profile) {
  const blob = [
    profile?.signals?.title,
    profile?.signals?.description,
    ...(profile?.signals?.h1s || []),
    ...(profile?.seeds || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    blob.includes("search engine") ||
    blob.includes("search the web") ||
    (blob.includes("search") && blob.includes("results"))
  ) {
    return "search_engine";
  }
  return "other";
}

/**
 * Platform queries for search engines:
 * These force SERPs to bring up Bing/DDG/etc instead of random generic sites.
 */
function buildPlatformQueriesForSearchEngine(rootHost) {
  const brand = (getRootHost(rootHost) || "").split(".")[0] || "google";

  return uniq([
    "search engine",
    "web search engine",
    "private search engine",
    "search engine alternative",
    "best search engines",
    "ai search engine",
    "answer engine",
    `${brand} alternatives`,
    `${brand} vs bing`,
    `${brand} vs duckduckgo`,
    "search engine like google",
  ]).slice(0, 10);
}

/**
 * Generic platform queries (non-search-engine sites)
 */
function buildPlatformQueriesGeneric(seeds, siteType) {
  const s = uniq(seeds || [])
    .map((x) => safeStr(x))
    .filter(Boolean)
    .filter((x) => tokenise(x).length >= 2)
    .slice(0, 10);

  const head =
    siteType === "SaaS"
      ? "software"
      : siteType === "Ecommerce"
      ? "store"
      : siteType === "Publisher"
      ? "blog"
      : "services";

  return uniq([
    s[0] ? `${s[0]} ${head}` : "",
    s[1] ? `${s[1]} ${head}` : "",
    s[2] ? `${s[2]} ${head}` : "",
    s[0] ? `${s[0]} tools` : "",
    s[1] ? `${s[1]} alternatives` : "",
  ])
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Search probes (SEO overlap)
 */
function buildSearchProbes(primaryIntent, keywordChips, seeds, rootHost) {
  if (primaryIntent === "search_engine") {
    // IMPORTANT: don't use keyword chips for google.com; they'll be noisy
    return buildPlatformQueriesForSearchEngine(rootHost).slice(0, 8);
  }

  const chips = uniq(keywordChips || [])
    .map((k) => safeStr(k))
    .filter(Boolean)
    .filter((k) => tokenise(k).length >= 2)
    .slice(0, 8);

  const seedFallback = uniq(seeds || [])
    .map((s) => tokenise(s).slice(0, 4).join(" "))
    .filter((s) => tokenise(s).length >= 2)
    .slice(0, 6);

  return uniq([...chips, ...seedFallback]).slice(0, 8);
}

/**
 * Rank competitors:
 * - freq across probes
 * - avg position (lower better)
 */
function rankCompetitors(rawRows, { excludeRoot, max = 20 }) {
  const map = new Map();

  for (const r of rawRows) {
    const raw = r.domain;
    if (!raw) continue;

    const root = normalizeCandidateDomain(raw);
    if (!root) continue;

    if (excludeRoot && root === excludeRoot) continue;
    if (isBlockedDomain(root)) continue;

    const obj =
      map.get(root) || { domain: root, hits: 0, posSum: 0, kws: new Set() };

    obj.hits += 1;
    obj.posSum += Number(r.pos) || 10;
    obj.kws.add(r.kw);

    map.set(root, obj);
  }

  return Array.from(map.values())
    .map((x) => {
      const uniqueKwCount = x.kws.size;
      const avgPos = x.hits ? x.posSum / x.hits : 99;
      const score = uniqueKwCount * 100 - avgPos * 6;
      return { domain: x.domain, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.domain);
}

/**
 * Intent filter for candidates
 * - For search_engine primary intent: only allow search_engine + ai_answer_engine
 * - Also blocks obvious junk roles
 */
async function filterByIntent(candidates, expectedIntent, rootHost) {
  const out = [];

  for (const d of candidates) {
    // self / junk checks
    if (!d) continue;
    if (isSelfDomain(d, rootHost)) continue;
    if (isBlockedDomain(d)) continue;

    const url = `https://${d}`;
    const html = await fetchWithTimeout(url, 6500);
    if (!html) continue;

    const text = extractTitleAndDesc(html);
    const role = classifyRole(text);

    if (expectedIntent === "search_engine") {
      if (role === "search_engine" || role === "ai_answer_engine") out.push(d);
      continue;
    }

    // non-search-engine: block obvious wrong verticals
    if (role === "dictionary" || role === "music" || role === "payments") continue;
    if (role === "support_portal") continue;

    out.push(d);
  }

  return out;
}

/**
 * Ensure we always return N items:
 * - allow overlap between lists
 * - but NEVER add junk domains
 */
function fillToN(list, pool, n) {
  const out = [...list];
  const seen = new Set(out.map((x) => x.toLowerCase()));
  for (const p of pool) {
    if (out.length >= n) break;
    const key = String(p || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.slice(0, n);
}

export async function POST(req) {
  try {
    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json(
        { error: "domain is required", businessCompetitors: [], searchCompetitors: [] },
        { status: 400 }
      );
    }

    const host = normalizeHost(domain);
    const rootHost = getRootHost(host);
    if (!rootHost) {
      return NextResponse.json(
        { error: "invalid domain", businessCompetitors: [], searchCompetitors: [] },
        { status: 400 }
      );
    }

    const cacheKey = rootHost;
    const TTL_MS = 10 * 60 * 1000;

    const cached = cacheGet(CCACHE.suggest, cacheKey);
    if (cached) return NextResponse.json(cached);

    const inflight = CCACHE.inflight.get(cacheKey);
    if (inflight) return NextResponse.json(await inflight);

    const p = (async () => {
      const origin = new URL(req.url).origin;

      const dfsLogin = process.env.DATAFORSEO_LOGIN || "";
      const dfsPass = process.env.DATAFORSEO_PASSWORD || "";
      const serperKey = process.env.SERPER_API_KEY || "";

      const { location_name, language_code } = inferLocationAndLanguage(rootHost);

      // 1) Site profile (crawler)
      const profile = await postJson(origin, "/api/site/profile", { domain: rootHost }).catch(() => null);
      const siteType = profile?.siteType || "Website";
      const seeds = Array.isArray(profile?.seeds) ? profile.seeds : [];
      const primaryIntent = detectPrimaryIntent(profile);

      // 2) Keyword chips from step-4 (useful only for non-search-engine sites)
      const kwPayload = await postJson(origin, "/api/keywords/suggest", { domain: rootHost }).catch(() => null);
      const keywordChips = Array.isArray(kwPayload?.keywords) ? kwPayload.keywords : [];

      // 3) Platform (“business”) queries
      const platformQueries =
        primaryIntent === "search_engine"
          ? buildPlatformQueriesForSearchEngine(rootHost)
          : buildPlatformQueriesGeneric(seeds, siteType);

      // 4) Search probes (classic SEO overlap)
      const searchProbes = buildSearchProbes(primaryIntent, keywordChips, seeds, rootHost);

      // 5) SERP collection
      const platformRows = [];
      for (const q of platformQueries.slice(0, 8)) {
        const domains = await serpDomains({
          keyword: q,
          dfsLogin,
          dfsPass,
          serperKey,
          location_name,
          language_code,
        }).catch(() => []);

        domains.slice(0, 12).forEach((d, idx) => {
          if (isSelfDomain(d, rootHost)) return;
          platformRows.push({ domain: d, kw: q, pos: idx + 1 });
        });
      }

      const searchRows = [];
      for (const q of searchProbes.slice(0, 8)) {
        const domains = await serpDomains({
          keyword: q,
          dfsLogin,
          dfsPass,
          serperKey,
          location_name,
          language_code,
        }).catch(() => []);

        domains.slice(0, 12).forEach((d, idx) => {
          if (isSelfDomain(d, rootHost)) return;
          searchRows.push({ domain: d, kw: q, pos: idx + 1 });
        });
      }

      // 6) Rank
      const excludeRoot = getRootHost(rootHost);

      let platformCandidates = rankCompetitors(platformRows, { excludeRoot, max: 30 });
      let searchCandidates = rankCompetitors(searchRows, { excludeRoot, max: 30 });

      // 7) Intent filter (hard)
      const expectedIntent = primaryIntent === "search_engine" ? "search_engine" : "other";

      const platformFiltered = await filterByIntent(
        platformCandidates.slice(0, 18),
        expectedIntent,
        rootHost
      );

      const searchFiltered = await filterByIntent(
        searchCandidates.slice(0, 18),
        expectedIntent,
        rootHost
      );

      // 8) Ensure 4+4 (allow overlap, but never add junk)
      let businessCompetitors = platformFiltered.slice(0, 4);
      let searchCompetitors = searchFiltered.slice(0, 4);

      // If one list is short, fill from the other (overlap allowed)
      businessCompetitors = fillToN(businessCompetitors, searchFiltered, 4);
      searchCompetitors = fillToN(searchCompetitors, platformFiltered, 4);

      // If still short (rare), fill from remaining ranked candidates (filtered already)
      businessCompetitors = fillToN(businessCompetitors, platformFiltered, 4);
      searchCompetitors = fillToN(searchCompetitors, searchFiltered, 4);

      const value = {
        businessCompetitors,
        searchCompetitors,
        debug: {
          siteType,
          primaryIntent,
          location_name,
          language_code,
          platformQueriesUsed: platformQueries.slice(0, 8),
          searchProbesUsed: searchProbes.slice(0, 8),
          platformRaw: platformRows.length,
          searchRaw: searchRows.length,
          platformCandidates: platformCandidates.slice(0, 12),
          searchCandidates: searchCandidates.slice(0, 12),
        },
      };

      cacheSet(CCACHE.suggest, cacheKey, value, TTL_MS);
      return value;
    })().finally(() => {
      CCACHE.inflight.delete(cacheKey);
    });

    CCACHE.inflight.set(cacheKey, p);
    return NextResponse.json(await p);
  } catch (err) {
    console.error("/api/competitors/suggest error:", err);
    return NextResponse.json(
      { businessCompetitors: [], searchCompetitors: [] },
      { status: 200 }
    );
  }
}
