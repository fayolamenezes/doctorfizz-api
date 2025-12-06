// src/lib/seo/ibm-nlu.js

const IBM_NLU_API_KEY = process.env.IBM_NLU_API_KEY;
const IBM_NLU_URL = process.env.IBM_NLU_URL;

if (!IBM_NLU_API_KEY || !IBM_NLU_URL) {
  console.warn("IBM_NLU_API_KEY or IBM_NLU_URL not set in .env.local");
}

/**
 * Analyze text with IBM Watson NLU
 * NOTE: Make sure IBM_NLU_URL points to your NLU instance base URL.
 *
 * @param {string} text
 */
export async function analyzeWithIbmNlu(text) {
  if (!text) throw new Error("analyzeWithIbmNlu: text is required");

  const url = `${IBM_NLU_URL}/v1/analyze?version=2021-08-01`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`apikey:${IBM_NLU_API_KEY}`).toString("base64"),
    },
    body: JSON.stringify({
      text,
      features: {
        entities: {},
        keywords: {},
        categories: {},
        sentiment: {},
        concepts: {},
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IBM NLU failed: ${res.status} - ${text}`);
  }

  const data = await res.json();

  return {
    ibmNlu: {
      entities: data.entities ?? [],
      keywords: data.keywords ?? [],
      categories: data.categories ?? [],
      sentiment: data.sentiment ?? null,
      concepts: data.concepts ?? [],
      raw: data,
    },
  };
}
