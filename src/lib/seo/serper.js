// src/lib/seo/serper.js

const SERPER_API_KEY = process.env.SERPER_API_KEY;

if (!SERPER_API_KEY) {
  console.warn("SERPER_API_KEY is not set in .env.local");
}

/**
 * Fetch SERP data from Serper.dev
 * @param {string} query - Keyword or search phrase
 */
export async function fetchSerp(query) {
  if (!query) throw new Error("fetchSerp: query is required");

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY,
    },
    body: JSON.stringify({
      q: query,
      // Tune these if you want (geo/lang)
      gl: "in", // country
      hl: "en", // language
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Serper.dev failed: ${res.status} - ${text}`);
  }

  const data = await res.json();

  // Derive SERP feature counts from Serper.dev payload
  const featuredSnippets = data.answerBox ? 1 : 0;
  const peopleAlsoAskCount = Array.isArray(data.peopleAlsoAsk)
    ? data.peopleAlsoAsk.length
    : 0;
  const imagePackCount = Array.isArray(data.images) ? data.images.length : 0;
  const videoResultsCount = Array.isArray(data.videos) ? data.videos.length : 0;
  const knowledgePanelCount = data.knowledgeGraph ? 1 : 0;

  const totalFeatureBlocks =
    (featuredSnippets > 0 ? 1 : 0) +
    (peopleAlsoAskCount > 0 ? 1 : 0) +
    (imagePackCount > 0 ? 1 : 0) +
    (videoResultsCount > 0 ? 1 : 0) +
    (knowledgePanelCount > 0 ? 1 : 0);

  const coveragePercent =
    totalFeatureBlocks > 0 ? Math.min(100, totalFeatureBlocks * 20) : 0;

  return {
    serp: {
      topResults: data.organic ?? [],
      peopleAlsoAsk: data.peopleAlsoAsk ?? [],
      relatedSearches: data.relatedSearches ?? [],
      raw: data, // optional, can remove later

      // Normalized SERP feature metrics for the dashboard
      serpFeatures: {
        coveragePercent,
        featuredSnippets,
        peopleAlsoAsk: peopleAlsoAskCount,
        imagePack: imagePackCount,
        videoResults: videoResultsCount,
        knowledgePanel: knowledgePanelCount,
      },
    },
  };
}
