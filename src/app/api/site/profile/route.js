// src/app/api/site/profile/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * In-memory cache (per Node process)
 */
const g = globalThis;
if (!g.__siteProfileCache) {
  g.__siteProfileCache = {
    profile: new Map(), // domain -> { expiresAt, value }
    inflight: new Map(), // domain -> Promise
  };
}
const CACHE = g.__siteProfileCache;

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

function rootUrlFromDomain(domain) {
  const host = normalizeHost(domain);
  if (!host) return null;
  return `https://${host}`;
}

function safeText(str) {
  return String(str || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html) {
  return safeText(String(html || "").replace(/<[^>]+>/g, " "));
}

function firstMatch(html, re) {
  const m = re.exec(html);
  return m ? m[1] : "";
}

function allMatches(html, re, limit = 50) {
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
    if (out.length >= limit) break;
  }
  return out;
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function normalizePhrase(s) {
  return stripTags(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turn URL slug into words:
 * /services/seo-audit -> "seo audit"
 * /blog/how-to-do-x -> "how to do x"
 */
function slugToPhrase(urlStr, origin) {
  try {
    const u = new URL(urlStr, origin);
    const parts = u.pathname
      .split("/")
      .filter(Boolean)
      .slice(0, 4); // keep top path segments
    if (!parts.length) return "";
    const s = parts
      .join(" ")
      .replace(/[-_]+/g, " ")
      .replace(/\d+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return s.length >= 3 ? s : "";
  } catch {
    return "";
  }
}

/**
 * Extract visible-ish body text sample:
 * - remove scripts/styles
 * - remove tags
 * - keep first N chars (enough for topics)
 */
function extractBodyTextSample(html, maxChars = 3000) {
  const withoutScripts = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const text = stripTags(withoutScripts);
  if (!text) return "";
  return text.slice(0, maxChars);
}

/**
 * Extract OG tags (often better than meta description)
 */
function extractOpenGraph(html) {
  const ogTitle =
    firstMatch(
      html,
      /<meta[^>]+property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
    ) ||
    firstMatch(
      html,
      /<meta[^>]+content=["']([\s\S]*?)["'][^>]*property=["']og:title["'][^>]*>/i
    );

  const ogDesc =
    firstMatch(
      html,
      /<meta[^>]+property=["']og:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
    ) ||
    firstMatch(
      html,
      /<meta[^>]+content=["']([\s\S]*?)["'][^>]*property=["']og:description["'][^>]*>/i
    );

  return {
    ogTitle: stripTags(ogTitle),
    ogDescription: stripTags(ogDesc),
  };
}

/**
 * Extract JSON-LD entities:
 * - Organization/Product/Service name, description, offers, sameAs
 * This boosts “what the site is about” a LOT for modern sites.
 */
function extractJsonLdEntities(html) {
  const scripts = allMatches(
    html,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    20
  );

  const entities = [];

  const pushEntity = (obj) => {
    if (!obj || typeof obj !== "object") return;

    const typeRaw = obj["@type"] || obj.type;
    const type = Array.isArray(typeRaw) ? typeRaw.join(",") : String(typeRaw || "").trim();

    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const description =
      typeof obj.description === "string" ? obj.description.trim() : "";

    const sameAs = Array.isArray(obj.sameAs)
      ? obj.sameAs.filter((x) => typeof x === "string").slice(0, 10)
      : [];

    const serviceType =
      typeof obj.serviceType === "string" ? obj.serviceType.trim() : "";

    const category =
      typeof obj.category === "string" ? obj.category.trim() : "";

    // products/offers (light)
    let offers = "";
    try {
      if (obj.offers && typeof obj.offers === "object") {
        const price = obj.offers.price ? String(obj.offers.price) : "";
        const priceCurrency = obj.offers.priceCurrency ? String(obj.offers.priceCurrency) : "";
        offers = [price, priceCurrency].filter(Boolean).join(" ").trim();
      }
    } catch {}

    // Only keep entities that have at least something useful
    if (type || name || description || serviceType || category || offers || sameAs.length) {
      entities.push({
        type: type || null,
        name: name || null,
        description: description || null,
        serviceType: serviceType || null,
        category: category || null,
        offers: offers || null,
        sameAs,
      });
    }
  };

  for (const raw of scripts) {
    const txt = String(raw || "").trim();
    if (!txt) continue;
    try {
      const parsed = JSON.parse(txt);

      // JSON-LD can be: object | array | { @graph: [] }
      if (Array.isArray(parsed)) {
        for (const item of parsed) pushEntity(item);
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed["@graph"])) {
          for (const item of parsed["@graph"]) pushEntity(item);
        } else {
          pushEntity(parsed);
        }
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }

  return entities.slice(0, 15);
}

/**
 * Extract:
 * - title
 * - meta description
 * - og tags
 * - h1/h2/h3
 * - anchors
 * - internal links
 * - body text sample
 * - json-ld entities
 * - slug phrases
 */
function extractSignalsFromHtml(html, origin) {
  const title = stripTags(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const metaDesc =
    firstMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
    ) ||
    firstMatch(
      html,
      /<meta[^>]+content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i
    );

  const { ogTitle, ogDescription } = extractOpenGraph(html);

  const h1s = allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 12).map(stripTags);
  const h2s = allMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 30).map(stripTags);
  const h3s = allMatches(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 35).map(stripTags);

  const anchorTexts = allMatches(html, /<a[^>]*>([\s\S]*?)<\/a>/gi, 200)
    .map(stripTags)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 2 && t.length <= 70);

  const hrefs = allMatches(html, /<a[^>]+href=["']([^"']+)["']/gi, 400);

  const internalUrls = [];
  for (const href of hrefs) {
    try {
      if (!href) continue;
      if (href.startsWith("#")) continue;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      if (href.startsWith("javascript:")) continue;

      const u = new URL(href, origin);
      if (u.origin !== origin) continue;

      if (
        /\.(png|jpg|jpeg|webp|gif|svg|pdf|zip|mp4|mp3|css|js)(\?|$)/i.test(
          u.pathname
        )
      )
        continue;

      internalUrls.push(u.toString());
    } catch {
      // ignore
    }
  }

  const uniqInternal = uniq(internalUrls);
  const slugPhrases = uniqInternal
    .map((u) => slugToPhrase(u, origin))
    .filter(Boolean)
    .slice(0, 60);

  return {
    title,
    description: stripTags(metaDesc),
    ogTitle,
    ogDescription,
    h1s,
    h2s,
    h3s,
    anchors: anchorTexts,
    internalUrls: uniqInternal.slice(0, 120),
    slugPhrases,
    bodyTextSample: extractBodyTextSample(html, 3000),
    jsonLdEntities: extractJsonLdEntities(html),
  };
}

/**
 * Very light site type classifier (rule-based)
 */
function classifySiteType(textBlob) {
  const t = (textBlob || "").toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));

  if (has("add to cart", "checkout", "shop now", "buy now", "wishlist", "products"))
    return "Ecommerce";

  if (has("pricing", "free trial", "request a demo", "dashboard", "integrations", "api"))
    return "SaaS";

  if (has("blog", "latest posts", "categories", "tags", "author", "published"))
    return "Publisher";

  if (has("book appointment", "call us", "directions", "opening hours", "near me"))
    return "LocalBusiness";

  if (has("careers", "investors", "press", "about us", "our mission"))
    return "Company";

  return "Website";
}

/**
 * Build seed topics from:
 * - title/desc/og
 * - json-ld entity hints
 * - h1/h2/h3
 * - slug phrases
 * - anchors
 * - body text samples
 */
function buildSeeds(signals) {
  const jsonLdText = (signals.jsonLdEntities || [])
    .flatMap((e) => [
      e.type,
      e.name,
      e.description,
      e.serviceType,
      e.category,
      e.offers,
    ])
    .filter(Boolean)
    .join(" ");

  const raw = [
    signals.title,
    signals.ogTitle,
    signals.description,
    signals.ogDescription,
    jsonLdText,
    ...(signals.h1s || []),
    ...(signals.h2s || []),
    ...(signals.h3s || []).slice(0, 20),
    ...(signals.slugPhrases || []).slice(0, 40),
    ...(signals.anchors || []).slice(0, 80),
    ...(signals.bodyTextSamples || []).slice(0, 3), // already truncated
  ]
    .filter(Boolean)
    .join(" ");

  const tokens = normalizePhrase(raw).split(" ").filter(Boolean);

  const STOP = new Set([
    "home",
    "about",
    "contact",
    "privacy",
    "terms",
    "login",
    "signin",
    "sign",
    "up",
    "careers",
    "jobs",
    "learn",
    "more",
    "get",
    "started",
    "product",
    "products",
    "services",
    "service",
    "solutions",
    "company",
    "official",
    "page",
    "pages",
    "news",
    "blog",
    "help",
    "support",
    "search",
    "settings",
    "cookie",
    "cookies",
    "policy",
    "policies",
  ]);

  const freq = new Map();
  for (const tok of tokens) {
    if (tok.length < 3) continue;
    if (STOP.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  }

  const phraseSources = [
    signals.title,
    signals.ogTitle,
    signals.description,
    signals.ogDescription,
    ...(signals.h1s || []),
    ...(signals.h2s || []),
    ...(signals.h3s || []).slice(0, 15),
    ...(signals.slugPhrases || []).slice(0, 40),
    // Use anchors but not too much (noisy)
    ...(signals.anchors || []).slice(0, 40),
  ]
    .map(normalizePhrase)
    .filter(Boolean);

  const phrases = [];
  for (const s of phraseSources) {
    const words = s.split(" ").filter((w) => w && !STOP.has(w) && w.length >= 3);
    for (let i = 0; i < words.length; i++) {
      const a = words[i];
      const b = words[i + 1];
      const c = words[i + 2];

      if (a && b) phrases.push(`${a} ${b}`);
      if (a && b && c) phrases.push(`${a} ${b} ${c}`);
    }
  }

  const phraseScore = (p) => {
    const ws = p.split(" ");
    const sum = ws.reduce((acc, w) => acc + (freq.get(w) || 0), 0);
    // prefer longer, more specific phrases slightly
    return sum + ws.join("").length / 10;
  };

  const rankedPhrases = uniq(phrases)
    .filter((p) => p.split(" ").length <= 3)
    .filter((p) => p.length >= 6 && p.length <= 55)
    .sort((a, b) => phraseScore(b) - phraseScore(a))
    .slice(0, 35);

  const rankedTokens = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 25);

  return uniq([...rankedPhrases, ...rankedTokens]).slice(0, 55);
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "DrFizzSEO/1.0 (+site-profiler)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.text();
}

/**
 * Try to pull a few URLs from sitemap.xml (very small sample).
 * This helps JS-heavy homepages.
 */
async function tryGetSitemapUrls(origin) {
  const sitemapUrl = `${origin}/sitemap.xml`;
  try {
    const xml = await fetchHtml(sitemapUrl);
    if (!xml || !xml.includes("<url")) return [];

    const locs = allMatches(xml, /<loc>([\s\S]*?)<\/loc>/gi, 250)
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    const scored = locs.map((u) => {
      let score = 0;
      try {
        const p = new URL(u).pathname.toLowerCase();
        if (p.includes("about")) score += 6;
        if (p.includes("product") || p.includes("solution")) score += 6;
        if (p.includes("service")) score += 6;
        if (p.includes("pricing")) score += 6;
        if (p.includes("blog") || p.includes("resources") || p.includes("docs")) score += 5;
        if (p.includes("case-stud") || p.includes("portfolio")) score += 5;
        if (p === "/" || p === "") score -= 10;
      } catch {}
      return { url: u, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return uniq(scored.map((x) => x.url)).slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Profile a site by crawling:
 * - homepage
 * - best internal URLs from homepage
 * - fallback “common pages”
 * - small sample from sitemap.xml (if present)
 *
 * Returns richer profile:
 * - seeds derived from headings + slugs + body text + json-ld + og tags
 * - bodyTextSamples array to drive local keyword mining later
 */
async function computeSiteProfile(domain) {
  const root = rootUrlFromDomain(domain);
  if (!root) throw new Error("Invalid domain");
  const origin = new URL(root).origin;

  // homepage
  const homeHtml = await fetchHtml(root);
  const homeSignals = extractSignalsFromHtml(homeHtml, origin);

  // prioritize internal pages
  const scoredUrls = (homeSignals.internalUrls || []).map((u) => {
    const p = new URL(u).pathname.toLowerCase();
    let score = 0;
    if (p.includes("about")) score += 7;
    if (p.includes("product") || p.includes("solution")) score += 7;
    if (p.includes("service")) score += 7;
    if (p.includes("pricing")) score += 7;
    if (p.includes("blog") || p.includes("news") || p.includes("resources")) score += 6;
    if (p.includes("docs") || p.includes("developer")) score += 6;
    if (p.includes("case-stud") || p.includes("portfolio") || p.includes("work"))
      score += 6;
    if (p === "/" || p === "") score -= 10;
    return { url: u, score };
  });

  scoredUrls.sort((a, b) => b.score - a.score);
  const pickedFromHome = uniq(scoredUrls.map((x) => x.url)).slice(0, 7);

  // common pages fallback
  const commonPaths = [
    "/about",
    "/about-us",
    "/company",
    "/work",
    "/portfolio",
    "/case-studies",
    "/products",
    "/product",
    "/services",
    "/service",
    "/solutions",
    "/pricing",
    "/blog",
    "/resources",
    "/docs",
    "/developers",
  ];
  const fallbackUrls = commonPaths.map((p) => `${origin}${p}`);

  // sitemap sample
  const sitemapUrls = await tryGetSitemapUrls(origin);

  // final crawl targets
  const crawlTargets = uniq([
    root,
    ...pickedFromHome,
    ...sitemapUrls,
    ...fallbackUrls,
  ]).slice(0, 14); // keep it light

  const pages = [];
  for (const u of crawlTargets) {
    try {
      const html = await fetchHtml(u);
      const sig = extractSignalsFromHtml(html, origin);
      pages.push({ url: u, ...sig });
    } catch {
      // ignore per-page failures
    }
  }

  // combine text for classification
  const combinedText = pages
    .flatMap((p) => [
      p.title,
      p.ogTitle,
      p.description,
      p.ogDescription,
      ...(p.h1s || []),
      ...(p.h2s || []),
      ...(p.h3s || []),
      ...(p.slugPhrases || []),
      ...(p.anchors || []).slice(0, 30),
      p.bodyTextSample,
      ...(p.jsonLdEntities || []).flatMap((e) => [
        e.type,
        e.name,
        e.description,
        e.serviceType,
        e.category,
      ]),
    ])
    .filter(Boolean)
    .join(" ");

  const siteType = classifySiteType(combinedText);

  const bodyTextSamples = pages
    .map((p) => p.bodyTextSample)
    .filter(Boolean)
    .slice(0, 8);

  const slugPhrases = uniq(pages.flatMap((p) => p.slugPhrases || [])).slice(0, 80);

  const jsonLdEntities = uniq(
    pages
      .flatMap((p) => p.jsonLdEntities || [])
      .map((e) => JSON.stringify(e))
  )
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, 15);

  // merged signals for seeding
  const mergedSignals = {
    title: homeSignals.title,
    ogTitle: homeSignals.ogTitle,
    description: homeSignals.description,
    ogDescription: homeSignals.ogDescription,
    h1s: uniq(pages.flatMap((p) => p.h1s || [])).slice(0, 40),
    h2s: uniq(pages.flatMap((p) => p.h2s || [])).slice(0, 60),
    h3s: uniq(pages.flatMap((p) => p.h3s || [])).slice(0, 60),
    anchors: uniq(pages.flatMap((p) => p.anchors || [])).slice(0, 120),
    slugPhrases,
    jsonLdEntities,
    bodyTextSamples,
  };

  const seeds = buildSeeds(mergedSignals);
  const brand = normalizeHost(domain)?.split(".")?.[0] || "";

  return {
    domain: normalizeHost(domain),
    rootUrl: root,
    siteType,
    brand,
    signals: {
      title: homeSignals.title,
      ogTitle: homeSignals.ogTitle,
      description: homeSignals.description,
      ogDescription: homeSignals.ogDescription,
      h1s: homeSignals.h1s,
    },

    // ✅ richer outputs to drive your “generate keywords from content” step
    seeds,
    bodyTextSamples,
    slugPhrases,
    jsonLdEntities,

    crawledPages: pages.map((p) => p.url),
    meta: {
      crawledCount: pages.length,
      usedSitemap: sitemapUrls.length > 0,
      pickedFromHomeCount: pickedFromHome.length,
      sitemapCount: sitemapUrls.length,
    },
  };
}

export async function POST(req) {
  try {
    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const host = normalizeHost(domain);
    if (!host) {
      return NextResponse.json({ error: "invalid domain" }, { status: 400 });
    }

    const cacheKey = host;
    const TTL_MS = 30 * 60 * 1000;

    const cached = cacheGet(CACHE.profile, cacheKey);
    if (cached) return NextResponse.json(cached);

    const inflight = CACHE.inflight.get(cacheKey);
    if (inflight) {
      const value = await inflight;
      return NextResponse.json(value);
    }

    const p = computeSiteProfile(host)
      .then((value) => {
        cacheSet(CACHE.profile, cacheKey, value, TTL_MS);
        return value;
      })
      .finally(() => {
        CACHE.inflight.delete(cacheKey);
      });

    CACHE.inflight.set(cacheKey, p);

    const value = await p;
    return NextResponse.json(value);
  } catch (err) {
    console.error("/api/site/profile error:", err);
    return NextResponse.json({ error: "failed to profile site" }, { status: 200 });
  }
}
