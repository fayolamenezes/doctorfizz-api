// components/content-editor/SeoAdvancedResearch.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, Plus, MoreHorizontal, Copy as CopyIcon } from "lucide-react";

/* ===============================
   UI atoms (theme-aware)
================================ */
function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] text-[var(--text-primary)] transition-colors">
      {children}
    </span>
  );
}

function HBadge({ level = "H1" }) {
  const color =
    level === "H1"
      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
      : level === "H2"
      ? "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700"
      : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700";
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-md border text-[11px] font-semibold ${color} transition-colors`}
      title={level}
    >
      {String(level).replace("H", "")}
    </span>
  );
}

function RowIconButton({ children, title }) {
  return (
    <button
      type="button"
      title={title}
      className="grid h-7 w-7 place-items-center rounded-md border border-[var(--border)] bg-white text-[var(--text-primary)] hover:bg-gray-50 transition-colors"
    >
      {children}
    </button>
  );
}

/* Slim wireframe Copy icon that only shows on hover */
function IconHintButton({
  onClick,
  label = "Paste to editor",
  size = 18,
  className = "",
}) {
  return (
    <div
      className={`relative opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto ${className}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        aria-label={label}
        className="p-0 m-0 inline-flex items-center justify-center leading-none align-middle focus:outline-none h-8 w-8"
      >
        <CopyIcon
          size={size}
          strokeWidth={1.5}
          className="text-gray-500 hover:text-gray-600 transition-colors"
        />
      </button>

      <span
        className="pointer-events-none absolute -top-7 right-0 rounded-md border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm opacity-0 transition-opacity duration-75 whitespace-nowrap
                   group-hover:opacity-100 group-focus-within:opacity-100
                   dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)]"
      >
        {label}
      </span>
    </div>
  );
}

/* ===============================
   Outline Row (labels injected)
================================ */
function OutlineRow({
  level = "H2",
  title,
  onPaste,
  onAddInstruction,
  ui = {},
}) {
  const indent =
    level === "H1" ? "pl-2" : level === "H2" ? "pl-6" : "pl-10"; // H3

  const addInstructionLabel = ui?.actions?.addInstruction ?? "+ Add Instruction";
  const pasteLabel = ui?.actions?.paste ?? "Paste to editor";
  const moreTitle = ui?.titles?.more ?? "More";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white hover:bg-gray-50 transition-colors">
      <div
        className={`group flex items-center justify-between gap-3 px-3 py-2.5 ${indent}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <HBadge level={level} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
              {title}
            </div>
            <button
              type="button"
              onClick={onAddInstruction}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:underline"
            >
              {addInstructionLabel}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <IconHintButton onClick={onPaste} label={pasteLabel} />
          <RowIconButton title={moreTitle}>
            <MoreHorizontal size={14} className="text-[var(--muted)]" />
          </RowIconButton>
        </div>
      </div>
    </div>
  );
}

/* ===============================
   Small UI helpers for Competitors/Heatmaps
================================ */
function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
        {value}
      </div>
      {sub ? <div className="text-[11px] text-[var(--muted)]">{sub}</div> : null}
    </div>
  );
}

function SimpleTable({ columns = [], rows = [] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="min-w-full text-left text-[12px]">
        <thead className="bg-white text-[var(--muted)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-3 py-3 text-[var(--muted)]"
                colSpan={columns.length}
              >
                No data.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2">
                    {typeof c.render === "function"
                      ? c.render(r[c.key], r)
                      : r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Sticky section label used inside scrollable Heatmaps pane
function SectionLabel({ children }) {
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur px-1 py-1 border-b border-[var(--border)] text-[12px] font-semibold text-[var(--text-primary)]">
      {children}
    </div>
  );
}

/* ===============================
   Helpers (API-only version)
================================ */

// Default UI labels (we no longer get them from JSON)
const DEFAULT_UI = {
  tabs: {
    outline: "Outline",
    competitors: "Competitor’s",
    heatmaps: "Heatmap’s",
  },
  actions: {
    aiHeadings: "Ai Headings",
    generateArticle: "Generate article",
    paste: "Paste to editor",
    addInstruction: "+ Add Instruction",
  },
  counters: {
    headingsSuffix: "Headings",
  },
  titles: {
    more: "More",
  },
  emptyStates: {
    outline: "No headings found yet.",
    competitors: "No competitor data from SEO API.",
    heatmaps: "No heatmap data from SEO API.",
  },
};

// Normalize domain from URL / host
function getDomainFromUrl(url) {
  if (!url) return "";
  try {
    const hasProto = /^https?:\/\//i.test(url);
    const u = new URL(hasProto ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(url).replace(/^www\./i, "").toLowerCase();
  }
}

// Extract headings from editor HTML
function extractHeadingsFromHtml(html) {
  if (typeof window === "undefined" || !html) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const out = [];
    const push = (level, text) => {
      const t = (text || "").trim();
      if (!t) return;
      out.push({ level, title: t });
    };
    doc.querySelectorAll("h1").forEach((node) =>
      push("H1", node.textContent)
    );
    doc.querySelectorAll("h2").forEach((node) =>
      push("H2", node.textContent)
    );
    doc.querySelectorAll("h3").forEach((node) =>
      push("H3", node.textContent)
    );
    return out;
  } catch {
    return [];
  }
}

// Build outline using editor headings first, then SERP titles as fallback
function buildOutline({ seoData, editorContent }) {
  const seen = new Set();
  const out = [];

  const add = (level, title) => {
    const t = (title || "").trim();
    if (!t) return;
    const key = `${level}|${t}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ level, title: t });
  };

  // 1) Editor headings (primary)
  const editorHeads = extractHeadingsFromHtml(editorContent);
  editorHeads.forEach((h) => add(h.level || "H2", h.title));

  // 2) Fallback: SERP top result titles as H2/H3 if we still have nothing
  if (out.length === 0 && seoData?.serp?.topResults?.length) {
    seoData.serp.topResults.slice(0, 6).forEach((item, idx) => {
      const lvl = idx === 0 ? "H1" : "H2";
      add(lvl, item.title || "");
    });
  }

  return out;
}

// Build competitor rows from DataForSEO + Serper
function buildCompetitors(seoData) {
  const rows = [];
  const seen = new Set();

  const pushRow = (row) => {
    const dom = getDomainFromUrl(row.domain);
    if (!dom) return;
    if (seen.has(dom)) {
      // merge sample URLs if needed
      const existing = rows.find((r) => getDomainFromUrl(r.domain) === dom);
      if (existing) {
        const urls = new Set(existing.sampleUrls || []);
        (row.sampleUrls || []).forEach((u) => urls.add(u));
        existing.sampleUrls = Array.from(urls);
      }
      return;
    }
    seen.add(dom);
    rows.push(row);
  };

  const dfs = seoData?.dataForSeo || {};
  const serpItems = Array.isArray(dfs.serpItems) ? dfs.serpItems : [];

  serpItems.forEach((item) => {
    const domain =
      item.domain ||
      item.target ||
      getDomainFromUrl(item.url || item.landingPage || item.targetUrl || "");
    if (!domain) return;
    const authority =
      Number(
        item.domainRank ??
          item.domain_rank ??
          item.rank ??
          item.rating ??
          item.ahrefs_rank ??
          0
      ) || null;
    const estimatedTrafficK =
      Math.round(
        (Number(
          item.traffic ??
            item.estimatedTraffic ??
            item.organic_traffic ??
            0
        ) || 0) / 1000
      ) || null;
    const commonKeywords =
      Number(
        item.commonKeywords ??
          item.overlapKeywords ??
          item.keywordCount ??
          item.keywords ??
          0
      ) || null;
    const sampleUrls = [];
    if (item.url) sampleUrls.push(item.url);
    if (item.landingPage) sampleUrls.push(item.landingPage);
    if (item.targetUrl) sampleUrls.push(item.targetUrl);

    pushRow({
      domain,
      authority,
      estimatedTrafficK,
      commonKeywords,
      sampleUrls,
    });
  });

  // Also fold in Serper top results as "lightweight" competitors
  const topResults = seoData?.serp?.topResults || [];
  topResults.forEach((r) => {
    const domain = getDomainFromUrl(r.link || r.url);
    if (!domain) return;
    const sampleUrls = [];
    if (r.link) sampleUrls.push(r.link);
    if (r.url) sampleUrls.push(r.url);

    pushRow({
      domain,
      authority: null,
      estimatedTrafficK: null,
      commonKeywords: null,
      sampleUrls,
    });
  });

  return rows;
}

// Build heatmaps from outline + SEO API
function buildHeatmaps(seoData, outline) {
  const heat = {
    headingsFrequency: [],
    termHeat: [],
    serpFeatureCoverage: [],
    headingSerpMatrix: [],
  };

  // Headings frequency from outline
  if (Array.isArray(outline) && outline.length) {
    const map = new Map();
    outline.forEach((h) => {
      const key = (h.title || "").trim();
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    heat.headingsFrequency = Array.from(map.entries()).map(
      ([heading, count]) => ({ heading, count })
    );
  }

  // Term heat from DataForSEO topKeywords
  const kws = seoData?.dataForSeo?.topKeywords || [];
  heat.termHeat = kws.map((k) => {
    const term = k.keyword || k.key || k.term || "";
    const score =
      k.searchVolume ??
      k.search_volume ??
      k.volume ??
      k.traffic ??
      k.estimatedTraffic ??
      k.keywordDifficulty ??
      k.difficulty ??
      0;
    return { term, score };
  }).filter((r) => r.term);

  // SERP Feature coverage from Serper + DataForSEO serpFeatures
  const fSerper = seoData?.serp?.serpFeatures || {};
  const fDfs = seoData?.dataForSeo?.serpFeatures || {};
  const features = [
    ["featuredSnippets", "Featured Snippets"],
    ["peopleAlsoAsk", "People Also Ask"],
    ["imagePack", "Image Pack"],
    ["videoResults", "Video Results"],
    ["knowledgePanel", "Knowledge Panel"],
  ];

  heat.serpFeatureCoverage = features.map(([key, label]) => {
    const count =
      Number(fSerper[key] ?? 0) + Number(fDfs[key] ?? 0);
    return {
      feature: label,
      presence: count > 0,
      count,
    };
  });

  // Heading ↔ SERP matrix: simple matching of heading text inside SERP titles
  const topResults = seoData?.serp?.topResults || [];
  if (outline.length && topResults.length) {
    heat.headingSerpMatrix = outline.map((h) => {
      const text = (h.title || "").toLowerCase();
      const matches = topResults.filter((r) => {
        const title = (r.title || "").toLowerCase();
        return text && title.includes(text);
      });

      const serpMentions = matches.length;
      let avgPosition = 0;
      if (serpMentions > 0) {
        const sumPos = matches.reduce((sum, r, idx) => {
          const pos =
            Number(r.position ?? r.rank ?? r.index ?? idx + 1) || 1;
          return sum + pos;
        }, 0);
        avgPosition = Math.round(sumPos / serpMentions);
      }

      return {
        heading: h.title,
        serpMentions,
        avgPosition,
      };
    });
  }

  return heat;
}

/* ===============================
   Component (API-only)
================================ */
export default function SeoAdvancedResearch({
  editorContent,
  onPasteToEditor,
  /** Optional: current domain/URL (not strictly needed now but kept for future) */
  domain,
  /** Visual height for the outline/heatmaps list */
  maxListHeight = "30rem",
  /** Unified SEO data from /api/seo */
  seoData,
  seoLoading,
  seoError,
}) {
  const [tab, setTab] = useState("outline"); // outline | competitors | heatmaps

  // "pages" concept is gone – we just work with outline arrays
  const [pageIdx, setPageIdx] = useState(0); // 0 = Tab 1 (source), 1 = Tab 2 (curated)
  const [tab2Headings, setTab2Headings] = useState([]);

  const ui = DEFAULT_UI;

  /* ===============================
     Outline from editor + SEO
  ================================ */
  const outline = useMemo(
    () => buildOutline({ seoData, editorContent }),
    [seoData, editorContent]
  );

  // current list depends on page chip (Tab 1 vs Tab 2)
  const currentList = pageIdx === 0 ? outline : tab2Headings;
  const countLabel = `${currentList.length} ${
    ui?.counters?.headingsSuffix ?? "Headings"
  }`;

  const addToTab2 = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    setTab2Headings((prev) => {
      const seen = new Set(
        prev.map((r) => `${r.level}|${r.title}`.toLowerCase())
      );
      const toAdd = rows.filter((r) => {
        const k = `${r.level}|${r.title}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return [...prev, ...toAdd];
    });
  };

  /* ===============================
     Competitors & Heatmaps
  ================================ */
  const competitors = useMemo(
    () => buildCompetitors(seoData),
    [seoData]
  );
  const heatmaps = useMemo(
    () => buildHeatmaps(seoData, outline),
    [seoData, outline]
  );

  // Loading / error: SEO data is optional, but when it's explicitly loading / errored
  const loading = !!seoLoading;
  const error = seoError || "";

  /* ===============================
     Render
  ================================ */
  return (
    <div className="mt-1 rounded-2xl border border-[var(--border)] bg-white p-3 transition-colors">
      <div className="flex items-center justify-between gap-3">
        {/* Tabs (labels from defaults) */}
        <div className="flex items-center gap-6 border-b border-[var(--border)] px-1 transition-colors">
          <button
            onClick={() => setTab("outline")}
            className={`px-2 pb-2 text-[12px] font-semibold transition-all ${
              tab === "outline"
                ? "text-[var(--text-primary)] border-b-2 border-amber-400"
                : "text-[var(--muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {ui?.tabs?.outline ?? "Outline"}
          </button>
          <button
            onClick={() => setTab("competitors")}
            className={`px-2 pb-2 text-[12px] font-semibold transition-all ${
              tab === "competitors"
                ? "text-[var(--text-primary)] border-b-2 border-amber-400"
                : "text-[var(--muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {ui?.tabs?.competitors ?? "Competitor’s"}
          </button>
          <button
            onClick={() => setTab("heatmaps")}
            className={`px-2 pb-2 text-[12px] font-semibold transition-all ${
              tab === "heatmaps"
                ? "text-[var(--text-primary)] border-b-2 border-amber-400"
                : "text-[var(--muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {ui?.tabs?.heatmaps ?? "Heatmap’s"}
          </button>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          <Chip>{countLabel}</Chip>

          {/* Page chips: 1 2 + */}
          <div className="flex items-center gap-1">
            <button
              className={`h-7 w-7 rounded-md border text-[12px] ${
                pageIdx === 0
                  ? "font-semibold border-[var(--border)]"
                  : "text-[var(--muted)] border-[var(--border)]"
              }`}
              onClick={() => setPageIdx(0)}
              title="Tab 1"
            >
              1
            </button>
            <button
              className={`h-7 w-7 rounded-md border text-[12px] ${
                pageIdx === 1
                  ? "font-semibold border-[var(--border)]"
                  : "text-[var(--muted)] border-[var(--border)]"
              }`}
              onClick={() => setPageIdx(1)}
              title="Tab 2"
            >
              2
            </button>
            <button
              className="h-7 w-7 rounded-md border border-dashed text-[12px] text-[var(--muted)]"
              onClick={() => setPageIdx(1)}
              title="New Tab"
            >
              +
            </button>
          </div>

          {/* Ai Headings -> copies from outline into Tab 2 */}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] hover:bg-gray-50 transition-colors"
            onClick={() => {
              if (pageIdx === 0) {
                addToTab2(outline);
                setPageIdx(1);
              }
            }}
          >
            <Sparkles size={14} /> {ui?.actions?.aiHeadings ?? "Ai Headings"}
          </button>

          {/* Generate article (paste current page items into editor, appended) */}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
            onClick={() => {
              (currentList || []).forEach((h) => {
                onPasteToEditor?.({ level: h.level, title: h.title }, "editor");
              });
            }}
          >
            <Plus size={14} />{" "}
            {ui?.actions?.generateArticle ?? "Generate article"}
          </button>
        </div>
      </div>

      {/* Outline */}
      {tab === "outline" && (
        <div
          className="mt-3 overflow-y-auto pr-1"
          style={{ maxHeight: maxListHeight }}
        >
          {/* Outline does NOT strictly need SEO data; it works off editor HTML,
              so we only show loading if SEO is loading AND we have no headings yet. */}
          {seoLoading && outline.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              Loading outline…
            </div>
          ) : error && outline.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {error}
            </div>
          ) : currentList.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {ui?.emptyStates?.outline ?? "No headings found yet."}
            </div>
          ) : (
            <div className="space-y-2">
              {currentList.map((h, i) => (
                <OutlineRow
                  key={`${h.level}-${i}-${h.title}`}
                  level={h.level}
                  title={h.title}
                  ui={ui}
                  onPaste={() => {
                    onPasteToEditor?.(
                      { level: h.level, title: h.title },
                      "editor"
                    );
                  }}
                  onAddInstruction={() =>
                    onPasteToEditor?.(
                      {
                        level: "H3",
                        title: `Add instruction for: ${h.title}`,
                      },
                      "editor"
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Competitors */}
      {tab === "competitors" && (
        <div className="mt-3 space-y-3">
          {loading && competitors.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              Loading competitors…
            </div>
          ) : error && competitors.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {error}
            </div>
          ) : competitors.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {ui?.emptyStates?.competitors ??
                "No competitor data from SEO API."}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Competitors" value={competitors.length} />
                <Stat
                  label="Avg. Authority"
                  value={
                    Math.round(
                      (competitors.reduce(
                        (s, c) => s + (Number(c.authority) || 0),
                        0
                      ) /
                        competitors.length) || 0
                    )
                  }
                />
                <Stat
                  label="Avg. Est. Traffic (K)"
                  value={
                    Math.round(
                      (competitors.reduce(
                        (s, c) => s + (Number(c.estimatedTrafficK) || 0),
                        0
                      ) /
                        competitors.length) || 0
                    )
                  }
                />
                <Stat
                  label="Avg. Common Keywords"
                  value={
                    Math.round(
                      (competitors.reduce(
                        (s, c) => s + (Number(c.commonKeywords) || 0),
                        0
                      ) /
                        competitors.length) || 0
                    )
                  }
                />
              </div>

              <SimpleTable
                columns={[
                  { key: "domain", label: "Domain" },
                  { key: "authority", label: "Authority" },
                  { key: "estimatedTrafficK", label: "Est. Traffic (K)" },
                  { key: "commonKeywords", label: "Common Keywords" },
                  {
                    key: "sampleUrls",
                    label: "Sample URLs",
                    render: (val) => (
                      <div className="flex flex-wrap gap-2">
                        {(val || [])
                          .slice(0, 3)
                          .map((u, idx) => (
                            <a
                              key={idx}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate max-w-[16rem] text-[11px] underline text-[var(--text-primary)]"
                              title={u}
                            >
                              {u}
                            </a>
                          ))}
                      </div>
                    ),
                  },
                ]}
                rows={competitors}
              />
            </>
          )}
        </div>
      )}

      {/* Heatmaps (fixed-height scroll area) */}
      {tab === "heatmaps" && (
        <div
          className="mt-3 overflow-y-auto pr-1 space-y-4"
          style={{ maxHeight: maxListHeight }}
        >
          {loading && !error && !heatmaps.termHeat.length ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              Loading heatmaps…
            </div>
          ) : error && !heatmaps.termHeat.length ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {error}
            </div>
          ) : !heatmaps.headingsFrequency.length &&
            !heatmaps.termHeat.length &&
            !heatmaps.serpFeatureCoverage.length &&
            !heatmaps.headingSerpMatrix.length ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {ui?.emptyStates?.heatmaps ??
                "No heatmap data from SEO API."}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <SectionLabel>Headings Frequency</SectionLabel>
                <SimpleTable
                  columns={[
                    { key: "heading", label: "Heading" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={heatmaps.headingsFrequency || []}
                />
              </div>

              <div className="space-y-2">
                <SectionLabel>Term Heat</SectionLabel>
                <SimpleTable
                  columns={[
                    { key: "term", label: "Term" },
                    { key: "score", label: "Score" },
                  ]}
                  rows={heatmaps.termHeat || []}
                />
              </div>

              <div className="space-y-2">
                <SectionLabel>SERP Feature Coverage</SectionLabel>
                <SimpleTable
                  columns={[
                    { key: "feature", label: "Feature" },
                    {
                      key: "presence",
                      label: "Present",
                      render: (v) => (
                        <span
                          className={`px-2 py-0.5 rounded-md border ${
                            v
                              ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                              : "border-gray-300 text-gray-600 bg-gray-50"
                          }`}
                        >
                          {v ? "Yes" : "No"}
                        </span>
                      ),
                    },
                    { key: "count", label: "Count" },
                  ]}
                  rows={heatmaps.serpFeatureCoverage || []}
                />
              </div>

              <div className="space-y-2">
                <SectionLabel>Heading ↔ SERP Matrix</SectionLabel>
                <SimpleTable
                  columns={[
                    { key: "heading", label: "Heading" },
                    { key: "serpMentions", label: "SERP Mentions" },
                    { key: "avgPosition", label: "Avg. Position" },
                  ]}
                  rows={heatmaps.headingSerpMatrix || []}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
