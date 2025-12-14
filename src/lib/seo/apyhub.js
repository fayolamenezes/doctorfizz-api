// src/lib/seo/apyhub.js

import { fetchHtml } from "@/lib/seo/extraction";

const APYHUB_API_KEY = process.env.APYHUB_API_KEY;

if (!APYHUB_API_KEY) {
  console.warn("APYHUB_API_KEY is not set in .env.local");
}

function stripHtmlToText(html) {
  const safe = String(html || "");
  if (!safe) return "";

  // remove scripts/styles
  const noScripts = safe
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  // remove tags
  const text = noScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

async function postJson(url, body, { timeoutMs = 20000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    const text = await res.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }

    return { ok: res.ok, status: res.status, text, json };
  } catch (e) {
    return { ok: false, status: 0, text: e?.message || "fetch failed", json: null };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Extract clean text from a webpage using ApyHub (best-effort),
 * but ALWAYS fallback to local extraction if ApyHub fails.
 *
 * @param {string} url - absolute page URL
 */
export async function extractPageText(url) {
  if (!url) throw new Error("extractPageText: url is required");

  // If no key, skip ApyHub and fallback locally.
  if (!APYHUB_API_KEY) {
    const fetched = await fetchHtml(url);
    const localText = stripHtmlToText(fetched?.html || "");
    return {
      apyhub: {
        text: localText,
        raw: { provider: "local-fallback", reason: "missing APYHUB_API_KEY" },
      },
    };
  }

  // ApyHub endpoints are sometimes renamed. Try a small set safely.
  const endpointsToTry = [
    "https://api.apyhub.com/extract/text/webpage",
    "https://api.apyhub.com/extract/text/webpage/",
    // Some providers move resources under /utility or /v1 — keep optional probes:
    "https://api.apyhub.com/v1/extract/text/webpage",
    "https://api.apyhub.com/utility/extract/text/webpage",
  ];

  const headers = { "apy-token": APYHUB_API_KEY };

  for (const endpoint of endpointsToTry) {
    const attempt = await postJson(endpoint, { url }, { headers });

    if (attempt.ok) {
      const data = attempt.json ?? {};
      const text =
        (data?.data && typeof data.data === "string" ? data.data : "") ||
        (data?.text && typeof data.text === "string" ? data.text : "");

      // If API succeeded but returned empty, still fallback locally.
      if (text && text.trim()) {
        return {
          apyhub: {
            text: text.trim(),
            raw: { endpoint, response: data },
          },
        };
      }

      break; // endpoint exists but text empty → don't spam other endpoints
    }

    // If 404 route not found, try next endpoint
    if (attempt.status === 404) continue;

    // For non-404 errors (401/403/429/5xx), don’t hammer ApyHub.
    break;
  }

  // Local fallback (always succeeds if your fetchHtml works)
  const fetched = await fetchHtml(url);
  const localText = stripHtmlToText(fetched?.html || "");

  return {
    apyhub: {
      text: localText,
      raw: { provider: "local-fallback", reason: "apyhub_failed_or_empty" },
    },
  };
}
