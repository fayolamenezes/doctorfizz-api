// src/lib/seo/extraction.js
import { extractPageText } from "@/lib/seo/apyhub";

// ---------------------------
// Small helpers
// ---------------------------
export function safeTrim(s, max = 140) {
  const x = (s || "").toString().trim();
  if (!x) return "";
  return x.length > max ? x.slice(0, max - 1) + "…" : x;
}

export function decodeHtmlEntities(str = "") {
  return String(str)
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

export async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DoctorFizzBot/1.0; +https://example.com)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  const html = await res.text().catch(() => "");
  return {
    ok: res.ok,
    status: res.status,
    html,
    finalUrl: res.url || url,
    headers: Object.fromEntries(res.headers?.entries?.() || []),
  };
}

export function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  return decodeHtmlEntities(m[1].replace(/\s+/g, " ").trim());
}

export function extractMetaDescription(html) {
  const m = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );
  if (!m) return "";
  return decodeHtmlEntities(m[1].replace(/\s+/g, " ").trim());
}

/**
 * Build the same “card” you currently return from /opportunities.
 * Returns: { url, title, description, wordCount }
 */
export async function buildOpportunityCard(url) {
  let html = "";
  let title = "";
  let description = "";

  try {
    const fetched = await fetchHtml(url);
    html = fetched.html || "";
    title = extractTitle(html);
    description = extractMetaDescription(html);
  } catch {
    // ignore
  }

  let wordCount = 0;
  try {
    const extracted = await extractPageText(url);
    const text = extracted?.apyhub?.text || "";
    wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  } catch {
    wordCount = 0;
  }

  const fallbackFromPath =
    decodeHtmlEntities(
      new URL(url).pathname
        .split("/")
        .filter(Boolean)
        .slice(-1)[0]
        ?.replace(/[-_]/g, " ")
        ?.trim() || ""
    ) || "Untitled";

  const cleanTitle = title || fallbackFromPath;

  return {
    url,
    title: safeTrim(cleanTitle, 70),
    description: safeTrim(description || "", 110),
    wordCount,
  };
}
