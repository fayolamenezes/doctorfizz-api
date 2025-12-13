// src/app/api/seo/route.js
import { NextResponse } from "next/server";

import { fetchPsiForStrategy } from "@/lib/seo/psi";
import { fetchOpenPageRank } from "@/lib/seo/openpagerank";
import { fetchSerp } from "@/lib/seo/serper";
import { fetchDataForSeo } from "@/lib/seo/dataforseo";
import { extractPageText } from "@/lib/seo/apyhub";

/**
 * Normalize any user input into a valid absolute URL string.
 * - "example.com"        -> "https://example.com"
 * - "http://example.com" -> "http://example.com"
 * - "https://..."        -> "https://..."
 */
function ensureHttpUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  return raw.includes("://") ? raw : `https://${raw}`;
}

/**
 * Helper to safely get the domain from a URL (supports bare domains too)
 */
function getDomainFromUrl(url) {
  try {
    const safe = ensureHttpUrl(url);
    if (!safe) return null;
    const u = new URL(safe);
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
    typeof data === "string" ? data : JSON.stringify(data ?? {}, null, 0);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

/**
 * Try to extract a "domain authority" style score from OpenPageRank payload
 * (kept flexible so it works with different return shapes).
 */
function pickAuthorityScore(openPageRankPayload) {
  if (!openPageRankPayload) return null;

  // If your wrapper already returns a number
  if (typeof openPageRankPayload === "number") return openPageRankPayload;

  // Common possible shapes
  const candidatePaths = [
    ["pageRank"],
    ["rank"],
    ["domainAuthority"],
    ["score"],
    ["openPageRank", "pageRank"],
    ["openPageRank", "rank"],
    ["openPageRank", "domainAuthority"],
    ["openPageRank", "score"],
    ["data", "page_rank_decimal"],
    ["data", "page_rank_integer"],
    ["data", "page_rank"],
    ["response", "page_rank_decimal"],
    ["response", "page_rank_integer"],
    ["response", "page_rank"],
    ["results", 0, "page_rank_decimal"],
    ["results", 0, "page_rank_integer"],
    ["results", 0, "page_rank"],
    ["result", "page_rank_decimal"],
    ["result", "page_rank_integer"],
    ["result", "page_rank"],
  ];

  const getAt = (obj, path) => {
    let cur = obj;
    for (const key of path) {
      if (cur == null) return undefined;
      cur = cur[key];
    }
    return cur;
  };

  for (const path of candidatePaths) {
    const v = getAt(openPageRankPayload, path);
    if (typeof v === "number" && Number.isFinite(v)) {
      if (v <= 10 && v >= 0) return Math.round(v * 10); // 0..100-ish
      return v;
    }
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
      const n = Number(v);
      if (n <= 10 && n >= 0) return Math.round(n * 10);
      return n;
    }
  }

  return null;
}

/**
 * Build InfoPanel metrics without GSC:
 * - Domain Authority: OpenPageRank-derived
 * - Organic Keyword: DataForSEO-derived (count of rows/topKeywords)
 * - Organic Traffic: placeholder
 * - Growth: derived vs baseline
 * - Badge: derived from PSI scores
 */
function buildInfoPanel(unified) {
  const domainAuthority = pickAuthorityScore(
    unified?.openPageRank ?? unified?.authority ?? unified
  );

  const organicKeyword = Array.isArray(unified?.seoRows)
    ? unified.seoRows.length
    : Array.isArray(unified?.dataForSeo?.topKeywords)
    ? unified.dataForSeo.topKeywords.length
    : 0;

  const organicTraffic = null;

  // Baselines (tune later)
  const baseline = {
    domainAuthority: 40,
    organicKeyword: 200,
    organicTraffic: 0,
  };

  const growth = {
    domainAuthority: computePercentGrowth(
      domainAuthority,
      baseline.domainAuthority
    ),
    organicKeyword: computePercentGrowth(organicKeyword, baseline.organicKeyword),
    organicTraffic: 0,
  };

  const mob = unified?.technicalSeo?.performanceScoreMobile;
  const desk = unified?.technicalSeo?.performanceScoreDesktop;

  const mobN = typeof mob === "number" ? mob : null;
  const deskN = typeof desk === "number" ? desk : null;

  const avgPerf =
    mobN != null && deskN != null
      ? (mobN + deskN) / 2
      : mobN != null
      ? mobN
      : deskN != null
      ? deskN
      : null;

  const badge =
    avgPerf == null
      ? { label: "Good", tone: "success" } // fallback (don’t break UI)
      : avgPerf >= 70
      ? { label: "Good", tone: "success" }
      : avgPerf >= 50
      ? { label: "Needs Work", tone: "warning" }
      : { label: "Poor", tone: "danger" };

  return {
    domainAuthority,
    organicKeyword,
    organicTraffic,
    growth,
    badge,
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    // ✅ must be let so we can normalize url
    let {
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

    // ✅ normalize here so PSI + content extractor stop failing on bare domains
    url = ensureHttpUrl(url);
    if (!url) {
      return NextResponse.json(
        { error: "Invalid 'url' in request body" },
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
                  mobile.coreWebVitalsLab || desktop.coreWebVitalsLab || {},

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
            (result) => {
              console.log("OpenPageRank RAW RESPONSE:", result);
              return { key: "authority", ok: true, result };
            },
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

      // Preserve authority payload so buildInfoPanel can read it robustly
      // (many projects store it under openPageRank)
      const authorityOk = coreResults.find((r) => r.key === "authority" && r.ok);
      if (authorityOk?.result && unified.openPageRank == null) {
        // if the wrapper already returns {openPageRank:{...}} this is harmless
        unified.openPageRank =
          authorityOk.result.openPageRank ?? authorityOk.result;
      }

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

      // ✅ NEW: InfoPanel payload (NO GSC)
      unified.infoPanel = buildInfoPanel(unified);

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
              // IMPORTANT: do not append "done" to message; keep label as-is
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
              runProvider(
                "psi",
                "Fetching PageSpeed Insights (mobile + desktop)…",
                async () => {
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
                      mobile.coreWebVitalsLab || desktop.coreWebVitalsLab || {},
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
                }
              )
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
              runProvider(
                "dataforseo",
                "Fetching DataForSEO keywords & opportunities…",
                async () => {
                  return await fetchDataForSeo(domain, {
                    language_code: languageCode,
                    countryCode,
                    depth,
                  });
                }
              )
            );
          }

          const coreResults = await Promise.all(corePromises);

          // Merge results
          for (const item of coreResults) {
            if (item.ok && item.result) {
              Object.assign(unified, item.result);

              // Preserve authority payload so buildInfoPanel can read it robustly
              if (item.key === "authority" && unified.openPageRank == null) {
                unified.openPageRank =
                  item.result?.openPageRank ?? item.result;
              }
            } else if (!item.ok) {
              unified._errors = unified._errors || {};
              unified._errors[item.key] = item.error;
            }
          }

          // If DataForSEO only populated dataForSeo.topKeywords,
          // expose them as seoRows for the "New on page SEO opportunity" table.
          if (
            !unified.seoRows &&
            Array.isArray(unified.dataForSeo?.topKeywords)
          ) {
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
                message: err.message || "Content pipeline (ApyHub) failed",
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

          // ✅ NEW: InfoPanel payload (NO GSC)
          unified.infoPanel = buildInfoPanel(unified);

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
