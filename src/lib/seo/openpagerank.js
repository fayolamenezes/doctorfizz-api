// src/lib/seo/openpagerank.js

const OPENPAGERANK_API_KEY = process.env.OPENPAGERANK_API_KEY;

if (!OPENPAGERANK_API_KEY) {
  console.warn("OPENPAGERANK_API_KEY is not set in .env.local");
}

/**
 * Fetch domain authority-like metric from Open PageRank
 * @param {string} domain - e.g. "example.com"
 */
export async function fetchOpenPageRank(domain) {
  if (!domain) throw new Error("fetchOpenPageRank: domain is required");

  const url =
    "https://openpagerank.com/api/v1.0/getPageRank" +
    `?domains%5B0%5D=${encodeURIComponent(domain)}`;

  const res = await fetch(url, {
    headers: {
      "API-OPR": OPENPAGERANK_API_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenPageRank failed: ${res.status} - ${text}`);
  }

  const data = await res.json();
  const result = data.response && data.response[0];

  return {
    authority: {
      domain: result?.domain ?? domain,
      domainAuthority: result?.page_rank_integer ?? null,
      pageRankDecimal: result?.page_rank_decimal ?? null,
      raw: data,
    },
  };
}
