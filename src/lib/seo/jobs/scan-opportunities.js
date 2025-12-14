// src/lib/seo/jobs/scan-opportunities.js
import {
  discoverOpportunitiesUrls,
  normalizeToHttps,
  getHostname,
} from "@/lib/seo/discovery";
import {
  createScan,
  completeScan,
  failScan,
  upsertOpportunitiesSnapshot,
  // OPTIONAL (if you have it): getLatestOpportunities
  // getLatestOpportunities,
} from "@/lib/seo/snapshots.store";

/**
 * In-flight dedupe (module-level, survives within a single Node process).
 * Keyed by hostname + allowSubdomains + mode.
 *
 * NOTE:
 * - This prevents repeated scans from React StrictMode / re-renders / multi-calls.
 * - If you're running multiple server instances, you still need store-level dedupe
 *   (in snapshots.store). This is still a big improvement.
 */
const IN_FLIGHT = new Map();

function makeInFlightKey({ hostname, allowSubdomains, mode }) {
  return `opportunities|${hostname}|sub=${allowSubdomains ? 1 : 0}|mode=${mode}`;
}

export function enqueueOpportunitiesScan({
  websiteUrl,
  allowSubdomains = false,
} = {}) {
  const normalized = normalizeToHttps(websiteUrl);
  const hostname = getHostname(normalized);
  if (!normalized || !hostname) throw new Error("Invalid websiteUrl");

  const mode = "published";
  const key = makeInFlightKey({ hostname, allowSubdomains, mode });

  // ✅ If a scan is already running/queued in this process, return it and DO NOT start another.
  const existing = IN_FLIGHT.get(key);
  if (existing?.scanId && (existing.status === "queued" || existing.status === "running")) {
    return existing;
  }

  // Create a new scan record (your existing store function)
  const scan = createScan({
    kind: "opportunities",
    websiteUrl: normalized,
    hostname,
    allowSubdomains,
    mode,
  });

  // ✅ Write an immediate snapshot so the API route can return "cached" while scanning.
  // This prevents the route from thinking "no cached snapshot exists" and re-enqueuing.
  upsertOpportunitiesSnapshot(hostname, {
    scanId: scan.scanId,
    status: "queued",
    mode,
    allowSubdomains,
    diagnostics: { stage: "queued" },
    blogs: [],
    pages: [],
  });

  // track in-flight
  IN_FLIGHT.set(key, { ...scan, status: "queued" });

  // best-effort fire-and-forget
  runOpportunitiesScan({
    inFlightKey: key,
    scanId: scan.scanId,
    websiteUrl: normalized,
    allowSubdomains,
    mode,
  }).catch(() => {});

  return scan;
}

async function runOpportunitiesScan({
  inFlightKey,
  scanId,
  websiteUrl,
  allowSubdomains,
  mode,
}) {
  const hostname = getHostname(websiteUrl);

  // ✅ mark running early (so API can return cached instead of enqueue again)
  try {
    upsertOpportunitiesSnapshot(hostname, {
      scanId,
      status: "running",
      mode,
      allowSubdomains,
      diagnostics: { stage: "discovery" },
      blogs: [],
      pages: [],
    });
    IN_FLIGHT.set(inFlightKey, { scanId, status: "running" });
  } catch {
    // ignore snapshot write errors
  }

  try {
    const discovery = await discoverOpportunitiesUrls({
      websiteUrl,
      allowSubdomains,
      crawlFallbackFn: simpleCrawlFallback,
    });

    // update stage
    try {
      upsertOpportunitiesSnapshot(hostname, {
        scanId,
        status: "running",
        mode,
        allowSubdomains,
        diagnostics: { ...discovery?.diagnostics, stage: "fetch-meta" },
        blogs: [],
        pages: [],
      });
    } catch {}

    const blogMeta = await fetchManyMeta(
      discovery.blogUrls,
      hostname,
      allowSubdomains
    );
    const pageMeta = await fetchManyMeta(
      discovery.pageUrls,
      hostname,
      allowSubdomains
    );

    // ✅ complete snapshot
    upsertOpportunitiesSnapshot(hostname, {
      scanId,
      status: "complete",
      diagnostics: discovery.diagnostics,
      mode,
      allowSubdomains,
      blogs: blogMeta,
      pages: pageMeta,
    });

    completeScan(scanId, {
      hostname,
      diagnostics: discovery.diagnostics,
    });

    IN_FLIGHT.set(inFlightKey, { scanId, status: "complete" });

    // clean up shortly after completion
    setTimeout(() => IN_FLIGHT.delete(inFlightKey), 30_000).unref?.();
  } catch (err) {
    // ✅ mark failed snapshot too (important: otherwise API sees "no cache" and enqueues again)
    try {
      upsertOpportunitiesSnapshot(hostname, {
        scanId,
        status: "failed",
        mode,
        allowSubdomains,
        diagnostics: { error: err?.message || "scan failed", stage: "failed" },
        blogs: [],
        pages: [],
      });
    } catch {}

    failScan(scanId, { error: err?.message || "scan failed" });
    IN_FLIGHT.set(inFlightKey, { scanId, status: "failed" });

    setTimeout(() => IN_FLIGHT.delete(inFlightKey), 30_000).unref?.();
  }
}

// ---------------------------
// Minimal controlled crawl fallback
// ---------------------------
async function simpleCrawlFallback(
  hostname,
  { maxCrawlPages = 60, allowSubdomains = false } = {}
) {
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

      try {
        const h = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
        if (h !== hostname && !(allowSubdomains && h.endsWith(`.${hostname}`)))
          continue;
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
    )
      continue;

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

  const seen = new Set();
  return metas.filter((m) => {
    if (seen.has(m.url)) return false;
    seen.add(m.url);
    return true;
  });
}

async function fetchMeta(url, hostname, allowSubdomains) {
  // host check
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (h !== hostname && !(allowSubdomains && h.endsWith(`.${hostname}`)))
      return null;
  } catch {
    return null;
  }

  const res = await safeFetch(url, { timeoutMs: 15000 });
  if (!res || !res.ok) return null;

  const html = await res.text().catch(() => "");
  if (!html) return null;

  const title = extractTitle(html) || url;
  const description = extractMetaDescription(html) || "";
  const wordCount = estimateWordCount(html);

  return { url, title, description, wordCount, isDraft: false };
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
