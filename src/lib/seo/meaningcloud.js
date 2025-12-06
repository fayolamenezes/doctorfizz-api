// src/lib/seo/meaningcloud.js

const MEANINGCLOUD_API_KEY = process.env.MEANINGCLOUD_API_KEY;

if (!MEANINGCLOUD_API_KEY) {
  console.warn("MEANINGCLOUD_API_KEY is not set in .env.local");
}

/**
 * Analyze text with MeaningCloud Topics API (as an example).
 * @param {string} text
 */
export async function analyzeWithMeaningCloud(text) {
  if (!text) throw new Error("analyzeWithMeaningCloud: text is required");

  const form = new URLSearchParams();
  form.append("key", MEANINGCLOUD_API_KEY);
  form.append("txt", text);
  form.append("lang", "en");

  const res = await fetch("https://api.meaningcloud.com/topics-2.0", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MeaningCloud failed: ${res.status} - ${txt}`);
  }

  const data = await res.json();

  return {
    meaningCloud: {
      concepts: data.concept_list ?? [],
      entities: data.entity_list ?? [],
      categories: data.category_list ?? [],
      raw: data,
    },
  };
}
