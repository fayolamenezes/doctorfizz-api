// components/content-editor/research-panel/SeoAdvancedOptimize.js
"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  X,
  Search as SearchIcon,
} from "lucide-react";

/* ===========================
   Status logic + style maps
   =========================== */

function deriveStatus(used = 0, recommended = 0) {
  if (used === 0) return "Topic Gap"; // grey
  if (used > recommended) return "Overuse"; // red
  if (used === recommended) return "Completed"; // green
  return "In Progress"; // orange
}

const STATUS_STYLES = {
  Completed: {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-700/60",
    bar: "bg-emerald-500 dark:bg-emerald-400",
    dot: "bg-emerald-500",
  },
  "In Progress": {
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-700/60",
    bar: "bg-amber-500 dark:bg-amber-400",
    dot: "bg-amber-500",
  },
  Overuse: {
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-300 dark:border-rose-700/60",
    bar: "bg-rose-500 dark:bg-rose-400",
    dot: "bg-rose-500",
  },
  "Topic Gap": {
    badge:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700",
    bar: "bg-neutral-400 dark:bg-neutral-600",
    dot: "bg-neutral-400",
  },
  All: { dot: "bg-neutral-400" },
};

// ✅ highlight styles to mirror progress/badge colors in the Canvas
const HIGHLIGHT_CLASS_MAP = {
  Completed:
    "bg-emerald-200/60 text-emerald-900 ring-1 ring-emerald-400/40 rounded-[2px] px-0.5",
  "In Progress":
    "bg-amber-200/60 text-amber-900 ring-1 ring-amber-400/40 rounded-[2px] px-0.5",
  Overuse:
    "bg-rose-200/60 text-rose-900 ring-1 ring-rose-400/40 rounded-[2px] px-0.5",
  "Topic Gap":
    "bg-gray-200/60 text-gray-900 ring-1 ring-gray-400/40 rounded-[2px] px-0.5",
};

function progressPct(used, rec) {
  if (!rec) return 0;
  const pct = Math.round((Math.min(used, rec) / rec) * 100);
  return Math.max(0, Math.min(100, pct));
}

/* ===========================
   Small helpers
   =========================== */

function Dot({ className = "" }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-full ${className}`}
    />
  );
}

function highlightOnlyPhrase(text, phrase) {
  if (!phrase || !text) return text;
  try {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    return text.split(re).map((seg, i) =>
      re.test(seg) ? (
        <mark
          key={i}
          className="rounded px-0.5 bg-yellow-200/70 text-gray-900"
        >
          {seg}
        </mark>
      ) : (
        <span key={i}>{seg}</span>
      )
    );
  } catch {
    return text;
  }
}

/* ============
   Live count helpers (Canvas → Optimize)
   ============ */

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildPhraseRegex(phrase) {
  const tokens = String(phrase || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) =>
      t === "&" || t === "and" || t === "&amp;" ? "(?:&|&amp;|and)" : esc(t)
    );
  if (!tokens.length) return null;
  const joiner = "[\\s\\-–—]+"; // allow spaces/dashes between tokens
  return new RegExp(`\\b${tokens.join(joiner)}\\b`, "gi");
}

function normalizePlain(htmlLike) {
  return String(htmlLike || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ===========================
   Reusable bits
   =========================== */

function IconHintButton({
  onClick,
  label = "Paste to editor",
  size = 12,
  className = "",
}) {
  const id = useId();
  return (
    <div className={`relative group ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="grid place-items-center h-8 w-8 rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none
                   dark:border-[var(--border)] dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)] dark:hover:bg-[var(--bg-hover)]"
      >
        <Image
          src="/assets/copy.svg"
          width={size}
          height={size}
          alt="Paste"
          className="opacity-80"
        />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute -top-7 right-0 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm opacity-0 transition-opacity duration-100 whitespace-nowrap
                   group-hover:opacity-100 group-focus-within:opacity-100
                   dark:border-[var(--border)] dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)]"
      >
        {label}
      </span>
    </div>
  );
}

function KPI({ label, value, delta, up }) {
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = up
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
  return (
    <div className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[var(--border)] dark:bg-[var(--bg-panel)]">
      <div className="text-[10px] text-gray-500 dark:text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-[16px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
          {value}
        </div>
        <span className={`inline-flex items-center gap-0.5 text-[10px] ${tone}`}>
          <Icon size={13} />
          {delta}
        </span>
      </div>
    </div>
  );
}

function PopoverSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onAway = (e) =>
      ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onAway);
    return () => document.removeEventListener("mousedown", onAway);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div className="text-[11px] text-gray-500 dark:text-[var(--muted)] mb-1">
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-[12px] text-gray-800 inline-flex items-center gap-1 shadow-sm hover:bg-gray-50
                   dark:border-[var(--border)] dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value}
        <ChevronDown size={14} className="text-gray-500" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-[180px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg
                     dark:border-[var(--border)] dark:bg-[var(--bg-panel)]"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-gray-50 dark:hover:bg-[var(--bg-hover)] ${
                value === opt.value ? "font-medium" : ""
              }`}
            >
              {"dot" in opt ? <Dot className={opt.dot} /> : null}
              <span className="truncate">{opt.label}</span>
              {value === opt.value ? (
                <span className="ml-auto text-xs">✓</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===========================
   Row + Drawer
   =========================== */

function KeywordRow({ item, onOpen, onPaste }) {
  const status = deriveStatus(item.used, item.recommended);
  const s = STATUS_STYLES[status];
  const pct = progressPct(item.used, item.recommended);

  // Keyboard support for the row (Enter/Space to open)
  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen?.();
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 dark:border-[var(--border)] dark:bg-[var(--bg-panel)]">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleKeyDown}
        className="group w-full flex items-start gap-3 text-left outline-none"
        aria-label={`Open keyword ${item.title}`}
      >
        <span
          className={`shrink-0 text-[11px] px-2 py-1 border rounded-lg font-semibold ${s.badge}`}
        >
          {item.used} / {item.recommended}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[13px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
              {item.title}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 dark:text-[var(--muted)]">
                Source : {item.sources}
              </span>
              <IconHintButton onClick={() => onPaste?.(item.title)} />
              <ChevronRight
                className="text-gray-400 group-hover:text-gray-500"
                size={18}
                aria-hidden
              />
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-neutral-800">
            <div
              className={`h-1.5 rounded-full ${s.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerHeader({ title, countText, onClose }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[13px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
          {title}
        </div>
        {countText ? (
          <div className="text-[11px] text-gray-500 dark:text-[var(--muted)] mt-0.5">
            {countText}
          </div>
        ) : null}
      </div>
      <button
        aria-label="Close"
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 dark:text-[var(--muted)] dark:hover:text-[var(--text-primary)]"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function StatTriplet({ mine, avg, results }) {
  const items = [
    ["MY MENTION", mine],
    ["AVG. MENTIONS", avg],
    ["SEARCH RESULTS", results],
  ];
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[var(--border)] dark:bg-[var(--bg-panel)]"
        >
          <div className="text-[10px] text-gray-500 dark:text-[var(--muted)]">
            {label}
          </div>
          <div className="text-[16px] font-semibold text-gray-900 dark:text-[var(--text-primary)] mt-0.5">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceResult({ url, title, snippet, phrase }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-xl border shadow-sm transition-colors ${
        open
          ? "border-amber-200 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20"
          : "border-gray-200 bg-white dark:border-[var(--border)] dark:bg-[var(--bg-panel)]"
      }`}
    >
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full px-3.5 py-3 text-left rounded-xl hover:bg-gray-50 dark:hover:bg-[var(--bg-hover)]"
      >
        <div className="text-[11px] text-gray-500 dark:text-[var(--muted)] truncate">
          {url}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-gray-900 dark:text-[var(--text-primary)] truncate">
            {title}
          </div>
          <ChevronRight
            size={16}
            className={`text-gray-400 dark:text-[var(--muted)] transition-transform ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          />
        </div>
      </button>
      {open && (
        <div className="px-3.5 pb-3 -mt-1 text-[12px] text-gray-700 dark:text-[var(--text)] leading-6">
          <p>{highlightOnlyPhrase(snippet, phrase)}</p>
        </div>
      )}
    </div>
  );
}

/* ===========================
   Main component
   =========================== */

export default function SeoAdvancedOptimize({
  onPasteToEditor,
  optimizeData, // from contenteditor.json OR optimize-dataset.json (via Research Panel)
  currentPage, // optional
  basicsData, // optional
  editorContent = "", // <-- live HTML from Canvas passed via Research Panel
}) {
  // KPI strip (static demo; you can make this live later)
  const KPIS = [
    { label: "HEADINGS", value: 2, delta: 29, up: false },
    { label: "LINKS", value: 5, delta: 29, up: false },
    { label: "IMAGES", value: 3, delta: 1, up: true },
  ];

  /* ===========================
     Base dataset (from props)
     =========================== */
  const keywords = useMemo(() => {
    // Expect optimizeData?.keywords:
    // [{ id, title, used, recommended, sources, type, mine, avg, results, links:[{url, title, snippet}] }]
    if (Array.isArray(optimizeData?.keywords) && optimizeData.keywords.length) {
      return optimizeData.keywords.slice(0, 999);
    }
    // Fallback demo rows
    return [
      {
        id: "k1",
        title: "Content Marketing",
        used: 4,
        recommended: 3,
        sources: 15,
        type: "Long Tail",
        mine: 2,
        avg: 5,
        results: 3,
        links: [
          {
            url: "https://www.greenleafinsights.com",
            title: "How to start a blog in 10 steps: a beginner’s guide",
            snippet:
              "How to start a blog in 10 steps. This content marketing checklist covers planning, writing, and promotion for beginners.",
          },
          {
            url: "https://www.greenleafinsights.com",
            title: "How to Launch a Blog in 10 Easy Steps",
            snippet:
              "A practical guide to launch with content marketing tactics and early distribution.",
          },
          {
            url: "https://www.greenleafinsights.com",
            title: "Blogging Made Simple",
            snippet:
              "Blogging made simple with content marketing frameworks that scale.",
          },
          {
            url: "https://www.greenleafinsights.com",
            title: "10 Steps to Starting a Blog",
            snippet:
              "From niche selection to content marketing and analytics, this guide covers it all.",
          },
        ],
      },
      {
        id: "k2",
        title: "Strategies",
        used: 2,
        recommended: 4,
        sources: 5,
        type: "Long Tail",
        mine: 2,
        avg: 5,
        results: 3,
        links: [
          {
            url: "https://example.com",
            title: "Marketing strategies that work",
            snippet:
              "Test different strategies and measure outcomes to find the best fit for your audience.",
          },
          {
            url: "https://example.com",
            title: "Strategy playbook",
            snippet:
              "This playbook lists winning strategies across paid, owned, and earned channels.",
          },
        ],
      },
      {
        id: "k3",
        title: "Link Readability",
        used: 1,
        recommended: 3,
        sources: 15,
        type: "All Topics",
        mine: 2,
        avg: 5,
        results: 3,
        links: [
          {
            url: "https://example.com",
            title: "Readable links matter",
            snippet:
              "Improve link readability with concise anchor text and consistent patterns.",
          },
        ],
      },
      {
        id: "k4",
        title: "Title Readability",
        used: 3,
        recommended: 3,
        sources: 15,
        type: "Clusters",
        mine: 2,
        avg: 5,
        results: 3,
        links: [
          {
            url: "https://example.com",
            title: "Crafting readable titles",
            snippet:
              "Boost CTR with title readability improvements and content structure.",
          },
        ],
      },
    ];
  }, [optimizeData]);

  /* ===========================
     LIVE counts from Canvas
     =========================== */

  // Normalize the editor HTML to plain text (lowercased)
  const plain = useMemo(() => normalizePlain(editorContent), [editorContent]);

  // Count occurrences of each keyword title inside the plain text
  const liveCounts = useMemo(() => {
    if (!plain || !Array.isArray(keywords)) return {};
    const out = {};
    for (const k of keywords) {
      const rx = buildPhraseRegex(k.title);
      out[k.id] = rx ? (plain.match(rx) || []).length : 0;
    }
    return out;
  }, [plain, keywords]);

  // Build the live keyword objects (override static "used" & update "mine")
  const liveKeywords = useMemo(() => {
    if (!Array.isArray(keywords)) return [];
    return keywords.map((k) => {
      const used = liveCounts[k.id] ?? 0;
      return {
        ...k,
        used,
        mine: used,
      };
    });
  }, [keywords, liveCounts]);

  // ✅ Broadcast highlight rules to Canvas whenever live counts change
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Array.isArray(liveKeywords)) return;

    const rules = liveKeywords
      .filter((k) => (k.used ?? 0) > 0) // only highlight phrases that exist in canvas
      .map((k) => {
        const status = deriveStatus(k.used, k.recommended);
        return {
          phrase: String(k.title || ""),
          status,
          className:
            HIGHLIGHT_CLASS_MAP[status] || HIGHLIGHT_CLASS_MAP["Topic Gap"],
        };
      });

    window.dispatchEvent(new CustomEvent("ce:highlightRules", { detail: rules }));
  }, [liveKeywords]);

  // Keep drawer "selected" row in sync when counts change
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!drawerOpen || !selected) return;
    const fresher = liveKeywords.find((it) => it.id === selected.id);
    if (fresher && (fresher.used !== selected.used || fresher.mine !== selected.mine)) {
      setSelected(fresher);
    }
  }, [drawerOpen, selected, liveKeywords]);

  /* ===========================
     Filters
     =========================== */

  const [kwFilter, setKwFilter] = useState("");
  // Default to All Topics and make it behave as "show everything"
  const [typeFilter, setTypeFilter] = useState("All Topics"); // Long Tail | All Topics | Clusters
  const [statusFilter, setStatusFilter] = useState("All"); // All | Completed | In Progress | Overuse | Topic Gap

  const TYPE_OPTIONS = [
    { value: "Long Tail", label: "Long Tail" },
    { value: "All Topics", label: "All Topics" },
    { value: "Clusters", label: "Clusters" },
  ];
  const STATUS_OPTIONS = [
    { value: "All", label: "All", dot: STATUS_STYLES.All.dot },
    { value: "Completed", label: "Completed", dot: STATUS_STYLES.Completed.dot },
    { value: "In Progress", label: "In Progress", dot: STATUS_STYLES["In Progress"].dot },
    { value: "Overuse", label: "Overuse", dot: STATUS_STYLES.Overuse.dot },
    { value: "Topic Gap", label: "Topic Gap", dot: STATUS_STYLES["Topic Gap"].dot },
  ];

  const visible = useMemo(() => {
    const q = kwFilter.trim().toLowerCase();
    return liveKeywords.filter((k) => {
      const okText = !q || k.title.toLowerCase().includes(q);
      // "All Topics" shows ALL rows; otherwise exact match
      const okType =
        typeFilter === "All Topics" || !typeFilter || k.type === typeFilter;
      const status = deriveStatus(k.used, k.recommended);
      const okStatus = statusFilter === "All" || status === statusFilter;
      return okText && okType && okStatus;
    });
  }, [liveKeywords, kwFilter, typeFilter, statusFilter]);

  /* ===========================
     Render
     =========================== */

  return (
    <>
      {/* KPI strip */}
      {!drawerOpen && (
        <div className="mt-1 grid grid-cols-3 gap-2">
          {KPIS.map((k) => (
            <KPI key={k.label} {...k} />
          ))}
        </div>
      )}

      {/* Filter row */}
      {!drawerOpen && (
        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          <div className="relative">
            <input
              value={kwFilter}
              onChange={(e) => setKwFilter(e.target.value)}
              placeholder="Filter by keywords"
              className="w-full h-9 rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-[12px] text-gray-800 outline-none focus:border-amber-400 placeholder-gray-400
                         dark:border-[var(--border)] dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)] dark:placeholder-[var(--muted)]"
            />
            <SearchIcon
              size={13}
              className="absolute left-2.5 top-2.5 text-gray-400 dark:text-[var(--muted)]"
            />
          </div>

          <PopoverSelect
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={TYPE_OPTIONS}
          />
          <PopoverSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />

          <div className="flex items-end gap-2">
            <button
              type="button"
              className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium shadow-sm hover:bg-gray-50
                         dark:border-[var(--border)] dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)]"
            >
              Explore Topics
            </button>
            <button
              type="button"
              className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 bg-white text-[12px] font-medium shadow-sm hover:bg-gray-50
                         dark:border-[var(--border)] dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)]"
              aria-label="More"
            >
              ···
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {!drawerOpen && (
        <div className="mt-3 space-y-2">
          {visible.map((item) => (
            <KeywordRow
              key={item.id}
              item={item}
              onOpen={() => {
                setSelected(item);
                setDrawerOpen(true);
              }}
              onPaste={onPasteToEditor}
            />
          ))}
          {visible.length === 0 && (
            <div className="text-[12px] text-gray-500 dark:text-[var(--muted)] px-1 py-2">
              No items match the current filters.
            </div>
          )}
        </div>
      )}

      {/* Drawer (row details) */}
      {drawerOpen && selected && (
        <div className="mt-1 rounded-2xl border border-gray-200 bg-white p-3 dark:border-[var(--border)] dark:bg-[var(--bg-panel)]">
          <DrawerHeader
            title={selected.title}
            countText={`${selected.sources} Search result${
              selected.sources === 1 ? "" : "s"
            } mention this topic`}
            onClose={() => {
              setDrawerOpen(false);
              setSelected(null);
            }}
          />
          <StatTriplet
            mine={selected.mine}
            avg={selected.avg}
            results={selected.results}
          />
          <div className="mt-3 space-y-2">
            {selected.links.map((l, i) => (
              <SourceResult
                key={`${l.url}-${i}`}
                url={l.url}
                title={l.title}
                snippet={l.snippet}
                phrase={selected.title}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
