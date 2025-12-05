// components/content-editor/CE.ResearchPanel.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronRight, Search as SearchIcon, RefreshCw, Copy as CopyIcon } from "lucide-react";

/* ===============================
   Small Helpers
================================ */
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
        {/* Slightly smaller, thinner, lighter grey wireframe icon */}
        <CopyIcon
          size={size}
          strokeWidth={1.5}
          className="text-gray-500 hover:text-gray-600 transition-colors"
        />
      </button>

      {/* Hint bubble (unchanged) */}
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


function BrandDot({ label }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-white text-[10px] font-semibold text-[var(--text-primary)] transition-colors">
      {(label || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function EmptyState({ title = "No results", subtitle = "Try a different filter or tab.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="text-[12px] text-[var(--muted)]">{subtitle}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Reload
        </button>
      )}
    </div>
  );
}

/* ===============================
   Row (outer element is no longer <button>)
================================ */
function FAQRow({ iconLabel, title, source, onPaste, subtitle }) {
  // Activate with keyboard like a button
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // no default row action other than visual focus; add callback here if needed
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white transition-colors">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="group w-full px-3 py-2 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 rounded-xl"
      >
        <div className="flex min-w-0 items-center gap-3">
          <BrandDot label={iconLabel} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate transition-colors">
              {title}
            </div>
            <div className="text-[11px] text-[var(--muted)] transition-colors truncate">
              {subtitle || `Source: ${source}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <IconHintButton
            onClick={() => {
              onPaste?.(title);
            }}
          />
          <ChevronRight size={18} className="text-[var(--muted)]" />
        </div>
      </div>
    </div>
  );
}

/* ===============================
   Utilities to read JSON
================================ */
function normalizePages(json) {
  // Accept: top-level array OR { pages: [...] } OR single object
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.pages)) return json.pages;
  return [json];
}

function pickString(...vals) {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

/* ===============================
   Main Component
================================ */
export default function SeoAdvancedFaqs({
  onPasteToEditor,
  domain,
  queryFilter = "",
  /** Max height of the scrollable FAQ list area (any CSS length) */
  maxListHeight = "30rem",
}) {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [faqTab, setFaqTab] = useState("serp"); // serp | pa | quora | reddit
  const [kwFilter, setKwFilter] = useState("");

  // Load JSON once on mount
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/data/contenteditor.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!alive) return;
        setRaw(j);
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load contenteditor.json");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  // Build a unified view of FAQs from JSON
  const { serpRows, paRows, quoraRows, redditRows } = useMemo(() => {
    const pages = normalizePages(raw);

    // Optional filter to a specific domain/page
    const subset = pages.filter((p) => {
      const d = (p?.domain || p?.title || "").toLowerCase();
      const byDomain = domain ? d.includes(String(domain).toLowerCase()) : true;
      const byQuery = queryFilter ? d.includes(String(queryFilter).toLowerCase()) : true;
      return byDomain && byQuery;
    });

    const take = subset.length ? subset : pages;

    const serp = [];
    const paa = [];
    const quora = [];
    const reddit = [];

    for (const page of take) {
      const src = pickString(page?.domain, page?.title, "source");
      const faqs = page?.faqs || {};

      // SERP tab — expects array of { title, content }
      if (Array.isArray(faqs.serp)) {
        for (const item of faqs.serp) {
          const t = pickString(item?.title, item?.question);
          if (!t) continue;
          serp.push({
            iconLabel: src,
            title: t,
            source: src,
            fullText: item?.content || item?.answer || "",
          });
        }
      }
      // People Also Ask — array of { question, answer }
      if (Array.isArray(faqs.peopleAlsoAsk)) {
        for (const item of faqs.peopleAlsoAsk) {
          const t = pickString(item?.question, item?.title);
          if (!t) continue;
          paa.push({
            iconLabel: "G",
            title: `People also ask: ${t}`,
            source: src,
            fullText: item?.answer || "",
          });
        }
      }
      // Quora — array of { title, url }
      if (Array.isArray(faqs.quora)) {
        for (const item of faqs.quora) {
          const t = pickString(item?.title);
          if (!t) continue;
          quora.push({
            iconLabel: "Q",
            title: t,
            source: item?.url ? new URL(item.url).hostname : "Quora",
            link: item?.url || "",
          });
        }
      }
      // Reddit — array of { title, url }
      if (Array.isArray(faqs.reddit)) {
        for (const item of faqs.reddit) {
          const t = pickString(item?.title);
          if (!t) continue;
          let host = "Reddit";
          try {
            host = new URL(item?.url).hostname;
          } catch {}
          reddit.push({
            iconLabel: "R",
            title: t,
            source: host,
            link: item?.url || "",
          });
        }
      }
    }

    return { serpRows: serp, paRows: paa, quoraRows: quora, redditRows: reddit };
  }, [raw, domain, queryFilter]);

  const filtered = useMemo(() => {
    const rows =
      faqTab === "serp" ? serpRows :
      faqTab === "pa" ? paRows :
      faqTab === "quora" ? quoraRows :
      redditRows;

    if (!kwFilter) return rows;
    const q = kwFilter.toLowerCase();
    return rows.filter((r) => r.title.toLowerCase().includes(q));
  }, [faqTab, kwFilter, serpRows, paRows, quoraRows, redditRows]);

  function handlePaste(text, row) {
    const lines = [
      row?.title ? `Q: ${row.title}` : text,
      row?.fullText ? `A: ${row.fullText}` : undefined,
      row?.link ? `Source: ${row.link}` : undefined,
    ].filter(Boolean);
    onPasteToEditor?.(lines.join("\n"));
  }

  /* ===============================
     Render
  ================================= */
  return (
    <div className="mt-1 rounded-2xl border border-[var(--border)] bg-white p-3 transition-colors">
      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-1 transition-colors">
        {["serp", "pa", "quora", "reddit"].map((k) => (
          <button
            key={k}
            onClick={() => setFaqTab(k)}
            className={`px-2 pb-2 text-[12px] font-semibold transition-all ${
              faqTab === k
                ? "text-[var(--text-primary)] border-b-2 border-amber-400"
                : "text-[var(--muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {k === "serp" ? "SERP" : k === "pa" ? "People also ask" : k === "quora" ? "Quora" : "Reddit"}
          </button>
        ))}
      </div>

      {/* Search/filter */}
      <div className="relative mt-3">
        <input
          className="w-full h-8 rounded-lg border border-[var(--border)] bg-white px-8 text-[12px] text-[var(--text-primary)] placeholder-[var(--muted)] outline-none focus:border-amber-400 transition-colors"
          placeholder="Filter by keywords"
          value={kwFilter}
          onChange={(e) => setKwFilter(e.target.value)}
        />
        <SearchIcon size={13} className="absolute left-2.5 top-2 text-[var(--muted)]" />
      </div>

      {/* Body (scrollable FAQ list) */}
      <div className="mt-3 min-h-[120px]">
        {loading ? (
          <div className="py-6 text-center text-[12px] text-[var(--muted)]">Loading FAQs…</div>
        ) : error ? (
          <EmptyState title="Couldn't load JSON" subtitle={error} onRetry={() => location.reload()} />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="space-y-2 overflow-y-auto pr-1"
            style={{ maxHeight: maxListHeight }}
          >
            {filtered.map((r, idx) => (
              <FAQRow
                key={idx}
                iconLabel={r.iconLabel}
                title={r.title}
                source={r.source}
                subtitle={r.link ? r.link : undefined}
                onPaste={(text) => handlePaste(text, r)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
