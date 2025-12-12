// src/app/api/seo/route.js
import { NextResponse } from "next/server";

import { fetchPsiForStrategy } from "@/lib/seo/psi";
import { fetchOpenPageRank } from "@/lib/seo/openpagerank";
import { fetchSerp } from "@/lib/seo/serper";
import { fetchDataForSeo } from "@/lib/seo/dataforseo";
import { extractPageText } from "@/lib/seo/apyhub";

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

function sseFormat(event, data) {
  const payload =
    typeof data === "string"
      ? data
      : JSON.stringify(data ?? {}, null, 0);
  return `event: ${event}\ndata: ${payload}\n\n`;
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

    // SSE mode (Option B)
    const accept = request.headers.get("accept") || "";
    const wantsSSE = accept.includes("text/event-stream");

    // -------------------------
    // NORMAL (existing) JSON MODE
    // -------------------------
    if (!wantsSSE) {
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
        // NOTE: fetchDataForSeo expects a domain/URL
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
      // 2. CONTENT PIPELINE: APYHUB (TEXT ONLY)
      // -----------------------------------------
      if (providers.includes("content")) {
        try {
          const apyResult = await extractPageText(url);
          const text = (apyResult?.apyhub?.text || "").trim();

          if (text) {
            unified.content = {
              // raw extracted text for Canvas / Optimize / keyword analysis
              rawText: text,
            };
          } else {
            unified._warnings = unified._warnings || [];
            unified._warnings.push("No text extracted from ApyHub");
          }
        } catch (err) {
          unified._errors = unified._errors || {};
          unified._errors.contentPipeline =
            err.message || "Content pipeline (ApyHub) failed";
        }
      }

      // -----------------------------------------
      // 3. NORMALIZED ISSUE COUNTS FOR DASHBOARD
      // -----------------------------------------
      const technicalIssueCounts = unified.technicalSeo?.issueCounts || {};

      // 🔸 Simple heuristic from content length (no IBM / MeaningCloud)
      let recommendationsCount = 0;
      let contentOppsCount = 0;

      const rawText = (unified.content?.rawText || "").trim();

      if (rawText) {
        const wordCount = rawText.split(/\s+/).length;

        // Rough: 1 "recommendation" per ~300 words (min 3)
        recommendationsCount = Math.max(3, Math.round(wordCount / 300));

        // Rough: 1 "content opportunity" per ~1200 words (min 1)
        contentOppsCount = Math.max(1, Math.round(wordCount / 1200));
      }

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
    }

    // -------------------------
    // SSE STREAMING MODE (Option B)
    // -------------------------
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event, data) => {
          controller.enqueue(encoder.encode(sseFormat(event, data)));
        };

        try {
          // Tell client we're starting
          send("status", {
            stage: "start",
            message: "Starting SEO pipeline…",
            url,
            domain,
            keyword: keyword || null,
            providers,
          });

          // Base unified payload
          const unified = {};

          // helper: run and emit per provider
          const runProvider = async (key, label, fn) => {
            send("status", { stage: key, state: "start", message: label });
            try {
              const result = await fn();
              send("status", { stage: key, state: "done", message: label });
              return { key, ok: true, result };
            } catch (error) {
              const msg = error?.message || `${label} failed`;
              send("status", { stage: key, state: "error", message: msg });
              return { key, ok: false, error: msg };
            }
          };

          // 1) CORE providers in parallel, but streamed as each completes
          const corePromises = [];

          if (providers.includes("psi")) {
            corePromises.push(
              runProvider("psi", "Fetching PageSpeed Insights (mobile + desktop)…", async () => {
                const [mobile, desktop] = await Promise.all([
                  fetchPsiForStrategy(url, "mobile"),
                  fetchPsiForStrategy(url, "desktop"),
                ]);

                const technicalSeo = {
                  performanceScoreMobile:
                    typeof mobile.performanceScore === "number"
                      ? mobile.performanceScore
                      : null,
                  performanceScoreDesktop:
                    typeof desktop.performanceScore === "number"
                      ? desktop.performanceScore
                      : null,
                  coreWebVitals:
                    mobile.coreWebVitalsLab ||
                    desktop.coreWebVitalsLab ||
                    {},
                  coreWebVitalsField:
                    mobile.coreWebVitalsField ||
                    desktop.coreWebVitalsField ||
                    {},
                  issueCounts: {
                    critical:
                      (mobile.issueCounts?.critical ?? 0) +
                      (desktop.issueCounts?.critical ?? 0),
                    warning:
                      (mobile.issueCounts?.warning ?? 0) +
                      (desktop.issueCounts?.warning ?? 0),
                  },
                };

                return { technicalSeo };
              })
            );
          }

          if (providers.includes("authority") && domain) {
            corePromises.push(
              runProvider("authority", "Fetching authority metrics…", async () => {
                return await fetchOpenPageRank(domain);
              })
            );
          }

          if (providers.includes("serper") && keyword) {
            corePromises.push(
              runProvider("serper", "Fetching SERP results…", async () => {
                return await fetchSerp(keyword);
              })
            );
          }

          if (providers.includes("dataforseo") && domain) {
            corePromises.push(
              runProvider("dataforseo", "Fetching DataForSEO keywords & opportunities…", async () => {
                return await fetchDataForSeo(domain, {
                  language_code: languageCode,
                  countryCode,
                  depth,
                });
              })
            );
          }

          const coreResults = await Promise.all(corePromises);

          // Merge results
          for (const item of coreResults) {
            if (item.ok && item.result) {
              Object.assign(unified, item.result);
            } else if (!item.ok) {
              unified._errors = unified._errors || {};
              unified._errors[item.key] = item.error;
            }
          }

          // If DataForSEO only populated dataForSeo.topKeywords,
          // expose them as seoRows for the "New on page SEO opportunity" table.
          if (!unified.seoRows && Array.isArray(unified.dataForSeo?.topKeywords)) {
            unified.seoRows = unified.dataForSeo.topKeywords;
          }

          // 2) Content pipeline (sequential)
          if (providers.includes("content")) {
            send("status", {
              stage: "content",
              state: "start",
              message: "Extracting page content (text)…",
            });

            try {
              const apyResult = await extractPageText(url);
              const text = (apyResult?.apyhub?.text || "").trim();

              if (text) {
                unified.content = { rawText: text };
                send("status", {
                  stage: "content",
                  state: "done",
                  message: "Content extracted",
                });
              } else {
                unified._warnings = unified._warnings || [];
                unified._warnings.push("No text extracted from ApyHub");
                send("status", {
                  stage: "content",
                  state: "done",
                  message: "No text extracted (continuing)",
                });
              }
            } catch (err) {
              unified._errors = unified._errors || {};
              unified._errors.contentPipeline =
                err.message || "Content pipeline (ApyHub) failed";
              send("status", {
                stage: "content",
                state: "error",
                message:
                  err.message || "Content pipeline (ApyHub) failed",
              });
            }
          }

          // 3) Normalized issue counts
          send("status", {
            stage: "finalize",
            state: "start",
            message: "Finalizing dashboard metrics…",
          });

          const technicalIssueCounts = unified.technicalSeo?.issueCounts || {};

          let recommendationsCount = 0;
          let contentOppsCount = 0;

          const rawText = (unified.content?.rawText || "").trim();

          if (rawText) {
            const wordCount = rawText.split(/\s+/).length;
            recommendationsCount = Math.max(3, Math.round(wordCount / 300));
            contentOppsCount = Math.max(1, Math.round(wordCount / 1200));
          }

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

          const baselineIssues = {
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

          send("status", {
            stage: "finalize",
            state: "done",
            message: "Finalized",
          });

          // Final payload
          send("done", { unified });

          controller.close();
        } catch (err) {
          // fatal stream error
          try {
            controller.enqueue(
              encoder.encode(
                sseFormat("fatal", {
                  error: "Internal server error",
                  details: err?.message || "Unknown error",
                })
              )
            );
          } catch {
            // ignore
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
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
