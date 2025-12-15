// src/app/api/seo/route.js
import { NextResponse } from "next/server";

import { fetchPsiForStrategy } from "@/lib/seo/psi";
import { fetchOpenPageRank } from "@/lib/seo/openpagerank";
import { fetchSerp } from "@/lib/seo/serper";
import { fetchDataForSeo } from "@/lib/seo/dataforseo";
import { extractPageText } from "@/lib/seo/apyhub";

// ✅ used to fetch rendered HTML + extract title
import { fetchHtml, extractTitle } from "@/lib/seo/extraction";

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
  } catch {
    return null;
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert extracted plain text into simple HTML paragraphs (fallback only)
function textToHtml(text) {
  const safe = String(text || "").trim();
  if (!safe) return "";

  return safe
    .split(/\n\s*\n/g)
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      const withBreaks = escapeHtml(trimmed).replace(/\n/g, "<br/>");
      return `<p>${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");
}

/**
 * Extract <body>...</body> inner HTML from a full HTML document (best-effort).
 */
function extractBodyInnerHtml(fullHtml) {
  const html = String(fullHtml || "");
  if (!html) return "";
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : html; // fallback to whole html if body missing
}

/**
 * Make the rendered page HTML "editor-safe" AND "image-free":
 * - remove scripts/styles/noscript/svg/iframe etc
 * - REMOVE images/picture/video/audio/figure entirely
 * - keep headings, paragraphs, lists, links, tables (basic)
 * - strip most attributes except a small allowlist
 *
 * NOTE: Regex-based (no DOM dependency). Best-effort.
 */
function sanitizeHtmlForEditor(inputHtml) {
  let html = String(inputHtml || "");
  if (!html) return "";

  // Drop very noisy/unsafe blocks
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");

  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Remove header/nav/footer/aside that often pollutes imports (best-effort)
  html = html
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // ✅ REMOVE IMAGES & MEDIA COMPLETELY
  html = html
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<picture[\s\S]*?<\/picture>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<source\b[^>]*>/gi, "")
    .replace(/<video[\s\S]*?<\/video>/gi, "")
    .replace(/<audio[\s\S]*?<\/audio>/gi, "");

  // Strip attributes we don’t want
  // 1) For all tags: remove on* handlers + style
  html = html
    .replace(/\son\w+\s*=\s*["'][\s\S]*?["']/gi, "")
    .replace(/\sstyle\s*=\s*["'][\s\S]*?["']/gi, "");

  // 2) For <a>: keep href, title, target, rel
  html = html.replace(/<a\b([^>]*)>/gi, (m, attrs) => {
    const href = (attrs.match(/\shref\s*=\s*["'][^"']*["']/i) || [])[0] || "";
    const title =
      (attrs.match(/\stitle\s*=\s*["'][^"']*["']/i) || [])[0] || "";
    const target =
      (attrs.match(/\starget\s*=\s*["'][^"']*["']/i) || [])[0] || "";
    const rel = (attrs.match(/\srel\s*=\s*["'][^"']*["']/i) || [])[0] || "";
    return `<a${href}${title}${target}${rel}>`;
  });

  // 3) For all other tags: remove most attrs
  html = html.replace(/<([a-z0-9]+)\b([^>]*)>/gi, (m, tag, attrs) => {
    const t = String(tag).toLowerCase();

    const allowed = new Set([
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "blockquote",
      "code",
      "pre",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "span",
      "div",
    ]);

    if (!allowed.has(t)) return `<div>`;
    if (t === "a") return m;

    if (t === "table") {
      const border =
        (attrs.match(/\sborder\s*=\s*["'][^"']*["']/i) || [])[0] || "";
      const cellpadding =
        (attrs.match(/\scellpadding\s*=\s*["'][^"']*["']/i) || [])[0] || "";
      const cellspacing =
        (attrs.match(/\scellspacing\s*=\s*["'][^"']*["']/i) || [])[0] || "";
      return `<table${border}${cellpadding}${cellspacing}>`;
    }

    return `<${t}>`;
  });

  // Clean up empty blocks created by stripping media
  html = html
    .replace(/<p>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/p>/gi, "")
    .replace(/<div>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/div>/gi, "");

  html = html.replace(/\n{3,}/g, "\n\n").trim();
  return html;
}

/**
 * Prefer rendered HTML for editor hydration (keeps headings/paragraphs).
 * Always skip images.
 * Use ApyHub text for rawText and fallback HTML if rendered HTML is empty.
 */
async function buildContentPayload(url) {
  let title = null;
  let rawText = "";
  let htmlForEditor = "";

  // 1) Rendered HTML -> sanitize (keeps headings/paragraphs/lists, removes images)
  try {
    const fetched = await fetchHtml(url);
    const fullHtml = fetched?.html || "";
    title = extractTitle(fullHtml) || null;

    const bodyInner = extractBodyInnerHtml(fullHtml);
    const safeHtml = sanitizeHtmlForEditor(bodyInner);

    if (safeHtml && safeHtml.trim()) {
      htmlForEditor = safeHtml.trim();
    }
  } catch {
    // ignore
  }

  // 2) ApyHub text for rawText (and fallback html if needed)
  try {
    const apyResult = await extractPageText(url);
    rawText = (apyResult?.apyhub?.text || "").trim();
  } catch {
    // ignore
  }

  // 3) Fallback HTML from text only (no images)
  if (!htmlForEditor && rawText) {
    htmlForEditor = textToHtml(rawText);
  }

  // 4) Fallback title from first non-empty line of text
  if (!title && rawText) {
    const firstLine = rawText.split("\n").map((s) => s.trim()).find(Boolean);
    title = firstLine ? firstLine.slice(0, 120) : null;
  }

  return {
    title: title || null,
    rawText: rawText || "",
    html: htmlForEditor || "",
  };
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
 */
function pickAuthorityScore(openPageRankPayload) {
  if (!openPageRankPayload) return null;

  if (typeof openPageRankPayload === "number") return openPageRankPayload;

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
      if (v <= 10 && v >= 0) return Math.round(v * 10);
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
    organicKeyword: computePercentGrowth(
      organicKeyword,
      baseline.organicKeyword
    ),
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
      ? { label: "Good", tone: "success" }
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

// ✅ NEW: unify "seoRows" from different shapes safely
function ensureSeoRows(unified) {
  if (Array.isArray(unified.seoRows)) return;

  // fetchDataForSeo returns { seoRows, dataForSeo: { topKeywords } }
  if (Array.isArray(unified?.dataForSeo?.topKeywords)) {
    unified.seoRows = unified.dataForSeo.topKeywords;
    return;
  }

  // Sometimes result is nested if merged incorrectly
  if (Array.isArray(unified?.dataforseo?.seoRows)) {
    unified.seoRows = unified.dataforseo.seoRows;
    return;
  }
}

// ✅ NEW: merge helper for provider output that might be nested
function mergeProviderResult(unified, providerKey, providerResult) {
  if (!providerResult) return;

  Object.assign(unified, providerResult);

  if (providerKey === "authority" && unified.openPageRank == null) {
    unified.openPageRank =
      providerResult?.authority ??
      providerResult?.openPageRank ??
      providerResult;
  }

  ensureSeoRows(unified);
}

/**
 * ✅ NEW: Normalize response shape so UI tabs don't break:
 * - Provide `serper` alias from `serp` (your FAQ component expects `seoData.serper`)
 * - Ensure Links-tab fields exist on `dataForSeo` even if API returns nothing
 */
function normalizeForUi(unified) {
  // Alias: { serp: { topResults, peopleAlsoAsk, ... } } -> { serper: { organic, peopleAlsoAsk, ... } }
  if (unified?.serp && !unified?.serper) {
    unified.serper = {
      organic: Array.isArray(unified.serp?.topResults) ? unified.serp.topResults : [],
      peopleAlsoAsk: Array.isArray(unified.serp?.peopleAlsoAsk)
        ? unified.serp.peopleAlsoAsk
        : [],
      relatedSearches: Array.isArray(unified.serp?.relatedSearches)
        ? unified.serp.relatedSearches
        : [],
      serpFeatures: unified.serp?.serpFeatures ?? null,
      raw: unified.serp?.raw ?? null,
    };
  }

  // Links tab expects these to exist under dataForSeo
  if (unified?.dataForSeo) {
    if (!Array.isArray(unified.dataForSeo.backlinkDomains)) {
      unified.dataForSeo.backlinkDomains = [];
    }
    if (typeof unified.dataForSeo.externalTotal !== "number") {
      unified.dataForSeo.externalTotal = 0;
    }
    if (typeof unified.dataForSeo.totalDomains !== "number") {
      unified.dataForSeo.totalDomains = 0;
    }
  }

  ensureSeoRows(unified);
  return unified;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    let {
      url,
      keyword,
      countryCode = "in",
      languageCode = "en",
      depth = 10,

      // ✅ NEW:
      // If true, we force DataForSEO into "keywordsOnly" mode
      // so suggested keywords show up quickly (InfoPanel).
      keywordsOnly = false,

      // ✅ still supported
      providers = ["psi", "authority", "serper", "dataforseo", "content"],
    } = body || {};

    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' in request body" },
        { status: 400 }
      );
    }

    url = ensureHttpUrl(url);
    if (!url) {
      return NextResponse.json(
        { error: "Invalid 'url' in request body" },
        { status: 400 }
      );
    }

    const domain = getDomainFromUrl(url);

    const accept = request.headers.get("accept") || "";
    const wantsSSE = accept.includes("text/event-stream");

    // -------------------------
    // NORMAL JSON MODE
    // -------------------------
    if (!wantsSSE) {
      const tasks = [];

      if (providers.includes("psi") && !keywordsOnly) {
        tasks.push(
          (async () => {
            try {
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

      if (providers.includes("serper") && keyword && !keywordsOnly) {
        tasks.push(
          fetchSerp(keyword).then(
            (result) => ({ key: "serper", ok: true, result }),
            (error) => ({ key: "serper", ok: false, error: error.message })
          )
        );
      }

      if (providers.includes("dataforseo") && domain) {
        tasks.push(
          fetchDataForSeo(domain, {
            language_code: languageCode,
            countryCode,
            depth,

            // ✅ NEW: fast mode
            keywordsOnly: Boolean(keywordsOnly),

            // Optional: keep subtopics ON by default
            // includeSubtopics: true,
          }).then(
            (result) => ({ key: "dataforseo", ok: true, result }),
            (error) => ({ key: "dataforseo", ok: false, error: error.message })
          )
        );
      }

      const coreResults = await Promise.all(tasks);

      const unified = coreResults.reduce((acc, item) => {
        if (item.ok && item.result) {
          mergeProviderResult(acc, item.key, item.result);
          return acc;
        }

        if (!item.ok) {
          acc._errors = acc._errors || {};
          acc._errors[item.key] = item.error;
        }
        return acc;
      }, {});

      // -----------------------------------------
      // 2. CONTENT PIPELINE
      // -----------------------------------------
      if (providers.includes("content") && !keywordsOnly) {
        try {
          const content = await buildContentPayload(url);

          if (content?.html || content?.title || content?.rawText) {
            unified.content = {
              rawText: content.rawText || "",
              html: content.html || "",
              title: content.title || null,
              source: content.html ? "rendered_html" : "text_fallback",
            };
          } else {
            unified._warnings = unified._warnings || [];
            unified._warnings.push("No title/html/text extracted (content empty)");
          }
        } catch (err) {
          unified._errors = unified._errors || {};
          unified._errors.contentPipeline =
            err?.message || "Content pipeline failed";
        }
      }

      // ✅ normalize shapes for UI consumers (Links + FAQs)
      normalizeForUi(unified);

      // -----------------------------------------
      // 3. NORMALIZED ISSUE COUNTS FOR DASHBOARD
      // -----------------------------------------
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

      // -----------------------------------------
      // 4. MOCKED GROWTH PERCENTAGES FOR DASHBOARD
      // -----------------------------------------
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

      unified.infoPanel = buildInfoPanel(unified);

      unified._meta = {
        url,
        domain,
        keyword: keyword || null,
        countryCode,
        languageCode,
        depth,
        providers,
        keywordsOnly: Boolean(keywordsOnly),
        generatedAt: new Date().toISOString(),
      };

      return NextResponse.json(unified);
    }

    // -------------------------
    // SSE STREAMING MODE
    // -------------------------
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event, data) => {
          controller.enqueue(encoder.encode(sseFormat(event, data)));
        };

        try {
          send("status", {
            stage: "start",
            message: "Starting SEO pipeline…",
            url,
            domain,
            keyword: keyword || null,
            providers,
            keywordsOnly: Boolean(keywordsOnly),
          });

          const unified = {};

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

          const corePromises = [];

          if (providers.includes("psi") && !keywordsOnly) {
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

          if (providers.includes("serper") && keyword && !keywordsOnly) {
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
                keywordsOnly
                  ? "Fetching DataForSEO suggested keywords (fast)…"
                  : "Fetching DataForSEO keywords & opportunities…",
                async () => {
                  return await fetchDataForSeo(domain, {
                    language_code: languageCode,
                    countryCode,
                    depth,
                    keywordsOnly: Boolean(keywordsOnly),
                  });
                }
              )
            );
          }

          const coreResults = await Promise.all(corePromises);

          for (const item of coreResults) {
            if (item.ok && item.result) {
              mergeProviderResult(unified, item.key, item.result);
            } else if (!item.ok) {
              unified._errors = unified._errors || {};
              unified._errors[item.key] = item.error;
            }
          }

          // 2) Content pipeline
          if (providers.includes("content") && !keywordsOnly) {
            send("status", {
              stage: "content",
              state: "start",
              message:
                "Extracting page content (title + rendered HTML, image-free)…",
            });

            try {
              const content = await buildContentPayload(url);

              if (content?.html || content?.title || content?.rawText) {
                unified.content = {
                  rawText: content.rawText || "",
                  html: content.html || "",
                  title: content.title || null,
                  source: content.html ? "rendered_html" : "text_fallback",
                };

                send("status", {
                  stage: "content",
                  state: "done",
                  message: "Content extracted",
                });
              } else {
                unified._warnings = unified._warnings || [];
                unified._warnings.push(
                  "No title/html/text extracted (content empty)"
                );
                send("status", {
                  stage: "content",
                  state: "done",
                  message: "No content extracted (continuing)",
                });
              }
            } catch (err) {
              unified._errors = unified._errors || {};
              unified._errors.contentPipeline =
                err?.message || "Content pipeline failed";
              send("status", {
                stage: "content",
                state: "error",
                message: err?.message || "Content pipeline failed",
              });
            }
          }

          // ✅ normalize shapes for UI consumers (Links + FAQs)
          normalizeForUi(unified);

          send("status", {
            stage: "finalize",
            state: "start",
            message: "Finalizing dashboard metrics…",
          });

          const technicalIssueCounts = unified.technicalSeo?.issueCounts || {};

          let recommendationsCount = 0;
          let contentOppsCount = 0;

          const rawText2 = (unified.content?.rawText || "").trim();
          if (rawText2) {
            const wordCount = rawText2.split(/\s+/).length;
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

          unified.infoPanel = buildInfoPanel(unified);

          unified._meta = {
            url,
            domain,
            keyword: keyword || null,
            countryCode,
            languageCode,
            depth,
            providers,
            keywordsOnly: Boolean(keywordsOnly),
            generatedAt: new Date().toISOString(),
          };

          send("status", {
            stage: "finalize",
            state: "done",
            message: "Finalized",
          });

          send("done", { unified });
          controller.close();
        } catch (err) {
          try {
            controller.enqueue(
              encoder.encode(
                sseFormat("fatal", {
                  error: "Internal server error",
                  details: err?.message || "Unknown error",
                })
              )
            );
          } catch {}
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
