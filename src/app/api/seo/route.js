// src/app/api/seo/route.js
import { NextResponse } from "next/server";

import { fetchPsiForStrategy } from "@/lib/seo/psi";
import { fetchOpenPageRank } from "@/lib/seo/openpagerank";
import { fetchSerp } from "@/lib/seo/serper";
import { fetchDataForSeo } from "@/lib/seo/dataforseo";
import { extractPageText } from "@/lib/seo/apyhub";
import { analyzeWithIbmNlu } from "@/lib/seo/ibm-nlu";
import { analyzeWithMeaningCloud } from "@/lib/seo/meaningcloud";

/**
 * Helper to safely get the domain from a URL
 */
function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

// Simple helper to compute % difference vs a baseline value
function computePercentGrowth(current, baseline) {
  const cur = typeof current === "number" ? current : 0;
  const base = typeof baseline === "number" ? baseline : 0;
  if (!base || base <= 0) return 0;
  return Math.round(((cur - base) / base) * 100);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      url,
      keyword,
      countryCode = "in",
      languageCode = "en",
      depth = 10,
      // optional: limit what runs
      providers = ["psi", "authority", "serper", "dataforseo", "content"],
    } = body || {};

    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' in request body" },
        { status: 400 }
      );
    }

    const domain = getDomainFromUrl(url);

    // -----------------------------
    // 1. CORE SEO CALLS IN PARALLEL
    // -----------------------------
    const tasks = [];

    if (providers.includes("psi")) {
      // Fetch PSI for both mobile and desktop, including CrUX field data
      tasks.push(
        (async () => {
          try {
            const [mobile, desktop] = await Promise.all([
              fetchPsiForStrategy(url, "mobile"),
              fetchPsiForStrategy(url, "desktop"),
            ]);

            const technicalSeo = {
              // Lighthouse performance scores
              performanceScoreMobile:
                typeof mobile.performanceScore === "number"
                  ? mobile.performanceScore
                  : null,
              performanceScoreDesktop:
                typeof desktop.performanceScore === "number"
                  ? desktop.performanceScore
                  : null,

              // Lab CWV (for your existing UI)
              coreWebVitals:
                mobile.coreWebVitalsLab ||
                desktop.coreWebVitalsLab ||
                {},

              // CrUX field CWV (new)
              coreWebVitalsField:
                mobile.coreWebVitalsField ||
                desktop.coreWebVitalsField ||
                {},

              // Aggregated issue counts from Lighthouse audits
              issueCounts: {
                critical:
                  (mobile.issueCounts?.critical ?? 0) +
                  (desktop.issueCounts?.critical ?? 0),
                warning:
                  (mobile.issueCounts?.warning ?? 0) +
                  (desktop.issueCounts?.warning ?? 0),
              },
            };

            return { key: "psi", ok: true, result: { technicalSeo } };
          } catch (error) {
            return {
              key: "psi",
              ok: false,
              error: error.message || "PSI failed",
            };
          }
        })()
      );
    }

    if (providers.includes("authority") && domain) {
      tasks.push(
        fetchOpenPageRank(domain).then(
          (result) => ({ key: "authority", ok: true, result }),
          (error) => ({ key: "authority", ok: false, error: error.message })
        )
      );
    }

    if (providers.includes("serper") && keyword) {
      tasks.push(
        fetchSerp(keyword).then(
          (result) => ({ key: "serper", ok: true, result }),
          (error) => ({ key: "serper", ok: false, error: error.message })
        )
      );
    }

    if (providers.includes("dataforseo") && domain) {
      // NOTE: fetchDataForSeo now expects a domain/URL
      // and returns { dataForSeo, seoRows }
      tasks.push(
        fetchDataForSeo(domain, {
          language_code: languageCode,
          countryCode,
          depth,
        }).then(
          (result) => ({ key: "dataforseo", ok: true, result }),
          (error) => ({ key: "dataforseo", ok: false, error: error.message })
        )
      );
    }

    const coreResults = await Promise.all(tasks);

    // Merge successful results
    const unified = coreResults.reduce(
      (acc, item) => {
        if (item.ok && item.result) {
          // merge this provider's normalized object into the unified payload
          return { ...acc, ...item.result };
        }
        // collect per-provider errors
        if (!item.ok) {
          acc._errors = acc._errors || {};
          acc._errors[item.key] = item.error;
        }
        return acc;
      },
      {
        // base object shape; you can predefine keys if you want
      }
    );

    // If DataForSEO only populated dataForSeo.topKeywords,
    // expose them as seoRows for the "New on page SEO opportunity" table.
    if (!unified.seoRows && Array.isArray(unified.dataForSeo?.topKeywords)) {
      unified.seoRows = unified.dataForSeo.topKeywords;
    }

    // -----------------------------------------
    // 2. CONTENT PIPELINE: APYHUB + NLU PROVIDERS
    // -----------------------------------------
    if (providers.includes("content")) {
      try {
        const apyResult = await extractPageText(url);
        const text = apyResult?.apyhub?.text || "";

        if (text) {
          const [ibmResult, mcResult] = await Promise.allSettled([
            analyzeWithIbmNlu(text),
            analyzeWithMeaningCloud(text),
          ]);

          const ibm =
            ibmResult.status === "fulfilled" ? ibmResult.value.ibmNlu : null;
          const meaningCloud =
            mcResult.status === "fulfilled"
              ? mcResult.value.meaningCloud
              : null;

          unified.content = {
            rawText: text,
            ibmNlu: ibm,
            meaningCloud,
          };

          if (
            ibmResult.status === "rejected" ||
            mcResult.status === "rejected"
          ) {
            unified._errors = unified._errors || {};
            if (ibmResult.status === "rejected") {
              unified._errors.ibmNlu =
                ibmResult.reason?.message || "IBM NLU failed";
            }
            if (mcResult.status === "rejected") {
              unified._errors.meaningCloud =
                mcResult.reason?.message || "MeaningCloud failed";
            }
          }
        } else {
          unified._warnings = unified._warnings || [];
          unified._warnings.push("No text extracted from ApyHub");
        }
      } catch (err) {
        unified._errors = unified._errors || {};
        unified._errors.contentPipeline =
          err.message || "Content pipeline failed";
      }
    }

    // -----------------------------------------
    // 3. NORMALIZED ISSUE COUNTS FOR DASHBOARD
    // -----------------------------------------
    const technicalIssueCounts = unified.technicalSeo?.issueCounts || {};

    const ibm = unified.content?.ibmNlu;
    const mc = unified.content?.meaningCloud;

    // Very simple heuristics: number of extracted concepts/keywords/categories
    const ibmKeywordsLen = Array.isArray(ibm?.keywords)
      ? ibm.keywords.length
      : 0;
    const ibmConceptsLen = Array.isArray(ibm?.concepts)
      ? ibm.concepts.length
      : 0;
    const mcConceptsLen = Array.isArray(mc?.concepts)
      ? mc.concepts.length
      : 0;
    const mcCategoriesLen = Array.isArray(mc?.category_list || mc?.categories)
      ? (mc.category_list || mc.categories).length
      : 0;

    const recommendationsCount =
      ibmKeywordsLen + ibmConceptsLen + mcConceptsLen;

    const contentOppsCount = mcCategoriesLen;

    unified.issues = {
      critical:
        typeof technicalIssueCounts.critical === "number"
          ? technicalIssueCounts.critical
          : 0,
      warning:
        typeof technicalIssueCounts.warning === "number"
          ? technicalIssueCounts.warning
          : 0,
      recommendations: recommendationsCount,
      contentOpps: contentOppsCount,
    };

    // -----------------------------------------
    // 4. MOCKED GROWTH PERCENTAGES FOR DASHBOARD
    //    Uses current API-driven values vs old baseline demo values
    // -----------------------------------------
    const baselineIssues = {
      // these are the old hardcoded demo numbers from the dashboard
      critical: 274,
      warning: 883,
      recommendations: 77,
      contentOpps: 5,
    };

    unified.issuesGrowth = {
      critical: computePercentGrowth(
        unified.issues.critical,
        baselineIssues.critical
      ),
      warning: computePercentGrowth(
        unified.issues.warning,
        baselineIssues.warning
      ),
      recommendations: computePercentGrowth(
        unified.issues.recommendations,
        baselineIssues.recommendations
      ),
      contentOpps: computePercentGrowth(
        unified.issues.contentOpps,
        baselineIssues.contentOpps
      ),
    };

    // Include basic meta for debugging / UI
    unified._meta = {
      url,
      domain,
      keyword: keyword || null,
      countryCode,
      languageCode,
      depth,
      providers,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(unified);
  } catch (err) {
    console.error("Error in /api/seo:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
