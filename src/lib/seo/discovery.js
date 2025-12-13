// src/lib/seo/discovery.js

// ---------------------------
// URL / filtering helpers
// ---------------------------
export function normalizeToHttps(input) {
  const raw = (input || "").toString().trim();
  if (!raw) return "";
  try {
    return new URL(raw).toString();
  } catch {
    try {
      return new URL(`https://${raw}`).toString();
    } catch {
      return "";
    }
  }
}

export function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * allowSubdomains=false:
 *   only exact hostname match (after stripping "www.")
 *
 * allowSubdomains=true:
 *   allow host === hostname OR host endsWith(`.${hostname}`)
 */
function isAllowedHost(url, hostname, allowSubdomains) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (h === hostname) return true;
    if (!allowSubdomains) return false;
    return h.endsWith(`.${hostname}`);
  } catch {
    return false;
  }
}

function looksLikeAsset(u) {
  const s = (u || "").toLowerCase();
  return (
    s.includes("/wp-content/") ||
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".svg") ||
    s.endsWith(".pdf") ||
    s.endsWith(".css") ||
    s.endsWith(".js") ||
    s.endsWith(".ico") ||
    s.endsWith(".json") ||
    s.endsWith(".xml")
  );
}

function stripTracking(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    const toDelete = [];
    u.searchParams.forEach((_, k) => {
      const key = k.toLowerCase();
      if (
        key.startsWith("utm_") ||
        key === "gclid" ||
        key === "fbclid" ||
        key === "msclkid"
      ) {
        toDelete.push(k);
      }
    });
    toDelete.forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}

function isJunkPath(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const junk = [
      "/wp-admin",
      "/wp-login",
      "/cart",
      "/checkout",
      "/my-account",
      "/account",
      "/login",
      "/signup",
      "/register",
      "/search",
      "/feed",
      "/amp",
    ];
    return junk.some((x) => p.includes(x));
  } catch {
    return false;
  }
}

// ---------------------------
// Sitemap type detection
// ---------------------------
function classifySitemapUrl(childSitemapUrl) {
  const s = (childSitemapUrl || "").toLowerCase();

  const ignoreHints = [
    "category-sitemap",
    "tag-sitemap",
    "author-sitemap",
    "archive-sitemap",
    "attachment-sitemap",
    "media-sitemap",
    "image-sitemap",
    "video-sitemap",
    "product-sitemap",
    "portfolio-sitemap",
    "elements",
    "elementor",
    "elementskit",
    "hf-sitemap",
    "taxonomy",
  ];
  if (ignoreHints.some((h) => s.includes(h))) return "ignore";

  const pageHints = [
    "page-sitemap",
    "post_type-page",
    "posttype-page",
    "pages-sitemap",
  ];
  if (pageHints.some((h) => s.includes(h))) return "page";

  const blogHints = [
    "post-sitemap",
    "post_type-post",
    "posttype-post",
    "posts-sitemap",
    "blog-sitemap",
    "article-sitemap",
    "articles-sitemap",
    "news-sitemap",
    "insights-sitemap",
  ];
  if (blogHints.some((h) => s.includes(h))) return "blog";

  return "unknown";
}

/**
 * Crawl heuristic:
 * - listing pages like /blog are NOT posts
 * - deeper /blog/... look like posts
 */
function heuristicUrlType(url) {
  const p = new URL(url).pathname.toLowerCase();

  // listing roots
  if (
    p === "/blog" ||
    p === "/blog/" ||
    p === "/blogs" ||
    p === "/blogs/" ||
    p === "/news" ||
    p === "/news/" ||
    p === "/insights" ||
    p === "/insights/" ||
    p === "/articles" ||
    p === "/articles/"
  ) {
    return "page";
  }

  // post-ish paths
  const blogPathHints = [
    "/blog/",
    "/blogs/",
    "/post/",
    "/posts/",
    "/news/",
    "/articles/",
    "/insights/",
  ];
  if (blogPathHints.some((h) => p.includes(h))) return "blog";

  return "page";
}

// ---------------------------
// Sitemap parsing
// ---------------------------
function extractLocsFromXml(xml) {
  return Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/gi))
    .map((m) => (m[1] || "").trim())
    .filter(Boolean);
}

async function getSitemapTypedUrls(siteUrl) {
  const base = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
  const candidates = [`${base}/sitemap_index.xml`, `${base}/sitemap.xml`];

  for (const sm of candidates) {
    try {
      const r = await fetch(sm, { redirect: "follow" });
      if (!r.ok) continue;

      const xml = await r.text();
      const locs = extractLocsFromXml(xml);

      const isIndex = xml.toLowerCase().includes("<sitemapindex");
      const isUrlset = xml.toLowerCase().includes("<urlset");

      if (isIndex && locs.length) {
        const out = [];

        for (const child of locs.slice(0, 50)) {
          const childType = classifySitemapUrl(child);
          if (childType === "ignore") continue;

          try {
            const rr = await fetch(child, { redirect: "follow" });
            if (!rr.ok) continue;
            const childXml = await rr.text();
            const urls = extractLocsFromXml(childXml);

            for (const u of urls) {
              out.push({
                url: u,
                type: childType,
                sourceSitemap: child,
              });
            }
          } catch {
            // ignore child
          }
        }

        if (out.length) return out;
      }

      if (isUrlset && locs.length) {
        return locs.map((u) => ({
          url: u,
          type: "unknown",
          sourceSitemap: sm,
        }));
      }
    } catch {
      // ignore and try next
    }
  }

  return [];
}

function pickTypedTopN(items, hostname, n, kind, allowSubdomains) {
  const cleaned = items
    .filter((it) => it?.url)
    .map((it) => ({ ...it, url: stripTracking(it.url) }))
    .filter((it) => it.url && !looksLikeAsset(it.url))
    .filter((it) => isAllowedHost(it.url, hostname, allowSubdomains))
    .filter((it) => !isJunkPath(it.url))
    .map((it) => {
      const path = new URL(it.url).pathname;
      return { ...it, depth: path.split("/").filter(Boolean).length };
    });

  const filtered = cleaned.filter((it) => it.type === kind);

  // prefer deeper for blogs (posts), shallower for pages
  filtered.sort((a, b) => (kind === "blog" ? b.depth - a.depth : a.depth - b.depth));

  // dedupe
  const out = [];
  const seen = new Set();
  for (const it of filtered) {
    if (!seen.has(it.url)) {
      seen.add(it.url);
      out.push(it.url);
    }
    if (out.length >= n) break;
  }
  return out;
}

/**
 * Try a set of common blog listing paths and scrape links out of them.
 * IMPORTANT: only returns URLs that look like real posts (heuristicUrlType === "blog")
 * and only within the allowed host set.
 */
async function expandFromCommonBlogIndexes({ baseUrl, hostname, allowSubdomains }) {
  const candidates = [
    "/blog/",
    "/blogs/",
    "/news/",
    "/insights/",
    "/articles/",
  ].map((p) => new URL(p, baseUrl).toString());

  const all = [];

  for (const idx of candidates) {
    try {
      const r = await fetch(idx, { redirect: "follow" });
      if (!r.ok) continue;

      const html = await r.text();

      // href="..." or href='...'
      const rawLinks = Array.from(html.matchAll(/href\s*=\s*["']([^"']+)["']/gi))
        .map((m) => (m[1] || "").trim())
        .filter(Boolean);

      for (const href of rawLinks) {
        if (
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href.startsWith("javascript:")
        ) {
          continue;
        }

        let abs;
        try {
          abs = new URL(href, idx).toString();
        } catch {
          continue;
        }

        abs = stripTracking(abs);
        if (!abs) continue;
        if (looksLikeAsset(abs)) continue;
        if (isJunkPath(abs)) continue;
        if (!isAllowedHost(abs, hostname, allowSubdomains)) continue;
        if (heuristicUrlType(abs) !== "blog") continue;

        all.push(abs);
      }
    } catch {
      // ignore index fetch failure
    }
  }

  return Array.from(new Set(all));
}

// ---------------------------
// Main discovery entry
// ---------------------------
export async function discoverOpportunitiesUrls({
  websiteUrl,
  crawlFallbackFn,
  maxCrawlPages = 60,
  limitPagesResult = 200,
  allowSubdomains = false,
} = {}) {
  const normalized = normalizeToHttps(websiteUrl);
  const hostname = getHostname(normalized);
  if (!hostname) throw new Error("Invalid websiteUrl");

  // 1) Sitemap discovery
  const typedFromSitemap = await getSitemapTypedUrls(normalized);

  const sitemapTyped = typedFromSitemap.map((it) =>
    it.type === "unknown" ? { ...it, type: heuristicUrlType(it.url) } : it
  );

  let blogUrls = pickTypedTopN(sitemapTyped, hostname, 2, "blog", allowSubdomains);
  let pageUrls = pickTypedTopN(sitemapTyped, hostname, 4, "page", allowSubdomains).slice(0, 2);

  const needsFallback =
    sitemapTyped.length === 0 || blogUrls.length < 2 || pageUrls.length < 2;

  let crawlUrls = [];
  if (needsFallback && typeof crawlFallbackFn === "function") {
    crawlUrls = await crawlFallbackFn(hostname, {
      maxCrawlPages,
      limitPagesResult,
      allowSubdomains,
    });

    const crawlTyped = Array.from(new Set(crawlUrls))
      .map(stripTracking)
      .filter(Boolean)
      .filter((u) => !looksLikeAsset(u))
      .filter((u) => !isJunkPath(u))
      .filter((u) => isAllowedHost(u, hostname, allowSubdomains))
      .map((u) => ({
        url: u,
        type: heuristicUrlType(u),
        sourceSitemap: "crawl",
      }));

    if (blogUrls.length < 2) {
      const moreBlogs = pickTypedTopN(crawlTyped, hostname, 20, "blog", allowSubdomains);
      blogUrls = Array.from(new Set([...blogUrls, ...moreBlogs])).slice(0, 2);
    }

    if (pageUrls.length < 2) {
      const morePages = pickTypedTopN(crawlTyped, hostname, 20, "page", allowSubdomains);
      pageUrls = Array.from(new Set([...pageUrls, ...morePages])).slice(0, 2);
    }
  }

  // 2) If we still don’t have blogs, try expanding from common blog index pages
  // ✅ IMPORTANT: if still none, we keep blogUrls=[], we do NOT force a 404 blog URL.
  if (blogUrls.length < 2) {
    const expanded = await expandFromCommonBlogIndexes({
      baseUrl: normalized,
      hostname,
      allowSubdomains,
    });
    blogUrls = Array.from(new Set([...blogUrls, ...expanded])).slice(0, 2);
  }

  blogUrls = Array.from(new Set(blogUrls)).slice(0, 2);
  pageUrls = pageUrls.filter((u) => !blogUrls.includes(u)).slice(0, 2);

  return {
    hostname,
    blogUrls,
    pageUrls,
    diagnostics: {
      sitemapTypedCount: sitemapTyped.length,
      crawlFound: crawlUrls.length,
      usedFallback: needsFallback,
      blogCount: blogUrls.length,
      pageCount: pageUrls.length,
      picked: { blogUrls, pageUrls },
      allowSubdomains,
    },
  };
}
