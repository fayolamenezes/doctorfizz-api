// src/lib/seo/dataforseo.js

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.warn(
    "DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD not set in .env.local"
  );
}

/**
 * Simple heuristic classifier for keyword intent.
 * Returns "Transactional" if the query suggests buying/comparing;
 * otherwise "Informational".
 */
function inferKeywordType(keyword) {
  const kw = (keyword || "").toLowerCase();

  const transactionalHints = [
    "buy",
    "price",
    "deal",
    "coupon",
    "discount",
    "best ",
    " top ",
    " vs ",
    " vs.",
    "compare",
    "comparison",
    "under ",
    "$",
    "near me",
  ];

  if (transactionalHints.some((hint) => kw.includes(hint))) {
    return "Transactional";
  }

  return "Informational";
}

/**
 * Build a nice human-readable suggested topic line for the keyword.
 * This is now a fallback only (when Content Generation API fails).
 */
function buildSuggestedTopic(keyword, type) {
  const kw = (keyword || "").trim();
  const lower = kw.toLowerCase();

  if (type === "Transactional") {
    return `${kw} – comparison & buyer's guide`;
  }

  if (lower.startsWith("how to") || lower.includes("fix")) {
    return `${kw} – step-by-step guide`;
  }

  if (lower.includes("tools") || lower.includes("software")) {
    return `${kw} – best tools & platforms`;
  }

  return `${kw} – complete guide`;
}

/**
 * Helper to normalize a "difficulty" value into a 0–100 percentage.
 * Some DataForSEO fields may be 0–1 or 0–100. We try to handle both.
 */
function normalizeDifficulty(raw, fallbackFromVolume) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw <= 1) return Math.round(raw * 100);
    if (raw <= 100) return Math.round(raw);
  }

  // If no difficulty from API, derive a simple heuristic from volume.
  if (typeof fallbackFromVolume === "number" && fallbackFromVolume > 0) {
    if (fallbackFromVolume >= 20000) return 80;
    if (fallbackFromVolume >= 10000) return 65;
    if (fallbackFromVolume >= 5000) return 55;
    if (fallbackFromVolume >= 2000) return 45;
    return 30;
  }

  return null;
}

/**
 * Safely convert any value to a number or null.
 */
function toNumber(val) {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "");
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Build an AI visibility matrix (ratings + pages) from
 * DataForSEO backlinks + SERP feature data.
 *
 * This is heuristic: we derive a 0–5 rating and an estimated
 * number of indexed/visible pages for each AI tool.
 */
function buildAiVisibilityMatrix(backlinksSummary, serpFeatures = {}) {
  const rank =
    typeof backlinksSummary?.rank === "number"
      ? backlinksSummary.rank
      : 50; // 0–100

  const coverage =
    typeof serpFeatures.coveragePercent === "number"
      ? serpFeatures.coveragePercent
      : 40; // 0–100

  const totalFeatures =
    (serpFeatures.featuredSnippets ?? 0) +
    (serpFeatures.peopleAlsoAsk ?? 0) +
    (serpFeatures.imagePack ?? 0) +
    (serpFeatures.videoResults ?? 0) +
    (serpFeatures.knowledgePanel ?? 0);

  // Compress total feature count into a 0–100 curve
  const featuresScore =
    totalFeatures > 0
      ? Math.min(
          100,
          (Math.log10(totalFeatures + 1) / Math.log10(100 + 1)) * 100
        )
      : 0;

  // Overall AI visibility 0–100
  const visibilityScore = 0.4 * rank + 0.4 * coverage + 0.2 * featuresScore;

  const baseRating = Math.max(0, Math.min(5, visibilityScore / 20)); // → 0–5

  const pagesBase =
    backlinksSummary?.crawled_pages ??
    backlinksSummary?.referring_domains ??
    100;

  const normalizePages = (mult) => {
    const raw = Number(pagesBase) * mult;
    if (!Number.isFinite(raw)) return Math.round(100 * mult);
    return Math.max(10, Math.round(raw));
  };

  const clampRating = (r) =>
    Math.max(0, Math.min(5, Number(r.toFixed(1))));

  return {
    GPT: {
      rating: clampRating(baseRating + 0.2),
      pages: normalizePages(0.9),
    },
    GoogleAI: {
      rating: clampRating(baseRating - 0.1),
      pages: normalizePages(0.8),
    },
    Perplexity: {
      rating: clampRating(baseRating + 0.1),
      pages: normalizePages(0.7),
    },
    Copilot: {
      rating: clampRating(baseRating - 0.2),
      pages: normalizePages(0.6),
    },
    Gemini: {
      rating: clampRating(baseRating - 0.3),
      pages: normalizePages(0.5),
    },
  };
}

/**
 * Call DataForSEO Content Generation API (generate_sub_topics)
 * for a list of keyword strings.
 *
 * We call the API ONCE PER KEYWORD to avoid the behaviour where only
 * the first task in a batch gets full results.
 *
 * @param {string[]} keywords
 * @param {string} auth - base64(login:password)
 * @returns {Promise<Record<string, string[]>>} map: keyword → [sub_topics]
 */
async function fetchSubtopicsForKeywords(keywords, auth) {
  if (!keywords || !keywords.length) return {};

  const map = {};

  for (const kw of keywords) {
    const payload = [
      {
        topic: kw,
        creativity_index: 0.7,
      },
    ];

    console.log("[DataForSEO] Subtopics payload (single):", payload);

    try {
      const res = await fetch(
        "https://api.dataforseo.com/v3/content_generation/generate_sub_topics/live",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      console.log(
        "[DataForSEO] Subtopics status for",
        kw,
        "=>",
        res.status
      );

      if (!res.ok) {
        const text = await res.text();
        console.error(
          "[DataForSEO] Subtopics FAILED for",
          kw,
          "=>",
          text
        );
        continue;
      }

      const json = await res.json();
      const tasks = Array.isArray(json.tasks) ? json.tasks : [];
      const task = tasks[0];
      const resultArr = Array.isArray(task?.result) ? task.result : [];
      const firstResult = resultArr[0];
      const subs = firstResult?.sub_topics;

      if (Array.isArray(subs) && subs.length > 0) {
        map[kw] = subs;
      } else {
        console.log(
          "[DataForSEO] No subtopics returned for",
          kw,
          "(using fallback)"
        );
      }
    } catch (err) {
      console.error(
        "[DataForSEO] Subtopics request threw error for",
        kw,
        err
      );
    }
  }

  console.log("[DataForSEO] Subtopics map (per keyword):", map);
  return map;
}

/**
 * DataForSEO helper
 *
 * 1) Backlinks Summary:
 *    POST https://api.dataforseo.com/v3/backlinks/summary/live
 *
 * 2) Domain Keywords (top queries for a site):
 *    POST https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live
 *
 * 3) SERP Advanced (for SERP Feature coverage, PER KEYWORD):
 *    POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
 *
 * 4) Content Generation – Subtopics (real topic ideas):
 *    POST https://api.dataforseo.com/v3/content_generation/generate_sub_topics/live
 *
 * Uses Basic Auth (username = API login, password = API password)
 *
 * Returns normalized output for /api/seo to merge into:
 *    dataForSeo.backlinksSummary
 *    dataForSeo.serpFeatures
 *    dataForSeo.serpItems
 *    dataForSeo.topKeywords
 *    seoRows            ← rows for "New on page SEO opportunity"
 *
 * @param {string} targetInput - domain or URL string
 * @param {object} options - { language_code, countryCode, depth, maxKeywords }
 */
export async function fetchDataForSeo(targetInput, options = {}) {
  console.log("[DataForSEO] Starting backlinks + SERP fetch…");

  const login = DATAFORSEO_LOGIN;
  const password = DATAFORSEO_PASSWORD;

  console.log("[DataForSEO] Login loaded:", !!login);
  console.log("[DataForSEO] Password loaded:", !!password);

  if (!login || !password) {
    throw new Error(
      "DataForSEO credentials missing. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env.local"
    );
  }

  const originalTarget = (targetInput || "").toString().trim();

  // Normalize target domain for backlinks + domain keywords
  const target = originalTarget
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");

  console.log("[DataForSEO] Target domain for backlinks:", target);

  if (!target) {
    throw new Error("fetchDataForSeo: target domain is empty");
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  // ============================
  // 1) BACKLINKS SUMMARY
  // ============================

  const backlinksPayload = [
    {
      target,
      internal_list_limit: 10,
      include_subdomains: true,
      backlinks_status_type: "all",
    },
  ];

  console.log("[DataForSEO] Backlinks payload:", backlinksPayload);

  const backlinksRes = await fetch(
    "https://api.dataforseo.com/v3/backlinks/summary/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backlinksPayload),
    }
  );

  console.log("[DataForSEO] Backlinks response status:", backlinksRes.status);

  if (!backlinksRes.ok) {
    const text = await backlinksRes.text();
    console.error("[DataForSEO] Backlinks FAILED:", text);
    throw new Error(
      `DataForSEO Backlinks API failed: ${backlinksRes.status} - ${text}`
    );
  }

  const backlinksData = await backlinksRes.json();

  console.log("[DataForSEO] Raw backlinks API response:", backlinksData);

  const backlinksTask = Array.isArray(backlinksData.tasks)
    ? backlinksData.tasks[0]
    : null;
  const backlinksSummary =
    backlinksTask &&
    Array.isArray(backlinksTask.result) &&
    backlinksTask.result[0]
      ? backlinksTask.result[0]
      : null;

  if (!backlinksSummary) {
    console.warn("[DataForSEO] No backlinks summary found in result.");
  } else {
    console.log("[DataForSEO] Extracted backlinks summary:", backlinksSummary);
  }

  // ============================
  // 2) DOMAIN KEYWORDS
  // ============================

  const {
    language_code = "en",
    countryCode = "in",
    depth = 10,
    maxKeywords = 5,
  } = options || {};

  const location_name =
    countryCode.toLowerCase() === "in" ? "India" : "United States";

  const keywordsPayload = [
    {
      target,
      language_code,
      location_name,
      limit: maxKeywords,
    },
  ];

  console.log("[DataForSEO] Domain keywords payload:", keywordsPayload);

  let topKeywords = [];
  let seoRows = [];

  try {
    const kwRes = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(keywordsPayload),
      }
    );

    console.log("[DataForSEO] Domain keywords status:", kwRes.status);

    if (!kwRes.ok) {
      const text = await kwRes.text();
      console.error("[DataForSEO] Domain keywords FAILED:", text);
    } else {
      const kwJson = await kwRes.json();
      const kwTask = Array.isArray(kwJson.tasks) ? kwJson.tasks[0] : null;
      const kwResult =
        kwTask && Array.isArray(kwTask.result) && kwTask.result[0]
          ? kwTask.result[0]
          : null;

      const items = kwResult?.items || [];

      // First, build base keyword rows (no suggested topic yet)
      topKeywords = items
        .map((item) => {
          // keyword text
          const kw =
            item.keyword ||
            item.keyword_data?.keyword ||
            item.keyword_info?.keyword ||
            null;

          if (!kw) return null;

          // search volume: handle all possible locations + ensure it's numeric
          const volRaw =
            item.search_volume ??
            item.keyword_data?.search_volume ??
            item.keyword_info?.search_volume ??
            item.keyword_data?.keyword_info?.search_volume ??
            item.metrics?.search_volume ??
            null;

          const searchVolume = toNumber(volRaw) ?? 0;

          // difficulty / competition – normalize to 0–100
          const rawDifficulty =
            item.keyword_info?.competition ??
            item.keyword_data?.keyword_info?.competition ??
            item.keyword_data?.competition ??
            item.competition ??
            null;

          const difficulty =
            normalizeDifficulty(toNumber(rawDifficulty), searchVolume) ?? 30;

          const type = inferKeywordType(kw);

          return {
            keyword: kw,
            type, // "Informational" | "Transactional"

            // search volume
            searchVolume,
            volume: searchVolume,

            // difficulty
            difficulty,
            seoDifficulty: difficulty,
          };
        })
        .filter(Boolean)
        .slice(0, maxKeywords);

      console.log("[DataForSEO] Base domain keywords:", topKeywords);

      // === fetch REAL suggested topics via Content Generation API ===
      const keywordStrings = topKeywords.map((k) => k.keyword);
      const subtopicsByKeyword = await fetchSubtopicsForKeywords(
        keywordStrings,
        auth
      );

      // Attach suggested topic (first subtopic or fallback heuristic)
      topKeywords = topKeywords.map((row) => {
        const subs = subtopicsByKeyword[row.keyword];
        const suggestedFromApi =
          Array.isArray(subs) && subs.length > 0 ? subs[0] : null;
        const fallbackSuggested = buildSuggestedTopic(
          row.keyword,
          row.type
        );
        const suggested = suggestedFromApi || fallbackSuggested;

        return {
          ...row,
          suggested, // primary field used by table
          suggestedTopic: suggested,
          topic: suggested,
        };
      });

      // For now, seoRows is the same as topKeywords.
      seoRows = topKeywords;

      console.log("[DataForSEO] Domain keywords with topics:", topKeywords);
    }
  } catch (err) {
    console.error("[DataForSEO] Domain keywords request threw error:", err);
  }

  // Fallback: if no domain keywords, at least analyze the domain string once
  const keywordsForSerp =
    topKeywords.length > 0
      ? topKeywords.map((k) => k.keyword)
      : [target];

  // ============================
  // 3) SERP ADVANCED PER KEYWORD
  // ============================

  let serpFeatures = {
    coveragePercent: 0,
    featuredSnippets: 0,
    peopleAlsoAsk: 0,
    imagePack: 0,
    videoResults: 0,
    knowledgePanel: 0,
  };
  let serpItems = [];
  let serpRaw = []; // store each SERP response for debugging

  let totalFeaturedSnippets = 0;
  let totalPeopleAlsoAsk = 0;
  let totalImagePack = 0;
  let totalVideoResults = 0;
  let totalKnowledgePanel = 0;
  let keywordsWithAnyFeature = 0;
  let keywordCount = 0;

  for (const kw of keywordsForSerp) {
    if (!kw) continue;

    const serpPayload = [
      {
        keyword: kw,
        language_code,
        location_name,
        depth,
        device: "desktop",
      },
    ];

    console.log("[DataForSEO] SERP payload (single keyword):", serpPayload);

    try {
      const serpRes = await fetch(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(serpPayload),
        }
      );

      console.log("[DataForSEO] SERP response status:", serpRes.status);

      if (!serpRes.ok) {
        const text = await serpRes.text();
        console.error(
          "[DataForSEO] SERP FAILED for keyword",
          kw,
          "=>",
          text
        );
        continue;
      }

      const serpJson = await serpRes.json();
      serpRaw.push(serpJson);

      console.log(
        "[DataForSEO] Raw SERP API response (keyword):",
        kw,
        serpJson
      );

      const tasks = Array.isArray(serpJson.tasks) ? serpJson.tasks : [];
      const task0 = tasks[0];
      const resultArr =
        task0 && Array.isArray(task0.result) ? task0.result : [];
      const firstResult = resultArr[0];
      const items = firstResult?.items || [];

      if (!items.length) continue;

      keywordCount += 1;
      serpItems.push(...items);

      const hasFeature = (item, featureName) => {
        const type = item?.type;
        const features = item?.serp_features;
        return (
          type === featureName ||
          (Array.isArray(features) && features.includes(featureName))
        );
      };

      const countFeature = (featureName) =>
        items.filter((i) => hasFeature(i, featureName)).length;

      const featuredSnippets = countFeature("featured_snippet");
      const peopleAlsoAsk = countFeature("people_also_ask");
      const imagePack =
        countFeature("images") +
        countFeature("image_search") +
        countFeature("image_pack");
      const videoResults =
        countFeature("videos") + countFeature("video");
      const knowledgePanel =
        countFeature("knowledge_graph") +
        countFeature("knowledge_panel");

      const hasAny =
        featuredSnippets ||
        peopleAlsoAsk ||
        imagePack ||
        videoResults ||
        knowledgePanel;

      if (hasAny) {
        keywordsWithAnyFeature += 1;
      }

      totalFeaturedSnippets += featuredSnippets;
      totalPeopleAlsoAsk += peopleAlsoAsk;
      totalImagePack += imagePack;
      totalVideoResults += videoResults;
      totalKnowledgePanel += knowledgePanel;
    } catch (err) {
      console.error(
        "[DataForSEO] SERP request threw error for keyword:",
        kw,
        err
      );
    }
  }

  const coveragePercent =
    keywordCount > 0
      ? Math.round((keywordsWithAnyFeature / keywordCount) * 100)
      : 0;

  serpFeatures = {
    coveragePercent,
    featuredSnippets: totalFeaturedSnippets,
    peopleAlsoAsk: totalPeopleAlsoAsk,
    imagePack: totalImagePack,
    videoResults: totalVideoResults,
    knowledgePanel: totalKnowledgePanel,
  };

  console.log("[DataForSEO] Extracted SERP features:", serpFeatures);

  // ============================
  // AI VISIBILITY MATRIX (AI SEO Matrix)
  // ============================

  const aiTools = buildAiVisibilityMatrix(backlinksSummary, serpFeatures);
  console.log("[DataForSEO] AI visibility matrix:", aiTools);

  // ============================
  // FINAL NORMALIZED RETURN
  // ============================

  return {
    dataForSeo: {
      keyword: target,
      backlinksSummary,
      serpFeatures,
      serpItems,
      topKeywords,
      aiTools,
      raw: {
        backlinks: backlinksData,
        serp: serpRaw,
      },
    },
    // For "New on page SEO opportunity" table
    seoRows,
  };
}
