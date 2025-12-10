// components/content-editor/CE.ResearchPanel.js
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WandSparkles,
  Link as LinkIcon,
  HelpCircle,
  FlaskConical,
  Rocket,
} from "lucide-react";

import SeoBasics from "./research-panel/SeoBasics";
import SeoAdvancedOptimize from "./research-panel/SeoAdvancedOptimize";
import SeoAdvancedLinks from "./research-panel/SeoAdvancedLinks";
import SeoAdvancedFaqs from "./research-panel/SeoAdvancedFaqs";
import SeoAdvancedResearch from "./research-panel/SeoAdvancedResearch";
import SeoDetails from "./research-panel/SeoDetails";

/* ===========================
   Tabs
   =========================== */

const TABS = [
  { key: "basics", label: "SEO Basics", icon: Rocket },
  { key: "opt", label: "Optimize", icon: WandSparkles },
  { key: "links", label: "Links", icon: LinkIcon },
  { key: "faqs", label: "FAQ’s", icon: HelpCircle },
  { key: "research", label: "Research", icon: FlaskConical },
  // "details" is controlled by the Metrics Strip (seoMode === "details")
];

/* ===========================
   Helpers
   =========================== */

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function pickPagesFromConfig(json) {
  // Supports both { pages: [...] } and bare array [...]
  if (Array.isArray(json?.pages)) return json.pages;
  if (Array.isArray(json)) return json;
  return [];
}

function safeJsonParse(s, fallback = null) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function getSavedDomain() {
  // Step1Slide1 stores: localStorage.setItem("websiteData", JSON.stringify({ site }))
  const raw =
    typeof window !== "undefined"
      ? localStorage.getItem("websiteData")
      : null;
  const parsed = safeJsonParse(raw, {});
  return parsed?.site || "";
}

/* ===========================
   Component
   =========================== */

export default function CEResearchPanel({
  query = "",
  /**
   * Optional page object passed from the Content Editor.  If provided,
   * this page will be used directly instead of inferring the page from
   * the HTML/query.  This allows us to map to the correct optimize
   * record without falling back to the first page.
   */
  page,
  /**
   * Optional optPageId passed directly.  When provided, this value
   * takes precedence over currentPage.optPageId when matching
   * optimize-dataset pages.
   */
  optPageId,
  onQueryChange,
  onStart,
  seoMode = "basic", // "basic" | "advanced" | "details"
  metrics,
  onFix,
  onPasteToEditor,
  editorContent = "",
  // Unified live SEO data from /api/seo (injected by ContentEditor)
  seoData,
  seoLoading,
  seoError,
  /**
   * When true, enable JSON/demo datasets:
   *  - /data/optimize-dataset.json
   *  - /data/links-dataset.json
   *  - legacy page-based optimize/links data
   *
   * In production, this should be false so panels rely on seoData only.
   */
  demoMode = false,
}) {
  const [phase, setPhase] = useState("idle"); // idle | searching | results
  const [tab, setTab] = useState("opt"); // opt | links | faqs | research

  // -------- ContentEditor config (legacy/all tabs baseline) --------
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgError, setCfgError] = useState(null);
  const [pages, setPages] = useState([]);

  // Pick current page:
  // 1) Try to infer from editorContent (actual HTML in the editor)
  // 2) Fallback to query → primaryKeyword / ui.query
  // 3) Fallback to first page
  const currentPage = useMemo(() => {
    if (!pages.length) return null;

    const htmlRaw = (editorContent || "").trim();
    if (htmlRaw) {
      const htmlLower = htmlRaw.toLowerCase();

      // 1) Exact content match if content stored in config
      const exact = pages.find(
        (p) => typeof p.content === "string" && p.content.trim() === htmlRaw
      );
      if (exact) return exact;

      // 2) Score pages based on title/keyword presence in editor HTML
      let best = null;
      let bestScore = -1;

      for (const p of pages) {
        let score = 0;

        const contentStr = String(p.content || p.finalContent || "").trim();
        const contentLower = contentStr.toLowerCase();

        const title = String(p.meta?.title || p.title || "")
          .toLowerCase()
          .trim();
        if (title) {
          if (htmlLower.includes(title)) score += 10;
          if (contentLower.includes(title)) score += 2;
        }

        const pk = String(p.primaryKeyword || "").toLowerCase().trim();
        if (pk && htmlLower.includes(pk)) {
          score += 1;
        }

        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }

      if (best) return best;
    }

    // Legacy fallback: query-based behaviour
    const q = norm(query);
    const byPK = pages.find((p) => norm(p?.primaryKeyword) === q);
    if (byPK) return byPK;
    const byUI = pages.find((p) => norm(p?.ui?.query) === q);
    if (byUI) return byUI;

    // Final safety net
    return pages[0];
  }, [pages, query, editorContent]);

  // If a page prop was provided from the parent (e.g. Content Editor), use it
  // instead of the inferred currentPage.  This ensures the research panel
  // operates on the correct document and does not guess based on the
  // editor content or query alone.
  const resolvedPage = page ?? currentPage;

  // Map to your contenteditor.json shapes
  const basicsData = resolvedPage?.seoBasics || null;

  // Legacy links (fallback if links-dataset.json has no entry)
  const legacyLinksExternal = resolvedPage?.linksTab?.external || [];
  const legacyLinksInternal = resolvedPage?.linksTab?.internal || [];

  const faqs =
    resolvedPage?.faqs || {
      serp: [],
      peopleAlsoAsk: [],
      quora: [],
      reddit: [],
    };
  const detailsData = resolvedPage?.details || null;

  /** -------------------------------
   *  Research data (robust mapper)
   *  -------------------------------
   *  Supports both:
   *   resolvedPage.research = {
   *     outline: [ {level, title}, ... ],
   *     competitors: [ {...}, ... ] OR { domains: [ {...}, ... ] },
   *     heatmaps: {
   *       headingsFrequency: [], termHeat: [], serpFeatureCoverage: [], headingSerpMatrix: []
   *     }
   *   }
   *  and older shapes (heatmapsTab / competitorsTab).
   */
  const researchBlock = resolvedPage?.research || resolvedPage || {};
  const outline = Array.isArray(researchBlock?.outline)
    ? researchBlock.outline
    : Array.isArray(researchBlock?.headings)
    ? researchBlock.headings
    : [];

  const competitors = Array.isArray(researchBlock?.competitors)
    ? researchBlock.competitors
    : Array.isArray(researchBlock?.competitorsTab?.domains)
    ? researchBlock.competitorsTab.domains
    : Array.isArray(researchBlock?.research?.competitors)
    ? researchBlock.research.competitors
    : Array.isArray(researchBlock?.research?.competitors?.domains)
    ? researchBlock.research.competitors.domains
    : Array.isArray(researchBlock?.competitors?.domains)
    ? researchBlock.competitors.domains
    : [];

  const defaultHeatmaps = {
    headingsFrequency: [],
    termHeat: [],
    serpFeatureCoverage: [],
    headingSerpMatrix: [],
  };

  const heatmaps =
    researchBlock?.heatmaps ||
    researchBlock?.heatmapsTab ||
    researchBlock?.research?.heatmaps ||
    researchBlock?.research?.heatmapsTab ||
    defaultHeatmaps;

  // -------- Optimize dataset (domain-aware demo dataset) --------
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState(null);
  const [optDataset, setOptDataset] = useState(null);
  const [activeDomainKey, setActiveDomainKey] = useState(""); // saved {site}
  const [optActiveDomain, setOptActiveDomain] = useState(null);
  const [optActivePage, setOptActivePage] = useState(null);

  // ----------------------------------------------------------------------
  // Keep the active domain in sync with the page being edited.
  //
  // The optimize tab originally derives its domain from localStorage
  // (websiteData.site) only when the component mounts or the user switches
  // tabs.  If the user opens a document from a different domain, but the
  // stored site isn’t updated, the research panel will continue to read
  // from the old domain and fall back to the first page of that domain.
  // To avoid this, whenever the current page changes and has a domain
  // property, update the activeDomainKey and persist it back to
  // localStorage.  This way, `optActiveDomain` will point to the correct
  // section of optimize-dataset.json without relying solely on the tab
  // change.
  const pageDomain = resolvedPage?.domain || "";
  useEffect(() => {
    if (!pageDomain) return;
    // normalise and update activeDomainKey
    setActiveDomainKey(norm(pageDomain));
    // persist for other parts of the app that rely on websiteData
    try {
      localStorage.setItem(
        "websiteData",
        JSON.stringify({ site: pageDomain })
      );
    } catch {
      // ignore storage errors
    }
  }, [pageDomain]);

  // Load optimize dataset from /public/data/optimize-dataset.json
  useEffect(() => {
    if (!demoMode) {
      // In non-demo mode, ensure we are not "loading" and dataset is cleared
      setOptLoading(false);
      setOptError(null);
      setOptDataset(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setOptLoading(true);
        setOptError(null);
        const res = await fetch("/data/optimize-dataset.json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;
        setOptDataset(json);
      } catch (e) {
        if (!mounted) return;
        setOptError(String(e));
      } finally {
        if (mounted) setOptLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [demoMode]);

  // Track saved domain (from Step1Slide1) and choose active domain block from dataset
  useEffect(() => {
    if (!demoMode) return;
    // Read once on mount and also whenever we return to the Optimize tab
    const site = getSavedDomain();
    setActiveDomainKey(site || "");
  }, [tab, demoMode]);

  useEffect(() => {
    if (!demoMode || !optDataset || !activeDomainKey) {
      setOptActiveDomain(null);
      return;
    }
    const dom = Array.isArray(optDataset?.domains)
      ? optDataset.domains.find(
          (d) => norm(d.domain) === norm(activeDomainKey)
        )
      : null;
    setOptActiveDomain(dom || null);
  }, [optDataset, activeDomainKey, demoMode]);

  // Choose a page inside the active domain based on:
  //  1) current page's optPageId/id ↔ optimize page's editorKey/id
  //  2) fallback to query (title/url/id)
  //  3) fallback to first page in domain
  useEffect(() => {
    if (!demoMode || !optActiveDomain) {
      setOptActivePage(null);
      return;
    }

    const domPages = Array.isArray(optActiveDomain.pages)
      ? optActiveDomain.pages
      : [];

    if (!domPages.length) {
      setOptActivePage(null);
      return;
    }

    let next = null;

    // 1) Try to map by explicit editor ID (recommended flow)
    // Use the optPageId prop if provided, otherwise fall back to the
    // resolvedPage’s optPageId or id.  This prevents the research panel
    // from picking the wrong page when the inferred currentPage differs
    // from the parent-provided page.
    const editorKeyRaw =
      optPageId || resolvedPage?.optPageId || resolvedPage?.id || "";
    const editorKey = norm(editorKeyRaw);

    if (editorKey) {
      next =
        domPages.find(
          (p) => norm(p?.editorKey || p?.id) === editorKey
        ) || null;
    }

    // 2) Fallback: legacy query-based behavior
    if (!next) {
      const q = norm(query);
      if (q) {
        const byTitle = domPages.find((p) => norm(p?.title) === q);
        const byLoose =
          byTitle ||
          domPages.find(
            (p) =>
              norm(p?.title).includes(q) ||
              norm(p?.url).includes(q) ||
              norm(p?.id).includes(q)
          );
        next = byLoose || null;
      }
    }

    // 3) Final safety net: first page in the domain
    setOptActivePage(next || domPages[0] || null);
  }, [optActiveDomain, query, resolvedPage, optPageId, activeDomainKey, demoMode]);

  // Compute optimizeData to pass into <SeoAdvancedOptimize />
  // Priority (demo mode only):
  //  1) If optimize dataset found a page => use its keywords/kpis.
  //  2) Else fallback to contenteditor.json's advanced.optimize (legacy).
  const optimizeDataFromDomain = useMemo(() => {
    if (!optActivePage) return null;
    const { keywords = [], kpis = null } = optActivePage;
    return { keywords, kpis, _source: "optimize-dataset.json" };
  }, [optActivePage]);

  const optimizeDataFallback = resolvedPage?.advanced?.optimize || null;
  const optimizeData = demoMode
    ? optimizeDataFromDomain || optimizeDataFallback
    : null;

  // -------- Links dataset (page-specific, domain-aware) --------
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState(null);
  const [linksDataset, setLinksDataset] = useState(null);
  const [linksActiveDomain, setLinksActiveDomain] = useState(null);
  const [linksActivePage, setLinksActivePage] = useState(null);

  // Load links dataset from /public/data/links-dataset.json
  useEffect(() => {
    if (!demoMode) {
      setLinksLoading(false);
      setLinksError(null);
      setLinksDataset(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLinksLoading(true);
        setLinksError(null);
        const res = await fetch("/data/links-dataset.json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;
        setLinksDataset(json);
      } catch (e) {
        if (!mounted) return;
        setLinksError(String(e));
      } finally {
        if (mounted) setLinksLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [demoMode]);

  // Choose active domain in links dataset using the same activeDomainKey
  useEffect(() => {
    if (!demoMode || !linksDataset || !activeDomainKey) {
      setLinksActiveDomain(null);
      return;
    }
    const dom = Array.isArray(linksDataset?.domains)
      ? linksDataset.domains.find(
          (d) => norm(d.domain) === norm(activeDomainKey)
        )
      : null;
    setLinksActiveDomain(dom || null);
  }, [linksDataset, activeDomainKey, demoMode]);

  // Choose a page in the links dataset for the current domain
  useEffect(() => {
    if (!demoMode || !linksActiveDomain) {
      setLinksActivePage(null);
      return;
    }

    const domPages = Array.isArray(linksActiveDomain.pages)
      ? linksActiveDomain.pages
      : [];

    if (!domPages.length) {
      setLinksActivePage(null);
      return;
    }

    let next = null;

    // Same mapping strategy as Optimize (editorKey/id first, then query, then first page)
    const editorKeyRaw =
      optPageId || resolvedPage?.optPageId || resolvedPage?.id || "";
    const editorKey = norm(editorKeyRaw);

    if (editorKey) {
      next =
        domPages.find(
          (p) => norm(p?.editorKey || p?.id) === editorKey
        ) || null;
    }

    if (!next) {
      const q = norm(query);
      if (q) {
        const byTitle = domPages.find((p) => norm(p?.title) === q);
        const byLoose =
          byTitle ||
          domPages.find(
            (p) =>
              norm(p?.title).includes(q) || norm(p?.id).includes(q)
          );
        next = byLoose || null;
      }
    }

    setLinksActivePage(next || domPages[0] || null);
  }, [linksActiveDomain, query, resolvedPage, optPageId, demoMode]);

  // Final links data (dataset → fallback to legacy) in demo mode only
  const linksExternalFromDataset =
    linksActivePage?.linksTab?.external || [];
  const linksInternalFromDataset =
    linksActivePage?.linksTab?.internal || [];

  const linksExternal = demoMode
    ? (linksExternalFromDataset.length > 0
        ? linksExternalFromDataset
        : legacyLinksExternal)
    : null;

  const linksInternal = demoMode
    ? (linksInternalFromDataset.length > 0
        ? linksInternalFromDataset
        : legacyLinksInternal)
    : null;

  // -------- Access gate (same as before) --------
  const canAccess =
    !!query?.trim() &&
    (phase === "searching" || phase === "results");

  /* ===========================
     BASIC mode
     =========================== */
  if (seoMode === "basic") {
    return (
      <SeoBasics
        query={query}
        onQueryChange={onQueryChange}
        onStart={onStart}
        onFix={onFix}
        onPasteToEditor={onPasteToEditor}
        phase={phase}
        setPhase={setPhase}
        currentPage={resolvedPage}
        cfgLoading={cfgLoading}
        cfgError={cfgError}
        basicsData={basicsData}
      />
    );
  }

  /* ===========================
     DETAILS view
     =========================== */
  if (seoMode === "details") {
    if (!canAccess) {
      return (
        <aside className="h-full rounded-r-[18px] border-l border-[var(--border)] bg-white px-6 py-5 flex items-center justify-center transition-colors">
          <div className="text-center">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">
              Details locked
            </div>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              Type a keyword and click{" "}
              <span className="font-medium text-[var(--text-primary)]">
                Start
              </span>{" "}
              in SEO Basics to unlock Details.
            </p>
          </div>
        </aside>
      );
    }
    return (
      <SeoDetails
        onPasteToEditor={onPasteToEditor}
        currentPage={resolvedPage}
        detailsData={detailsData}
        seoData={seoData}
        seoLoading={seoLoading}
        seoError={seoError}
      />
    );
  }

  /* ===========================
     ADVANCED mode
     =========================== */
  return (
    <aside className="h-full rounded-r-[18px] border-l border-[var(--border)] bg-white px-5 md:px-6 py-5 flex flex-col gap-3 transition-colors">
      {/* Top navigation tabs */}
      <div className="flex items-center justify-between gap-1 w-full flex-nowrap">
        {TABS.slice(1).map(({ key, label, icon: Icon }) => {
          const isActive = tab === key;
          const disabled = !canAccess;
          return (
            <button
              key={key}
              onClick={() => !disabled && setTab(key)}
              title={label}
              disabled={disabled}
              className={`flex items-center justify-center gap-1 rounded-lg border flex-auto px-2.5 py-1.5 text-[12px] font-medium transition-all
                ${
                  isActive
                    ? "bg-white border-amber-400 text-amber-600 shadow-sm"
                    : "bg-white border-[var(--border)] text-[var(--text-primary)] hover:bg-gray-50"
                }
                ${
                  disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }
              `}
              style={{
                minWidth: "fit-content",
                whiteSpace: "nowrap",
              }}
            >
              <Icon
                size={13}
                className={`shrink-0 ${
                  disabled
                    ? "text-[var(--muted)]"
                    : isActive
                    ? "text-amber-600"
                    : "text-[var(--muted)]"
                }`}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Message if locked */}
      {!canAccess && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/40 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200 transition-colors">
          Type a keyword and click{" "}
          <span className="font-semibold text-amber-900 dark:text-amber-100">
            Start
          </span>{" "}
          in SEO Basics to unlock Advanced tools.
        </div>
      )}

      {/* Loading/Error states for config/optimize/links datasets */}
      {canAccess &&
        (cfgLoading || (demoMode && (optLoading || linksLoading))) && (
          <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[12px] text-[var(--muted)]">
            Loading research…
          </div>
        )}
      {canAccess &&
        (cfgError ||
          (demoMode && (optError || linksError))) && (
          <div className="rounded-xl border border-rose-300 bg-rose-50/70 dark:bg-rose-950/40 px-3 py-2 text-[12px] text-rose-800 dark:text-rose-200">
            Failed to load data: {cfgError || optError || linksError}
          </div>
        )}

      {/* Advanced panels */}
      {canAccess &&
        !cfgLoading &&
        (!demoMode || (!optLoading && !linksLoading)) &&
        !(cfgError || (demoMode && (optError || linksError))) && (
          <>
            {tab === "opt" && (
              <SeoAdvancedOptimize
                onPasteToEditor={onPasteToEditor}
                // In production, this will be null and the panel uses seoData only.
                optimizeData={optimizeData}
                currentPage={resolvedPage}
                basicsData={basicsData}
                editorContent={editorContent}
                seoData={seoData}
                seoLoading={seoLoading}
                seoError={seoError}
              />
            )}

            {tab === "links" && (
              <SeoAdvancedLinks
                onPasteToEditor={onPasteToEditor}
                // In production, these will be null and the panel uses seoData only.
                linksExternal={linksExternal}
                linksInternal={linksInternal}
                currentPage={resolvedPage}
                seoData={seoData}
                seoLoading={seoLoading}
                seoError={seoError}
              />
            )}

            {tab === "faqs" && (
              <SeoAdvancedFaqs
                onPasteToEditor={onPasteToEditor}
                faqs={faqs}
                currentPage={resolvedPage}
                seoData={seoData}
                seoLoading={seoLoading}
                seoError={seoError}
              />
            )}

            {tab === "research" && (
              <SeoAdvancedResearch
                editorContent={editorContent}
                onPasteToEditor={onPasteToEditor}
                // 🔽 ensure Research tab has ALL data
                outline={outline}
                competitors={competitors}
                heatmaps={heatmaps}
                currentPage={resolvedPage}
                basicsData={basicsData}
                optimizeData={optimizeData}
                linksExternal={linksExternal}
                faqs={faqs}
                seoData={seoData}
                seoLoading={seoLoading}
                seoError={seoError}
              />
            )}
          </>
        )}
    </aside>
  );
}
