// src/lib/seo/jobs/scan-opportunities.js
import { discoverOpportunitiesUrls, normalizeToHttps, getHostname } from "@/lib/seo/discovery";
import { createScan, completeScan, failScan, upsertOpportunitiesSnapshot } from "@/lib/seo/snapshots.store";

export function enqueueOpportunitiesScan({ websiteUrl, allowSubdomains = false } = {}) {
  const normalized = normalizeToHttps(websiteUrl);
  const hostname = getHostname(normalized);
  if (!normalized || !hostname) {
    throw new Error("Invalid websiteUrl");
  }

  const scan = createScan({
    kind: "opportunities",
    websiteUrl: normalized,
    hostname,
    allowSubdomains,
  });

  // Fire-and-forget (works in dev / long-lived node runtime).
  // If you deploy serverless, replace this with a real queue/worker.
  runOpportunitiesScan({ scanId: scan.scanId, websiteUrl: normalized, allowSubdomains }).catch(() => {});
  return scan;
}

async function runOpportunitiesScan({ scanId, websiteUrl, allowSubdomains }) {
  try {
    const hostname = getHostname(websiteUrl);

    const discovery = await discoverOpportunitiesUrls({
      websiteUrl,
      allowSubdomains,
      crawlFallbackFn: simpleCrawlFallback,
    });

    const blogMeta = await fetchManyMeta(discovery.blogUrls, hostname, allowSubdomains);
    const pageMeta = await fetchManyMeta(discovery.pageUrls, hostname, allowSubdomains);

    upsertOpportunitiesSnapshot(hostname, {
      scanId,
      status: "complete",
      diagnostics: discovery.diagnostics,
      blogs: blogMeta,
      pages: pageMeta,
    });

    completeScan(scanId, {
      hostname,
      diagnostics: discovery.diagnostics,
    });
  } catch (err) {
    failScan(scanId, { error: err?.message || "scan failed" });
  }
}

// ---------------------------
// Minimal controlled crawl fallback
// ---------------------------
async function simpleCrawlFallback(hostname, { maxCrawlPages = 60, allowSubdomains = false } = {}) {
  const seed = `https://${hostname}/`;
  const visited = new Set();
  const queue = [seed];
  const results = [];

  while (queue.length && visited.size < maxCrawlPages) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    const res = await safeFetch(url, { timeoutMs: 12000 });
    if (!res?.ok) continue;

    const html = await res.text().catch(() => "");
    if (!html) continue;

    results.push(url);

    const links = extractLinks(html, url);
    for (const link of links) {
      if (!link) continue;
      if (visited.has(link)) continue;

      // keep only same hostname unless allowSubdomains
      try {
        const h = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
        if (h !== hostname && !(allowSubdomains && h.endsWith(`.${hostname}`))) continue;
      } catch {
        continue;
      }

      queue.push(link);
      if (queue.length > maxCrawlPages * 4) break;
    }
  }

  return results;
}

function extractLinks(html, baseUrl) {
  const out = [];
  const matches = html.matchAll(/href\s*=\s*["']([^"']+)["']/gi);
  for (const m of matches) {
    const href = (m[1] || "").trim();
    if (!href) continue;
    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) continue;

    try {
      out.push(new URL(href, baseUrl).toString());
    } catch {}
  }
  return out;
}

// ---------------------------
// Fetch + meta extraction
// ---------------------------
async function fetchManyMeta(urls, hostname, allowSubdomains) {
  const uniq = Array.from(new Set((urls || []).filter(Boolean)));

  const metas = [];
  for (const u of uniq) {
    const meta = await fetchMeta(u, hostname, allowSubdomains);
    if (meta) metas.push(meta);
  }

  // If we still have duplicates, dedupe by URL
  const seen = new Set();
  return metas.filter((m) => {
    if (seen.has(m.url)) return false;
    seen.add(m.url);
    return true;
  });
}

async function fetchMeta(url, hostname, allowSubdomains) {
  // safety: host check again
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (h !== hostname && !(allowSubdomains && h.endsWith(`.${hostname}`))) return null;
  } catch {
    return null;
  }

  const res = await safeFetch(url, { timeoutMs: 15000 });

  // ✅ DO NOT SAVE 404/500 titles into “blogs”
  if (!res || !res.ok) return null;

  const html = await res.text().catch(() => "");
  if (!html) return null;

  const title = extractTitle(html) || url;
  const description = extractMetaDescription(html) || "";
  const wordCount = estimateWordCount(html);

  return { url, title, description, wordCount };
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeHtml(m[1]).trim() : "";
}

function extractMetaDescription(html) {
  const m =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  return m ? decodeHtml(m[1]).trim() : "";
}

function estimateWordCount(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ---------------------------
// Fetch with timeout
// ---------------------------
async function safeFetch(url, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": "DoctorFizzBot/1.0 (+https://example.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
