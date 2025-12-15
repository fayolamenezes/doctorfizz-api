// src/app/api/keywords/suggest/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * In-memory cache for keyword suggestions
 */
const g = globalThis;
if (!g.__keywordSuggestCache) {
  g.__keywordSuggestCache = {
    suggest: new Map(),
    inflight: new Map(),
  };
}
const KCACHE = g.__keywordSuggestCache;

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

function getRootHost(host) {
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  return parts.slice(parts.length - 2).join(".");
}

function cleanKW(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
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

/**
 * Filters / tokenization
 */
const BAD_PHRASES = [
  "learn more",
  "more",
  "more about",
  "about",
  "about us",
  "contact",
  "privacy",
  "terms",
  "login",
  "sign in",
  "signin",
  "signup",
  "sign up",
  "careers",
  "jobs",
  "press",
  "home",
  "homepage",
];

const QUERY_MODIFIERS = new Set([
  "meaning",
  "means",
  "definition",
  "define",
  "example",
  "examples",
  "pdf",
  "ppt",
  "doc",
  "notes",
  "mcq",
  "quiz",
  "question",
  "questions",
  "near",
  "best",
  "top",
  "latest",
  "new",
  "your",
  "free",
  "download",
  "template",
  "guide",
  "how",
  "what",
  "why",
  "when",
  "where",
]);

const LANGUAGE_MODIFIERS = new Set([
  "hindi",
  "marathi",
  "urdu",
  "tamil",
  "telugu",
  "kannada",
  "malayalam",
  "gujarati",
  "punjabi",
  "bengali",
  "english",
]);

// Keep this SMALL. We *penalize* generic-only phrases, but don’t nuke everything.
const GENERIC_TOKENS = new Set([
  "seo",
  "web",
  "website",
  "marketing",
  "business",
  "digital",
  "online",
  "media",
  "social",
  "strategy",
  "services",
  "service",
  "solutions",
  "company",
  "agency",
  "agencies",
  "brand",
  "branding",
  "growth",
  "management",
  "platform",
  "tools",
  "tool",
]);

function tokenizeKW(raw) {
  return cleanKW(raw)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function isYearish(s) {
  return /\b(19|20)\d{2}\b/.test(String(s || ""));
}

function isBadKeyword(kw, brandToken) {
  const k = String(kw || "").toLowerCase();
  if (!k || k.length < 3 || k.length > 80) return true;
  if (isYearish(k)) return true;

  for (const bp of BAD_PHRASES) {
    if (k === bp || k.startsWith(bp + " ") || k.endsWith(" " + bp))
      return true;
  }

  if (brandToken && k === brandToken.toLowerCase()) return true;
  return false;
}

function isGoodToken(t) {
  if (!t) return false;
  if (t.length < 2) return false;
  if (/^\d+$/.test(t)) return false;
  if (QUERY_MODIFIERS.has(t)) return false;
  if (LANGUAGE_MODIFIERS.has(t)) return false;
  // stop super common junk prepositions/articles
  if (["the", "a", "an", "and", "or", "to", "of", "in", "for", "with", "on", "by"].includes(t))
    return false;
  return true;
}

function chipIsOnlyGeneric(chip) {
  const t = tokenizeKW(chip);
  if (!t.length) return true;
  return t.every((x) => GENERIC_TOKENS.has(x));
}

function jaccardSim(a, b) {
  const A = new Set(tokenizeKW(a));
  const B = new Set(tokenizeKW(b));
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

function overlapCount(tokens, tokenSet) {
  let c = 0;
  for (const t of tokens) if (tokenSet.has(t)) c++;
  return c;
}

/**
 * Build “rich” chips (2–4 words).
 * - rejects 1-word chips by default (unless fallback mode)
 */
function toRichKeyword(raw, { minWords = 2, maxWords = 4 } = {}) {
  const tokens = tokenizeKW(raw).filter(isGoodToken);
  if (!tokens.length) return "";

  // Prefer 2–4 word window that contains at least 1 non-generic token
  const n = tokens.length;
  let best = "";
  let bestScore = -Infinity;

  const windowScore = (ws) => {
    const nonGeneric = ws.filter((t) => !GENERIC_TOKENS.has(t)).length;
    const generic = ws.length - nonGeneric;

    // prefer having non-generic tokens
    let score = nonGeneric * 8 - generic * 2;

    // prefer slightly longer (but cap)
    score += ws.join("").length / 10;

    // discourage phrases that start/end with generic token
    if (GENERIC_TOKENS.has(ws[0])) score -= 3;
    if (GENERIC_TOKENS.has(ws[ws.length - 1])) score -= 2;

    return score;
  };

  for (let len = minWords; len <= Math.min(maxWords, n); len++) {
    for (let i = 0; i + len <= n; i++) {
      const ws = tokens.slice(i, i + len);
      // must not be all generic
      if (ws.every((t) => GENERIC_TOKENS.has(t))) continue;

      const phrase = ws.join(" ");
      const score = windowScore(ws);

      if (score > bestScore) {
        bestScore = score;
        best = phrase;
      }
    }
  }

  // If we didn’t find a 2–4 word phrase, return empty (caller can fallback)
  return best;
}

/**
 * DataForSEO calls
 */
async function dataForSeoPost(path, payload, login, password) {
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const res = await fetch(`https://api.dataforseo.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("DataForSEO error:", path, res.status, json);
    throw new Error(`DataForSEO failed: ${path} (${res.status})`);
  }
  return json;
}

async function keywordsForSite({
  target,
  login,
  password,
  location_name,
  language_code,
  limit = 300,
}) {
  const payload = [{ target, location_name, language_code, limit, offset: 0 }];
  const json = await dataForSeoPost(
    "/v3/dataforseo_labs/google/keywords_for_site/live",
    payload,
    login,
    password
  );

  const items =
    json?.tasks?.[0]?.result?.[0]?.items &&
    Array.isArray(json.tasks[0].result[0].items)
      ? json.tasks[0].result[0].items
      : [];

  return items;
}

async function keywordIdeas({
  keyword,
  login,
  password,
  location_name,
  language_code,
  limit = 100,
}) {
  const payload = [{ keyword, location_name, language_code, limit, offset: 0 }];
  const json = await dataForSeoPost(
    "/v3/dataforseo_labs/google/keyword_ideas/live",
    payload,
    login,
    password
  );

  const items =
    json?.tasks?.[0]?.result?.[0]?.items &&
    Array.isArray(json.tasks[0].result[0].items)
      ? json.tasks[0].result[0].items
      : [];

  return items;
}

/**
 * Validates & scores candidates with metrics.
 * If endpoint not available, returns empty map (safe fallback).
 */
async function keywordMetrics({
  keywords,
  login,
  password,
  location_name,
  language_code,
}) {
  if (!keywords || keywords.length === 0) return new Map();

  try {
    const payload = [
      {
        keywords: keywords.slice(0, 200),
        location_name,
        language_code,
      },
    ];

    const json = await dataForSeoPost(
      "/v3/keywords_data/google/search_volume/live",
      payload,
      login,
      password
    );

    const items =
      json?.tasks?.[0]?.result && Array.isArray(json.tasks[0].result)
        ? json.tasks[0].result
        : [];

    const map = new Map();
    for (const it of items) {
      const kw = cleanKW(it?.keyword || it?.keyword_info?.keyword || "") || "";
      if (!kw) continue;
      const sv = Number(it?.search_volume ?? it?.keyword_info?.search_volume ?? 0) || 0;
      const cpc = Number(it?.cpc ?? 0) || 0;
      const comp = Number(it?.competition ?? it?.keyword_info?.competition ?? 0) || 0;
      map.set(kw.toLowerCase(), { sv, cpc, comp });
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Site profile fetch (your internal route)
 */
async function getSiteProfile(domain) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");

  if (base) {
    const res = await fetch(`${base}/api/site/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    }).catch(() => null);

    if (res && res.ok) return res.json();
  }

  // dev fallback
  const res2 = await fetch("http://localhost:3000/api/site/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  }).catch(() => null);

  if (res2 && res2.ok) return res2.json();
  return null;
}

/**
 * Mine richer candidates from crawler profile:
 * - seeds + slugPhrases + json-ld + bodyTextSamples ngrams (2–4)
 */
function mineCandidatesFromProfile(profile, brandToken) {
  const seeds = uniq((profile?.seeds || []).map(cleanKW)).slice(0, 120);
  const slugPhrases = uniq((profile?.slugPhrases || []).map(cleanKW)).slice(0, 100);

  const jsonLd = Array.isArray(profile?.jsonLdEntities) ? profile.jsonLdEntities : [];
  const jsonLdTexts = [];
  for (const e of jsonLd) {
    if (typeof e?.name === "string") jsonLdTexts.push(e.name);
    if (typeof e?.serviceType === "string") jsonLdTexts.push(e.serviceType);
    if (typeof e?.category === "string") jsonLdTexts.push(e.category);
    if (typeof e?.description === "string") jsonLdTexts.push(e.description);
  }

  const bodySamples = Array.isArray(profile?.bodyTextSamples) ? profile.bodyTextSamples : [];

  // mine ngrams 2–4 from body samples
  const freq = new Map(); // phrase -> weight
  const bump = (p, w = 1) => {
    const key = cleanKW(p).toLowerCase();
    if (!key) return;
    freq.set(key, (freq.get(key) || 0) + w);
  };

  for (const s of bodySamples.slice(0, 6)) {
    const toks = tokenizeKW(s).filter((t) => t.length >= 3 && isGoodToken(t));
    for (let i = 0; i < toks.length; i++) {
      const w2 = toks.slice(i, i + 2);
      const w3 = toks.slice(i, i + 3);
      const w4 = toks.slice(i, i + 4);

      if (w2.length === 2) bump(w2.join(" "), 1.2);
      if (w3.length === 3) bump(w3.join(" "), 0.9);
      if (w4.length === 4) bump(w4.join(" "), 0.6);
    }
  }

  const minedBody = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p)
    .slice(0, 180);

  const raw = uniq([...jsonLdTexts, ...slugPhrases, ...seeds, ...minedBody]);

  // convert to rich 2–4 word phrases
  const rich = raw
    .map((r) => toRichKeyword(r, { minWords: 2, maxWords: 4 }))
    .filter(Boolean)
    .map(cleanKW)
    .filter((c) => !isBadKeyword(c, brandToken))
    .filter((c) => !chipIsOnlyGeneric(c));

  return uniq(rich).slice(0, 260);
}

/**
 * choose best “idea seeds” (used for keyword_ideas expansion)
 */
function selectIdeaSeeds(seeds, max = 6) {
  const cleaned = uniq((seeds || []).map(cleanKW)).filter(Boolean);

  const scored = cleaned
    .map((s) => {
      const toks = tokenizeKW(s).filter(isGoodToken);
      const wc = toks.length;

      // prefer 2–4 word seeds
      let score = 0;
      if (wc === 2) score += 12;
      if (wc === 3) score += 10;
      if (wc === 4) score += 8;
      if (wc === 1) score -= 6;

      // penalize generic-only
      if (toks.length && toks.every((t) => GENERIC_TOKENS.has(t))) score -= 30;

      score += Math.min(10, s.length / 7);
      return { seed: s, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.map((x) => x.seed).slice(0, max);
}

function pickFinalKeywords({ rows, seedTokensAll, seedTokensSpecific, max = 8 }) {
  const chosen = [];
  const chosenLower = new Set();

  for (const r of rows) {
    if (chosen.length >= max) break;
    const kw = r.kw;
    const key = kw.toLowerCase();
    if (chosenLower.has(key)) continue;

    // keep diversity
    if (chosen.some((k) => jaccardSim(k, kw) >= 0.62)) continue;

    const toks = tokenizeKW(kw);

    // require at least 1 seed overlap if we have seeds
    if (seedTokensAll.size > 0 && overlapCount(toks, seedTokensAll) === 0) continue;

    // strongly prefer specific overlap when possible
    if (seedTokensSpecific.size >= 3 && overlapCount(toks, seedTokensSpecific) === 0) {
      // don’t hard reject, but heavily limit
      if (chosen.length < 3) continue;
    }

    chosen.push(kw);
    chosenLower.add(key);
  }

  // last-resort: if still not enough, relax overlap requirement
  if (chosen.length < max) {
    for (const r of rows) {
      if (chosen.length >= max) break;
      const kw = r.kw;
      const key = kw.toLowerCase();
      if (chosenLower.has(key)) continue;
      if (chosen.some((k) => jaccardSim(k, kw) >= 0.7)) continue;
      chosen.push(kw);
      chosenLower.add(key);
    }
  }

  return chosen.slice(0, max);
}

export async function POST(req) {
  try {
    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json(
        { error: "domain is required", keywords: [] },
        { status: 400 }
      );
    }

    const host = normalizeHost(domain);
    const rootHost = getRootHost(host);
    const brandToken = (rootHost || "").split(".")[0];

    const dfsLogin = process.env.DATAFORSEO_LOGIN || "";
    const dfsPass = process.env.DATAFORSEO_PASSWORD || "";
    if (!dfsLogin || !dfsPass) {
      return NextResponse.json({ keywords: [] }, { status: 200 });
    }

    const cacheKey = rootHost;
    const TTL_MS = 10 * 60 * 1000;

    const cached = cacheGet(KCACHE.suggest, cacheKey);
    if (cached) return NextResponse.json(cached);

    const inflight = KCACHE.inflight.get(cacheKey);
    if (inflight) return NextResponse.json(await inflight);

    const p = (async () => {
      const profile = await getSiteProfile(rootHost).catch(() => null);
      const siteType = profile?.siteType || "Website";

      const { location_name, language_code } = inferLocationAndLanguage(rootHost);

      // Seed tokens (for alignment)
      const allSeeds = uniq((profile?.seeds || []).map(cleanKW)).slice(0, 70);
      const seedTokensAll = new Set(
        allSeeds.flatMap((s) => tokenizeKW(s)).filter((t) => t.length >= 3)
      );
      const seedTokensSpecific = new Set(
        [...seedTokensAll].filter((t) => !GENERIC_TOKENS.has(t))
      );

      // 1) Mine candidates from the actual site content (2–4 word)
      const mined = mineCandidatesFromProfile(profile, brandToken);

      // 2) Score mined with keyword metrics (best)
      const metricsMap = await keywordMetrics({
        keywords: mined,
        login: dfsLogin,
        password: dfsPass,
        location_name,
        language_code,
      });

      // 3) Expand with keyword ideas from the best site phrases (helps a lot)
      const ideaSeeds = selectIdeaSeeds(mined, 6);
      const ideaRows = [];
      for (const seed of ideaSeeds) {
        try {
          const ideaItems = await keywordIdeas({
            keyword: seed,
            login: dfsLogin,
            password: dfsPass,
            location_name,
            language_code,
            limit: 120,
          });

          for (const it of ideaItems) {
            const raw =
              cleanKW(
                it?.keyword ||
                  it?.keyword_data?.keyword ||
                  it?.keyword_info?.keyword
              ) || "";
            if (!raw) continue;

            const kw = toRichKeyword(raw, { minWords: 2, maxWords: 4 });
            if (!kw) continue;
            if (isBadKeyword(kw, brandToken)) continue;
            if (chipIsOnlyGeneric(kw)) continue;

            const sv =
              Number(
                it?.search_volume ??
                  it?.keyword_data?.search_volume ??
                  it?.keyword_info?.search_volume ??
                  0
              ) || 0;

            const cpc = Number(it?.cpc ?? 0) || 0;

            ideaRows.push({ kw, sv, cpc, source: "idea" });
          }
        } catch {
          // ignore per-seed failures
        }
      }

      // 4) Reality-check fallback: keywords_for_site (if ideas/metrics are thin)
      let rankRows = [];
      try {
        const rankItems = await keywordsForSite({
          target: rootHost,
          login: dfsLogin,
          password: dfsPass,
          location_name,
          language_code,
          limit: 400,
        });

        rankRows = rankItems
          .map((it) => {
            const raw = cleanKW(it?.keyword) || "";
            if (!raw) return null;

            const kw = toRichKeyword(raw, { minWords: 2, maxWords: 4 });
            if (!kw) return null;
            if (isBadKeyword(kw, brandToken)) return null;
            if (chipIsOnlyGeneric(kw)) return null;

            const sv = Number(it?.search_volume ?? 0) || 0;
            const cpc = Number(it?.cpc ?? 0) || 0;
            return { kw, sv, cpc, source: "rank" };
          })
          .filter(Boolean);
      } catch {
        // ignore
      }

      // Build mined rows with metrics
      const minedRows = mined.map((kw) => {
        const m = metricsMap.get(kw.toLowerCase());
        return {
          kw,
          sv: m?.sv ?? 0,
          cpc: m?.cpc ?? 0,
          comp: m?.comp ?? 0,
          source: m ? "mined+metrics" : "mined",
        };
      });

      // Merge (mined first, ideas next, rank last)
      const combined = [...minedRows, ...ideaRows, ...rankRows];

      // Score
      const scored = uniq(combined.map((r) => r.kw)).map((kw) => {
        const row =
          combined.find((x) => x.kw === kw && x.source === "mined+metrics") ||
          combined.find((x) => x.kw === kw && x.source === "mined") ||
          combined.find((x) => x.kw === kw && x.source === "idea") ||
          combined.find((x) => x.kw === kw) ||
          { kw, sv: 0, cpc: 0, source: "unknown" };

        const toks = tokenizeKW(kw);

        const overlapAll = overlapCount(toks, seedTokensAll);
        const overlapSpec = overlapCount(toks, seedTokensSpecific);

        const sourceBoost =
          row.source === "mined+metrics"
            ? 42
            : row.source === "mined"
            ? 32
            : row.source === "idea"
            ? 22
            : row.source === "rank"
            ? 10
            : 0;

        const volScore = Math.log10((row.sv || 0) + 1) * 13;
        const cpcScore = (row.cpc || 0) * 2.1;

        const lengthBonus = Math.min(10, kw.length / 10);
        const overlapScore = overlapSpec * 22 + overlapAll * 7;

        const genericPenalty = chipIsOnlyGeneric(kw) ? 25 : 0;

        // If siteType is not local, slightly penalize “city-like” second token after generic heads
        // (you can expand this later if you want city detection)
        const typePenalty =
          siteType !== "LocalBusiness" && toks.length === 2 && toks[0] === "agencies"
            ? 8
            : 0;

        const score =
          sourceBoost +
          volScore +
          cpcScore +
          lengthBonus +
          overlapScore -
          genericPenalty -
          typePenalty;

        return { kw, score };
      });

      scored.sort((a, b) => b.score - a.score);

      const rows = scored.map((x) => ({ kw: x.kw, score: x.score }));

      // Pick final 8 (diverse + aligned)
      let keywords = pickFinalKeywords({
        rows,
        seedTokensAll,
        seedTokensSpecific,
        max: 8,
      });

      // last-resort: allow 1-word chips only if we truly cannot fill
      if (keywords.length < 6) {
        const oneWordFallback = uniq(
          combined
            .map((r) => {
              const toks = tokenizeKW(r.kw).filter(isGoodToken);
              if (toks.length === 1 && !GENERIC_TOKENS.has(toks[0])) return toks[0];
              return null;
            })
            .filter(Boolean)
        ).slice(0, 8 - keywords.length);

        keywords = uniq([...keywords, ...oneWordFallback]).slice(0, 8);
      }

      const value = {
        keywords,
        debug: {
          siteType,
          location_name,
          language_code,
          minedCount: mined.length,
          metricsReturnedCount: metricsMap.size,
          ideaSeeds,
          ideaCount: ideaRows.length,
          rankCount: rankRows.length,
          seedTokensAllSize: seedTokensAll.size,
          seedTokensSpecificSize: seedTokensSpecific.size,
        },
      };

      cacheSet(KCACHE.suggest, cacheKey, value, TTL_MS);
      return value;
    })().finally(() => {
      KCACHE.inflight.delete(cacheKey);
    });

    KCACHE.inflight.set(cacheKey, p);
    return NextResponse.json(await p);
  } catch (err) {
    console.error("/api/keywords/suggest error:", err);
    return NextResponse.json({ keywords: [] }, { status: 200 });
  }
}
