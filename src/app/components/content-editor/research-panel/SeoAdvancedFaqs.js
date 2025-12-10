"use client";

import React, { useMemo, useState } from "react";
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

      {/* Hint bubble */}
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
   Small utilities
================================ */
function pickString(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function hostFromUrl(url) {
  try {
    if (!url) return "";
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProto).hostname || "";
  } catch {
    return "";
  }
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
  /** Unified SEO data from /api/seo */
  seoData,
  seoLoading,
  seoError,
}) {
  const [faqTab, setFaqTab] = useState("serp"); // serp | pa | quora | reddit
  const [kwFilter, setKwFilter] = useState("");

  const loading = !!seoLoading;
  const error = seoError || "";

  // Effective domain: prop wins, else infer from authority/serper
  const effectiveDomain = useMemo(() => {
    if (domain) return String(domain).toLowerCase();
    if (seoData?.authority?.domain) return String(seoData.authority.domain).toLowerCase();
    const firstOrganic = seoData?.serper?.organic?.[0]?.link;
    if (firstOrganic) return hostFromUrl(firstOrganic).toLowerCase();
    return "";
  }, [domain, seoData]);

  /* ===============================
     Build FAQ rows from seoData.serper
     =============================== */
  const { serpRows, paRows, quoraRows, redditRows } = useMemo(() => {
    const serper = seoData?.serper || {};
    const organic = Array.isArray(serper.organic) ? serper.organic : [];
    const peopleAlsoAsk = Array.isArray(serper.peopleAlsoAsk)
      ? serper.peopleAlsoAsk
      : Array.isArray(serper.relatedQuestions)
      ? serper.relatedQuestions
      : [];

    const serp = [];
    const paa = [];
    const quora = [];
    const reddit = [];

    // SERP rows from organic results
    for (const item of organic) {
      const url = item.link || item.url || "";
      const host = hostFromUrl(url);
      const lcHost = host.toLowerCase();
      const dMatch = effectiveDomain ? lcHost.includes(effectiveDomain) : true;
      const qMatch = queryFilter
        ? (host + " " + (item.title || "")).toLowerCase().includes(queryFilter.toLowerCase())
        : true;
      if (!dMatch || !qMatch) continue;

      const title = pickString(item.title, item.question, url);
      if (!title) continue;

      const fullText = item.snippet || item.description || "";

      serp.push({
        iconLabel: host || "G",
        title,
        source: host || "Google",
        fullText,
        link: url,
      });

      // Quora/Reddit from organic domains
      if (lcHost.includes("quora.com")) {
        quora.push({
          iconLabel: "Q",
          title,
          source: host || "Quora",
          link: url,
        });
      } else if (lcHost.includes("reddit.com")) {
        reddit.push({
          iconLabel: "R",
          title,
          source: host || "Reddit",
          link: url,
        });
      }
    }

    // People Also Ask rows
    for (const item of peopleAlsoAsk) {
      const q = pickString(item.question, item.title);
      if (!q) continue;
      paa.push({
        iconLabel: "G",
        title: `People also ask: ${q}`,
        source: "Google",
        fullText: item.snippet || item.answer || "",
        link: item.url || "",
      });
    }

    return { serpRows: serp, paRows: paa, quoraRows: quora, redditRows: reddit };
  }, [seoData, effectiveDomain, queryFilter]);

  const filtered = useMemo(() => {
    const rows =
      faqTab === "serp"
        ? serpRows
        : faqTab === "pa"
        ? paRows
        : faqTab === "quora"
        ? quoraRows
        : redditRows;

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
            {k === "serp"
              ? "SERP"
              : k === "pa"
              ? "People also ask"
              : k === "quora"
              ? "Quora"
              : "Reddit"}
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
          <EmptyState
            title="Couldn't load FAQs"
            subtitle={error}
            onRetry={() => {
              // let parent re-trigger /api/seo; local reload is a simple fallback
              location.reload();
            }}
          />
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
