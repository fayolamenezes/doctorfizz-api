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
function IconHintButton({ onClick, label = "Paste to editor", size = 18, className = "" }) {
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
        <CopyIcon size={size} strokeWidth={1.5} className="text-gray-500 hover:text-gray-600 transition-colors" />
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
function OutlineRow({ level = "H2", title, onPaste, onAddInstruction, ui = {} }) {
  const indent =
    level === "H1" ? "pl-2" :
    level === "H2" ? "pl-6" :
    "pl-10"; // H3

  const addInstructionLabel = ui?.actions?.addInstruction ?? "+ Add Instruction";
  const pasteLabel = ui?.actions?.paste ?? "Paste to editor";
  const moreTitle = ui?.titles?.more ?? "More";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white hover:bg-gray-50 transition-colors">
      <div className={`group flex items-center justify-between gap-3 px-3 py-2.5 ${indent}`}>
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
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">{value}</div>
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
              <th key={c.key} className="px-3 py-2 font-semibold">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.length === 0 ? (
            <tr><td className="px-3 py-3 text-[var(--muted)]" colSpan={columns.length}>No data.</td></tr>
          ) : rows.map((r, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2">
                  {typeof c.render === "function" ? c.render(r[c.key], r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
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
   Helpers
================================ */
function normalizePages(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.pages)) return json.pages;
  return [json];
}

// Normalize to bare host (no protocol, lowercased, no leading www.)
function toHost(input = "") {
  try {
    const str = String(input).trim();
    if (!str) return "";
    const withProto = /^https?:\/\//i.test(str) ? str : `https://${str}`;
    const u = new URL(withProto);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(input).replace(/^www\./i, "").toLowerCase();
  }
}

// Safely get a page's domain host from multiple possible locations
function pageHost(p) {
  return toHost(
    p?.domain ||
      p?.details?.meta?.domain ||
      p?.meta?.domain ||
      ""
  );
}

/* Grab UI labels for the host (merged with defaults) */
function extractUiForHost(pages) {
  const page = pages?.[0] || {};
  const defaults = {
    tabs: { outline: "Outline", competitors: "Competitor’s", heatmaps: "Heatmap’s" },
    actions: { aiHeadings: "Ai Headings", generateArticle: "Generate article", paste: "Paste to editor", addInstruction: "+ Add Instruction" },
    counters: { headingsSuffix: "Headings" },
    titles: { more: "More" },
    emptyStates: {
      outline: "No headings found for this domain.",
      competitors: "No competitor data in JSON for this domain.",
      heatmaps: "No heatmap data in JSON for this domain.",
    },
  };
  const ui = page?.ui || {};
  return {
    tabs: { ...defaults.tabs, ...(ui.tabs || {}) },
    actions: { ...defaults.actions, ...(ui.actions || {}) },
    counters: { ...defaults.counters, ...(ui.counters || {}) },
    titles: { ...defaults.titles, ...(ui.titles || {}) },
    emptyStates: { ...defaults.emptyStates, ...(ui.emptyStates || {}) },
  };
}

/* ===============================
   Component
================================ */
export default function SeoAdvancedResearch({
  editorContent,
  onPasteToEditor,
  /** If provided, we scope strictly to this domain/URL */
  domain,
  /** Visual height for the outline/heatmaps list */
  maxListHeight = "30rem",
}) {
  const [tab, setTab] = useState("outline"); // outline | competitors | heatmaps
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // "pages" concept like your screenshot: Tab 1 (source outline) and Tab 2 (user-curated)
  const [pageIdx, setPageIdx] = useState(0); // 0 = Tab 1, 1 = Tab 2
  const [tab2Headings, setTab2Headings] = useState([]);

  // Fetch JSON once (with abort safety)
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/data/research-advanced.json", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRaw(data);
        setError("");
      } catch (e) {
        if (e.name !== "AbortError") {
          setError(e?.message || "Failed to load research-advanced.json");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Derive the ACTIVE host
  const activeHost = useMemo(() => {
    const arr = normalizePages(raw);
    if (!arr.length) return "";

    if (domain) return toHost(domain);

    // Try the saved editor query from localStorage
    let savedQuery = "";
    try {
      const rawLS = typeof window !== "undefined" ? localStorage.getItem("content-editor-state") : null;
      if (rawLS) {
        const saved = JSON.parse(rawLS);
        savedQuery = String(saved?.query || "").toLowerCase().trim();
      }
    } catch {}

    if (savedQuery) {
      const hit = arr.find((p) => {
        const q = (p?.ui?.query || p?.primaryKeyword || "").toLowerCase().trim();
        return q && q === savedQuery;
      });
      if (hit) return pageHost(hit);
    }

    const hosts = Array.from(new Set(arr.map(pageHost).filter(Boolean)));
    if (hosts.length === 1) return hosts[0];
    return "";
  }, [raw, domain]);

  // Filter pages: if no active host, use ALL pages so competitors/heatmaps don't disappear.
  const pages = useMemo(() => {
    const arr = normalizePages(raw);
    if (!arr.length) return [];
    if (!activeHost) return arr;
    return arr.filter((p) => pageHost(p) === activeHost);
  }, [raw, activeHost]);

  // UI labels for this host (merged with defaults)
  const ui = useMemo(() => extractUiForHost(pages), [pages]);

  /* ===============================
     Outline data
  ================================ */
  const outline = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = (level, title) => {
      const key = `${level}|${title}`.toLowerCase();
      if (title && !seen.has(key)) {
        seen.add(key);
        out.push({ level: level || "H2", title });
      }
    };
    for (const page of pages) {
      const heads = Array.isArray(page?.headings) ? page.headings : null;
      if (heads && heads.length) {
        heads.forEach((h) => push(h.level || "H2", h.title || ""));
      }
    }
    // Fallback: derive from editor only if JSON had nothing
    if (out.length === 0 && editorContent) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(editorContent, "text/html");
        ["H1", "H2", "H3"].forEach((tag) => {
          doc.querySelectorAll(tag.toLowerCase()).forEach((node) => {
            const text = (node.textContent || "").trim();
            if (text) push(tag, text);
          });
        });
      } catch {}
    }
    return out;
  }, [pages, editorContent]);

  // Current list depends on page chip (Tab 1 vs Tab 2)
  const currentList = pageIdx === 0 ? outline : tab2Headings;
  const countLabel = `${currentList.length} ${ui?.counters?.headingsSuffix ?? "Headings"}`;

  // Helpers
  const addToTab2 = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    setTab2Headings((prev) => {
      const seen = new Set(prev.map((r) => `${r.level}|${r.title}`.toLowerCase()));
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
     Competitors data (robust)
  ================================ */
  const competitors = useMemo(() => {
    const all = [];
    for (const p of pages) {
      // Collect candidate arrays from multiple possible shapes
      const candidates = []
        .concat(
          Array.isArray(p?.competitorsTab?.domains) ? [p.competitorsTab.domains] : [],
          Array.isArray(p?.competitors) ? [p.competitors] : [],
          Array.isArray(p?.competitors?.domains) ? [p.competitors.domains] : [],
          Array.isArray(p?.research?.competitors) ? [p.research.competitors] : [],
          Array.isArray(p?.research?.competitors?.domains) ? [p.research.competitors.domains] : []
        )
        .flat();

      for (const d of candidates) {
        if (!d || !d.domain) continue;
        all.push({
          domain: d.domain,
          authority: d.authority ?? null,
          estimatedTrafficK: d.estimatedTrafficK ?? null,
          commonKeywords: d.commonKeywords ?? null,
          sampleUrls: Array.isArray(d.sampleUrls) ? d.sampleUrls : [],
        });
      }
    }
    // Deduplicate by domain
    const seen = new Set();
    const deduped = [];
    for (const row of all) {
      if (seen.has(row.domain)) continue;
      seen.add(row.domain);
      deduped.push(row);
    }
    return deduped;
  }, [pages]);

  /* ===============================
     Heatmaps data (robust)
  ================================ */
  const heatmaps = useMemo(() => {
    const out = {
      headingsFrequency: [],
      termHeat: [],
      serpFeatureCoverage: [],
      headingSerpMatrix: [],
    };

    const pushAll = (arr, key) => {
      if (Array.isArray(arr)) out[key].push(...arr);
    };

    for (const p of pages) {
      // Accept several shapes
      const h =
        p?.heatmapsTab ||
        p?.heatmaps ||
        p?.research?.heatmaps ||
        p?.research?.heatmapsTab ||
        null;

      if (!h) continue;

      pushAll(h.headingsFrequency, "headingsFrequency");
      pushAll(h.termHeat, "termHeat");
      pushAll(h.serpFeatureCoverage, "serpFeatureCoverage");
      pushAll(h.headingSerpMatrix, "headingSerpMatrix");
    }
    return out;
  }, [pages]);

  /* ===============================
     Render
  ================================ */
  return (
    <div className="mt-1 rounded-2xl border border-[var(--border)] bg-white p-3 transition-colors">
      <div className="flex items-center justify-between gap-3">
        {/* Tabs (labels from JSON) */}
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

        {/* Right-side actions (labels from JSON) */}
        <div className="flex items-center gap-2">
          <Chip>{countLabel}</Chip>

          {/* Page chips: 1 2 + */}
          <div className="flex items-center gap-1">
            <button
              className={`h-7 w-7 rounded-md border text-[12px] ${pageIdx===0 ? "font-semibold border-[var(--border)]" : "text-[var(--muted)] border-[var(--border)]"}`}
              onClick={() => setPageIdx(0)}
              title="Tab 1"
            >1</button>
            <button
              className={`h-7 w-7 rounded-md border text-[12px] ${pageIdx===1 ? "font-semibold border-[var(--border)]" : "text-[var(--muted)] border-[var(--border)]"}`}
              onClick={() => setPageIdx(1)}
              title="Tab 2"
            >2</button>
            <button
              className="h-7 w-7 rounded-md border border-dashed text-[12px] text-[var(--muted)]"
              onClick={() => setPageIdx(1)}
              title="New Tab"
            >+</button>
          </div>

          {/* Ai Headings */}
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
            <Plus size={14} /> {ui?.actions?.generateArticle ?? "Generate article"}
          </button>
        </div>
      </div>

      {/* Outline */}
      {tab === "outline" && (
        <div className="mt-3 overflow-y-auto pr-1" style={{ maxHeight: maxListHeight }}>
          {loading ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              Loading outline…
            </div>
          ) : error ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {error}
            </div>
          ) : currentList.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {ui?.emptyStates?.outline ?? "No headings found for this domain."}
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
                    onPasteToEditor?.({ level: h.level, title: h.title }, "editor");
                  }}
                  onAddInstruction={() =>
                    onPasteToEditor?.({ level: "H3", title: `Add instruction for: ${h.title}` }, "editor")
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
          {loading ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              Loading competitors…
            </div>
          ) : error ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {error}
            </div>
          ) : competitors.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {ui?.emptyStates?.competitors ?? "No competitor data in JSON for this domain."}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Competitors" value={competitors.length} />
                <Stat
                  label="Avg. Authority"
                  value={
                    Math.round(
                      (competitors.reduce((s, c) => s + (Number(c.authority) || 0), 0) / competitors.length) || 0
                    )
                  }
                />
                <Stat
                  label="Avg. Est. Traffic (K)"
                  value={
                    Math.round(
                      (competitors.reduce((s, c) => s + (Number(c.estimatedTrafficK) || 0), 0) / competitors.length) || 0
                    )
                  }
                />
                <Stat
                  label="Avg. Common Keywords"
                  value={
                    Math.round(
                      (competitors.reduce((s, c) => s + (Number(c.commonKeywords) || 0), 0) / competitors.length) || 0
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
                        {(val || []).slice(0, 3).map((u, idx) => (
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
        <div className="mt-3 overflow-y-auto pr-1 space-y-4" style={{ maxHeight: maxListHeight }}>
          {loading ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              Loading heatmaps…
            </div>
          ) : error ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted)] text-[12px]">
              {error}
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
                        <span className={`px-2 py-0.5 rounded-md border ${v ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-gray-300 text-gray-600 bg-gray-50"}`}>
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
