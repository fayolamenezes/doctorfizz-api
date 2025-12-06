// src/lib/seo/psi.js

const PSI_API_KEY = process.env.PSI_API_KEY;

if (!PSI_API_KEY) {
  console.warn("PSI_API_KEY is not set in .env.local");
}

/**
 * Low-level helper: call Google PageSpeed Insights for a single strategy
 * and return a normalized object including both Lighthouse (lab) and
 * CrUX (field) Core Web Vitals when available.
 *
 * @param {string} url - Full page URL, e.g. https://example.com
 * @param {"mobile"|"desktop"} strategy
 * @returns {Promise<{
 *   performanceScore: number | null,
 *   coreWebVitalsLab: {
 *     lcp: number | null,
 *     fcp: number | null,
 *     cls: number | null,
 *     tti: number | null,
 *     inp: number | null
 *   },
 *   coreWebVitalsField: {
 *     lcp: { value: number | null, category: string | null },
 *     inp: { value: number | null, category: string | null },
 *     cls: { value: number | null, category: string | null }
 *   },
 *   issueCounts: {
 *     critical: number,
 *     warning: number
 *   },
 *   raw: any
 * }>}
 */
export async function fetchPsiForStrategy(url, strategy = "mobile") {
  if (!url) throw new Error("fetchPsiForStrategy: url is required");

  const apiUrl =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
    `?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${PSI_API_KEY}`;

  const res = await fetch(apiUrl, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `PageSpeed Insights (${strategy}) failed: ${res.status} - ${text}`
    );
  }

  const data = await res.json();
  const lighthouse = data.lighthouseResult || {};
  const audits = lighthouse.audits || {};
  const categories = lighthouse.categories || {};

  const perfScore = categories.performance?.score ?? null;

  // Try both INP audit keys (Google has renamed this a couple of times)
  const inpAudit =
    audits["interaction-to-next-paint"] ||
    audits["experimental-interaction-to-next-paint"];

  // --- Lab (Lighthouse) Core Web Vitals ---
  const coreWebVitalsLab = {
    // numericValue is in milliseconds for timing-based metrics
    lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
    fcp: audits["first-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    tti: audits["interactive"]?.numericValue ?? null,
    inp: inpAudit?.numericValue ?? null,
  };

  // --- Simple issue counts based on Lighthouse audit scores ---
  let critical = 0;
  let warning = 0;

  for (const audit of Object.values(audits)) {
    const score =
      typeof audit?.score === "number" ? audit.score : null;
    if (score == null) continue;
    if (score < 0.5) critical += 1;
    else if (score < 0.9) warning += 1;
  }

  const issueCounts = { critical, warning };

  // --- CrUX (field) Core Web Vitals, if available ---
  const loadingExperience = data.loadingExperience || {};
  const originLoadingExperience = data.originLoadingExperience || {};

  const pageMetrics = (loadingExperience && loadingExperience.metrics) || {};
  const originMetrics =
    (originLoadingExperience && originLoadingExperience.metrics) || {};

  const pickMetric = (key) => pageMetrics[key] || originMetrics[key] || null;

  const lcpMetric = pickMetric("LARGEST_CONTENTFUL_PAINT_MS");
  const inpMetric =
    pickMetric("INTERACTION_TO_NEXT_PAINT") ||
    pickMetric("EXPERIMENTAL_INTERACTION_TO_NEXT_PAINT");
  const clsMetric = pickMetric("CUMULATIVE_LAYOUT_SHIFT_SCORE");

  const coreWebVitalsField = {
    // LCP and INP percentiles are reported in milliseconds
    lcp: {
      value:
        typeof lcpMetric?.percentile === "number"
          ? lcpMetric.percentile
          : null,
      category: lcpMetric?.category ?? null,
    },
    inp: {
      value:
        typeof inpMetric?.percentile === "number"
          ? inpMetric.percentile
          : null,
      category: inpMetric?.category ?? null,
    },
    // CLS percentile is reported as score * 100 (e.g. 10 => 0.10)
    cls: {
      value:
        typeof clsMetric?.percentile === "number"
          ? clsMetric.percentile / 100
          : null,
      category: clsMetric?.category ?? null,
    },
  };

  return {
    performanceScore:
      typeof perfScore === "number" ? perfScore : null,
    coreWebVitalsLab,
    coreWebVitalsField,
    issueCounts,
    raw: data,
  };
}

/**
 * Backwards-compatible wrapper used by any existing code that expects
 * a { technicalSeo: { performanceScore, coreWebVitals } } shape.
 *
 * NOTE: This still calls PSI for a single strategy (default: mobile).
 * The /api/seo route now uses fetchPsiForStrategy() directly to fetch
 * both mobile and desktop scores.
 *
 * @param {string} url
 * @param {"mobile"|"desktop"} strategy
 */
export async function fetchPsi(url, strategy = "mobile") {
  const {
    performanceScore,
    coreWebVitalsLab,
    coreWebVitalsField,
    issueCounts,
    raw,
  } = await fetchPsiForStrategy(url, strategy);

  return {
    technicalSeo: {
      performanceScore,
      coreWebVitals: coreWebVitalsLab,
      coreWebVitalsField,
      issueCounts,
      _raw: raw,
    },
  };
}
