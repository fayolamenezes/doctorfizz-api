// src/lib/seo/apyhub.js

const APYHUB_API_KEY = process.env.APYHUB_API_KEY;

if (!APYHUB_API_KEY) {
  console.warn("APYHUB_API_KEY is not set in .env.local");
}

/**
 * Extract clean text from a webpage using ApyHub
 * @param {string} url - page URL
 */
export async function extractPageText(url) {
  if (!url) throw new Error("extractPageText: url is required");

  const res = await fetch("https://api.apyhub.com/extract/text/webpage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apy-token": APYHUB_API_KEY,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ApyHub extractor failed: ${res.status} - ${text}`);
  }

  const data = await res.json();

  return {
    apyhub: {
      text: data.data || data.text || "",
      raw: data,
    },
  };
}
