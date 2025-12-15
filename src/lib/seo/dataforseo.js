// src/lib/seo/dataforseo.js

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.warn("DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD not set in .env.local");
}

/* ============================================================================
   Tiny in-memory cache + in-flight dedupe (per Node process)
   - Prevents duplicate calls when dev/route triggers twice
   - TTL keeps responses fresh enough for your UI
============================================================================ */

const g = globalThis;

if (!g.__dataforseoCache) {
  g.__dataforseoCache = {
    // key -> { expiresAt, value }
    seo: new Map(),
    // key -> Promise
    inflightSeo: new Map(),

    // keyword -> { expiresAt, value: string[] }
    subtopics: new Map(),

    // crawlKey -> { expiresAt, taskId, urls?: string[] }
    onPageCrawl: new Map(),
  };
}

const CACHE = g.__dataforseoCache;

function cacheGet(map, key) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(map, key, value, ttlMs) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/* ============================================================
   Helpers
============================================================ */

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

function normalizeDifficulty(raw, fallbackFromVolume) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw <= 1) return Math.round(raw * 100);
    if (raw <= 100) return Math.round(raw);
  }

  if (typeof fallbackFromVolume === "number" && fallbackFromVolume > 0) {
    if (fallbackFromVolume >= 20000) return 80;
    if (fallbackFromVolume >= 10000) return 65;
    if (fallbackFromVolume >= 5000) return 55;
    if (fallbackFromVolume >= 2000) return 45;
    return 30;
  }

  return null;
}

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

function buildAiVisibilityMatrix(backlinksSummary, serpFeatures = {}) {
  const rank =
    typeof backlinksSummary?.rank === "number" ? backlinksSummary.rank : 50;

  const coverage =
    typeof serpFeatures.coveragePercent === "number"
      ? serpFeatures.coveragePercent
      : 40;

  const totalFeatures =
    (serpFeatures.featuredSnippets ?? 0) +
    (serpFeatures.peopleAlsoAsk ?? 0) +
    (serpFeatures.imagePack ?? 0) +
    (serpFeatures.videoResults ?? 0) +
    (serpFeatures.knowledgePanel ?? 0);

  const featuresScore =
    totalFeatures > 0
      ? Math.min(
          100,
          (Math.log10(totalFeatures + 1) / Math.log10(100 + 1)) * 100
        )
      : 0;

  const visibilityScore = 0.4 * rank + 0.4 * coverage + 0.2 * featuresScore;
  const baseRating = Math.max(0, Math.min(5, visibilityScore / 20));

  const pagesBase =
    backlinksSummary?.crawled_pages ?? backlinksSummary?.referring_domains ?? 100;

  const normalizePages = (mult) => {
    const raw = Number(pagesBase) * mult;
    if (!Number.isFinite(raw)) return Math.round(100 * mult);
    return Math.max(10, Math.round(raw));
  };

  const clampRating = (r) => Math.max(0, Math.min(5, Number(r.toFixed(1))));

  return {
    GPT: { rating: clampRating(baseRating + 0.2), pages: normalizePages(0.9) },
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

/* ============================================================
   Subtopics fetch (cached)
============================================================ */

async function fetchSubtopicsForKeywords(keywords, auth) {
  if (!keywords || !keywords.length) return {};

  const TTL_MS = 24 * 60 * 60 * 1000; // 24h cache per keyword
  const map = {};

  for (const kw of keywords) {
    const key = String(kw || "").trim().toLowerCase();
    if (!key) continue;

    const cached = cacheGet(CACHE.subtopics, key);
    if (cached) {
      map[kw] = cached;
      continue;
    }

    const payload = [{ topic: kw, creativity_index: 0.7 }];

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

      if (!res.ok) continue;

      const json = await res.json();
      const task = Array.isArray(json?.tasks) ? json.tasks[0] : null;
      const firstResult = Array.isArray(task?.result) ? task.result[0] : null;
      const subs = firstResult?.sub_topics;

      if (Array.isArray(subs) && subs.length > 0) {
        cacheSet(CACHE.subtopics, key, subs, TTL_MS);
        map[kw] = subs;
      }
    } catch {
      // ignore per-keyword failures
    }
  }

  return map;
}

/* ============================================================
   Main API (cached + in-flight dedupe)
   ✅ keywordsOnly mode:
     - fast: only "keywords_for_site" + optional subtopics
     - skips backlinks + SERP advanced + ai matrix
============================================================ */

export async function fetchDataForSeo(targetInput, options = {}) {
  const login = DATAFORSEO_LOGIN;
  const password = DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new Error(
      "DataForSEO credentials missing. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env.local"
    );
  }

  const originalTarget = (targetInput || "").toString().trim();
  const target = originalTarget
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");

  if (!target) {
    throw new Error("fetchDataForSeo: target domain is empty");
  }

  const {
    language_code = "en",
    countryCode = "in",
    depth = 10,
    maxKeywords = 5,

    // ✅ NEW
    keywordsOnly = false,
    includeSubtopics = true, // set false if you want fastest possible
  } = options || {};

  const location_name =
    countryCode.toLowerCase() === "in" ? "India" : "United States";

  // cache key includes important params + mode flags
  const cacheKey = JSON.stringify({
    target,
    language_code,
    location_name,
    depth,
    maxKeywords,
    keywordsOnly,
    includeSubtopics,
  });

  // ✅ 10 min TTL avoids repeated cost while user navigates UI
  const cached = cacheGet(CACHE.seo, cacheKey);
  if (cached) return cached;

  // ✅ in-flight dedupe: if called twice at once, second awaits first
  const inflight = CACHE.inflightSeo.get(cacheKey);
  if (inflight) return inflight;

  const p = (async () => {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");

    // ============================
    // FAST PATH: keywordsOnly
    // ============================
    if (keywordsOnly) {
      const keywordsPayload = [
        { target, language_code, location_name, limit: maxKeywords },
      ];

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

        if (kwRes.ok) {
          const kwJson = await kwRes.json();
          const kwTask = Array.isArray(kwJson.tasks) ? kwJson.tasks[0] : null;
          const kwResult =
            kwTask && Array.isArray(kwTask.result) && kwTask.result[0]
              ? kwTask.result[0]
              : null;

          const items = kwResult?.items || [];

          topKeywords = items
            .map((item) => {
              const kw =
                item.keyword ||
                item.keyword_data?.keyword ||
                item.keyword_info?.keyword ||
                null;
              if (!kw) return null;

              const volRaw =
                item.search_volume ??
                item.keyword_data?.search_volume ??
                item.keyword_info?.search_volume ??
                item.keyword_data?.keyword_info?.search_volume ??
                item.metrics?.search_volume ??
                null;

              const searchVolume = toNumber(volRaw) ?? 0;

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
                type,
                searchVolume,
                volume: searchVolume,
                difficulty,
                seoDifficulty: difficulty,
              };
            })
            .filter(Boolean)
            .slice(0, maxKeywords);

          if (includeSubtopics) {
            const keywordStrings = topKeywords.map((k) => k.keyword);
            const subtopicsByKeyword = await fetchSubtopicsForKeywords(
              keywordStrings,
              auth
            );

            topKeywords = topKeywords.map((row) => {
              const subs = subtopicsByKeyword[row.keyword];
              const suggestedFromApi =
                Array.isArray(subs) && subs.length > 0 ? subs[0] : null;
              const fallbackSuggested = buildSuggestedTopic(row.keyword, row.type);
              const suggested = suggestedFromApi || fallbackSuggested;

              return {
                ...row,
                suggested,
                suggestedTopic: suggested,
                topic: suggested,
              };
            });
          } else {
            // keep same fields so UI doesn't break
            topKeywords = topKeywords.map((row) => {
              const suggested = buildSuggestedTopic(row.keyword, row.type);
              return {
                ...row,
                suggested,
                suggestedTopic: suggested,
                topic: suggested,
              };
            });
          }

          seoRows = topKeywords;
        }
      } catch {
        // ignore (return empty fast result)
      }

      const result = {
        dataForSeo: {
          keyword: target,
          backlinksSummary: null,

          // ✅ links tab expects these keys to exist (even if empty)
          backlinkDomains: [],
          externalTotal: 0,
          totalDomains: 0,

          serpFeatures: null,
          serpItems: [],
          topKeywords,
          aiTools: null,
          raw: { backlinks: null, serp: null, referring_domains: null },
        },
        seoRows,
        _mode: "keywordsOnly",
      };

      cacheSet(CACHE.seo, cacheKey, result, 10 * 60 * 1000);
      return result;
    }

    // ============================
    // FULL PATH (existing behavior)
    // ============================

    // 1) BACKLINKS SUMMARY
    const backlinksPayload = [
      {
        target,
        internal_list_limit: 10,
        include_subdomains: true,
        backlinks_status_type: "all",
      },
    ];

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

    if (!backlinksRes.ok) {
      const text = await backlinksRes.text();
      throw new Error(
        `DataForSEO Backlinks API failed: ${backlinksRes.status} - ${text}`
      );
    }

    const backlinksData = await backlinksRes.json();
    const backlinksTask = Array.isArray(backlinksData.tasks)
      ? backlinksData.tasks[0]
      : null;
    const backlinksSummary =
      backlinksTask &&
      Array.isArray(backlinksTask.result) &&
      backlinksTask.result[0]
        ? backlinksTask.result[0]
        : null;

    // ✅ 1.5) REFERRING DOMAINS (this powers your Links tab)
    // This returns an actual list of domains with backlinks counts.
    let backlinkDomains = [];
    let externalTotal = 0;
    let totalDomains = 0;
    let referringDomainsRaw = null;

    try {
      const referringPayload = [
        {
          target,
          limit: 200, // 100–1000 (max 1000)
          offset: 0,
          order_by: ["rank,desc"],
          exclude_internal_backlinks: true,
          include_subdomains: true,
          // optional filters:
          // backlinks_filters: ["dofollow","=",true],
        },
      ];

      const refRes = await fetch(
        "https://api.dataforseo.com/v3/backlinks/referring_domains/live",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(referringPayload),
        }
      );

      if (refRes.ok) {
        const refJson = await refRes.json();
        referringDomainsRaw = refJson;

        const task0 = Array.isArray(refJson?.tasks) ? refJson.tasks[0] : null;
        const r0 = Array.isArray(task0?.result) ? task0.result[0] : null;
        const items = Array.isArray(r0?.items) ? r0.items : [];

        backlinkDomains = items
          .map((it) => {
            const domain = it?.domain || it?.referring_domain || "";
            if (!domain) return null;

            const backlinks = toNumber(it?.backlinks) ?? 0;
            const rank = toNumber(it?.rank) ?? 0;

            return {
              domain,
              backlinks,
              rank,
              referring_pages: toNumber(it?.referring_pages) ?? 0,
              backlinks_spam_score: toNumber(it?.backlinks_spam_score),
              first_seen: it?.first_seen ?? null,
              lost_date: it?.lost_date ?? null,
            };
          })
          .filter(Boolean);

        totalDomains =
          typeof r0?.total_count === "number" ? r0.total_count : items.length;

        externalTotal = backlinkDomains.reduce(
          (sum, d) => sum + (Number(d.backlinks) || 0),
          0
        );
      }
    } catch {
      // don’t fail full pipeline if referring domains call fails
    }

    // 2) DOMAIN KEYWORDS
    const keywordsPayload = [
      { target, language_code, location_name, limit: maxKeywords },
    ];

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

      if (kwRes.ok) {
        const kwJson = await kwRes.json();
        const kwTask = Array.isArray(kwJson.tasks) ? kwJson.tasks[0] : null;
        const kwResult =
          kwTask && Array.isArray(kwTask.result) && kwTask.result[0]
            ? kwTask.result[0]
            : null;

        const items = kwResult?.items || [];

        topKeywords = items
          .map((item) => {
            const kw =
              item.keyword ||
              item.keyword_data?.keyword ||
              item.keyword_info?.keyword ||
              null;
            if (!kw) return null;

            const volRaw =
              item.search_volume ??
              item.keyword_data?.search_volume ??
              item.keyword_info?.search_volume ??
              item.keyword_data?.keyword_info?.search_volume ??
              item.metrics?.search_volume ??
              null;

            const searchVolume = toNumber(volRaw) ?? 0;

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
              type,
              searchVolume,
              volume: searchVolume,
              difficulty,
              seoDifficulty: difficulty,
            };
          })
          .filter(Boolean)
          .slice(0, maxKeywords);

        if (includeSubtopics) {
          const keywordStrings = topKeywords.map((k) => k.keyword);
          const subtopicsByKeyword = await fetchSubtopicsForKeywords(
            keywordStrings,
            auth
          );

          topKeywords = topKeywords.map((row) => {
            const subs = subtopicsByKeyword[row.keyword];
            const suggestedFromApi =
              Array.isArray(subs) && subs.length > 0 ? subs[0] : null;
            const fallbackSuggested = buildSuggestedTopic(row.keyword, row.type);
            const suggested = suggestedFromApi || fallbackSuggested;

            return {
              ...row,
              suggested,
              suggestedTopic: suggested,
              topic: suggested,
            };
          });
        } else {
          topKeywords = topKeywords.map((row) => {
            const suggested = buildSuggestedTopic(row.keyword, row.type);
            return {
              ...row,
              suggested,
              suggestedTopic: suggested,
              topic: suggested,
            };
          });
        }

        seoRows = topKeywords;
      }
    } catch {
      // ignore keyword failure (keep going with fallback)
    }

    // Fallback: if no domain keywords, at least analyze the domain string once
    const keywordsForSerp =
      topKeywords.length > 0 ? topKeywords.map((k) => k.keyword) : [target];

    // 3) SERP ADVANCED PER KEYWORD
    let serpItems = [];
    let serpRaw = [];

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
        { keyword: kw, language_code, location_name, depth, device: "desktop" },
      ];

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

        if (!serpRes.ok) continue;

        const serpJson = await serpRes.json();
        serpRaw.push(serpJson);

        const task0 = Array.isArray(serpJson?.tasks) ? serpJson.tasks[0] : null;
        const firstResult = Array.isArray(task0?.result) ? task0.result[0] : null;
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
        const videoResults = countFeature("videos") + countFeature("video");
        const knowledgePanel =
          countFeature("knowledge_graph") + countFeature("knowledge_panel");

        const hasAny =
          featuredSnippets ||
          peopleAlsoAsk ||
          imagePack ||
          videoResults ||
          knowledgePanel;

        if (hasAny) keywordsWithAnyFeature += 1;

        totalFeaturedSnippets += featuredSnippets;
        totalPeopleAlsoAsk += peopleAlsoAsk;
        totalImagePack += imagePack;
        totalVideoResults += videoResults;
        totalKnowledgePanel += knowledgePanel;
      } catch {
        // ignore per-keyword serp failures
      }
    }

    const coveragePercent =
      keywordCount > 0
        ? Math.round((keywordsWithAnyFeature / keywordCount) * 100)
        : 0;

    const serpFeatures = {
      coveragePercent,
      featuredSnippets: totalFeaturedSnippets,
      peopleAlsoAsk: totalPeopleAlsoAsk,
      imagePack: totalImagePack,
      videoResults: totalVideoResults,
      knowledgePanel: totalKnowledgePanel,
    };

    const aiTools = buildAiVisibilityMatrix(backlinksSummary, serpFeatures);

    const result = {
      dataForSeo: {
        keyword: target,
        backlinksSummary,

        // ✅ NEW: powers SeoAdvancedLinks
        backlinkDomains,
        externalTotal,
        totalDomains,

        serpFeatures,
        serpItems,
        topKeywords,
        aiTools,
        raw: {
          backlinks: backlinksData,
          referring_domains: referringDomainsRaw,
          serp: serpRaw,
        },
      },
      seoRows,
    };

    cacheSet(CACHE.seo, cacheKey, result, 10 * 60 * 1000);
    return result;
  })().finally(() => {
    CACHE.inflightSeo.delete(cacheKey);
  });

  CACHE.inflightSeo.set(cacheKey, p);
  return p;
}

/* ============================================================================
   Sitemap missing → DataForSEO crawl fallback helper
============================================================================ */

export async function crawlSiteUrlsWithDataForSEO(
  targetDomain,
  { maxCrawlPages = 60, limitPagesResult = 200 } = {}
) {
  const login = DATAFORSEO_LOGIN;
  const password = DATAFORSEO_PASSWORD;

  if (!login || !password) {
    console.warn("[DataForSEO] Missing credentials; crawl fallback skipped.");
    return [];
  }

  const target = (targetDomain || "")
    .toString()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

  if (!target) return [];

  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  const crawlKey = JSON.stringify({
    target,
    maxCrawlPages,
    limitPagesResult,
  });

  const cachedUrls = cacheGet(CACHE.onPageCrawl, crawlKey);
  if (cachedUrls) return cachedUrls;

  const taskPayload = [
    {
      target,
      max_crawl_pages: maxCrawlPages,
      load_resources: true,
      enable_javascript: true,
      enable_browser_rendering: true,
    },
  ];

  const taskRes = await fetch("https://api.dataforseo.com/v3/on_page/task_post", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(taskPayload),
  });

  if (!taskRes.ok) {
    const text = await taskRes.text();
    console.error("[DataForSEO] on_page/task_post failed:", text);
    return [];
  }

  const taskJson = await taskRes.json();
  const task = Array.isArray(taskJson?.tasks) ? taskJson.tasks[0] : null;

  const id =
    task?.result?.[0]?.id ||
    task?.result?.id ||
    task?.id ||
    task?.task_id ||
    null;

  if (!id) {
    console.error("[DataForSEO] Could not read task id from response:", taskJson);
    return [];
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < 6; i++) {
    try {
      const sumRes = await fetch(
        `https://api.dataforseo.com/v3/on_page/summary/${id}`,
        {
          method: "GET",
          headers: { Authorization: `Basic ${auth}` },
        }
      );

      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        const t = Array.isArray(sumJson?.tasks) ? sumJson.tasks[0] : null;
        const crawlProgress = t?.result?.[0]?.crawl_progress;
        if (crawlProgress === 100) break;
      }
    } catch {}
    await sleep(1500);
  }

  const pagesPayload = [
    {
      id,
      limit: Math.min(1000, Math.max(1, limitPagesResult)),
      offset: 0,
    },
  ];

  const pagesRes = await fetch("https://api.dataforseo.com/v3/on_page/pages", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pagesPayload),
  });

  if (!pagesRes.ok) {
    const text = await pagesRes.text();
    console.error("[DataForSEO] on_page/pages failed:", text);
    return [];
  }

  const pagesJson = await pagesRes.json();
  const pagesTask = Array.isArray(pagesJson?.tasks) ? pagesJson.tasks[0] : null;
  const result0 = Array.isArray(pagesTask?.result) ? pagesTask.result[0] : null;
  const items = Array.isArray(result0?.items) ? result0.items : [];

  const urls = items
    .map((it) => it?.url || it?.page_url || it?.resource?.url)
    .filter(Boolean);

  const uniq = Array.from(new Set(urls));

  cacheSet(CACHE.onPageCrawl, crawlKey, uniq, 24 * 60 * 60 * 1000);
  return uniq;
}
