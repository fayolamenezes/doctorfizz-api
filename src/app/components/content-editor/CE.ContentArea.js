"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Menu, SquareStack, ChevronsUp, ChevronsDown } from "lucide-react";
import CEToolbar from "./CE.Toolbar";
import CECanvas from "./CE.Canvas";
import CEResearchPanel from "./CE.ResearchPanel";

/** Escape for regex */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Build regex for multi-word phrase */
function buildPhraseRegex(phrase) {
  const tokens = String(phrase || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      if (t === "&" || t === "and" || t === "&amp;") return "(?:&|&amp;|and)";
      return esc(t);
    });
  if (!tokens.length) return null;
  const joiner = "[\\s\\-–—]+";
  const pat = `\\b${tokens.join(joiner)}\\b`;
  return new RegExp(pat, "gi");
}

/** Normalize HTML → plain text */
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

/** Safe HTML text */
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Keep this in sync with the toolbar's H1/H2/H3 auto sizing */
const HEADING_SIZES = {
  h1: 28,
  h2: 22,
  h3: 18,
};

/** Build a heading block from {level,title} or a plain string */
function toHeadingHtml(input) {
  // Allow plain string (fallback to H2 styling)
  if (typeof input === "string") {
    const s = HEADING_SIZES.h2;
    return `<h2><span style="font-size:${s}px;font-weight:700">${escapeHtml(
      input
    )}</span></h2>`;
  }

  const levelRaw = String(input?.level || "H2").toLowerCase();
  const level = /^(h1|h2|h3)$/.test(levelRaw) ? levelRaw : "h2";
  const s = HEADING_SIZES[level] ?? HEADING_SIZES.h2;
  const title = escapeHtml(input?.title || "");

  // Match toolbar behavior: heading block + inline font size + bold
  return `<${level}><span style="font-size:${s}px;font-weight:700">${title}</span></${level}>`;
}

export default function CEContentArea({
  title = "Untitled",
  activeTab,
  onTabChange,
  lastEdited = "1 day ago",
  query,
  onQueryChange,
  onStart,
  seoMode: seoModeProp,
  metrics: metricsProp,
  setMetrics,
  /** NOTE: may come from JSON initially */
  content,
  /** Optional: parent setter (we still keep our own local state to prevent snapbacks) */
  setContent,
  primaryKeyword,
  lsiKeywords,
  /**
   * Optional: pass the page object (from contenteditor.json) and explicit optPageId
   * to the Research panel. When provided, the Research panel will use these
   * values instead of inferring them from the editor content or query. This
   * prevents fallback to the first page in the optimize dataset.
   */
  page,
  optPageId,
  /** OPTIONAL: explicit docId from parent (e.g. slug/id) */
  docId: docIdProp,
}) {
  const editorRef = useRef(null);

  const Tab = ({ id, children }) => {
    const is = activeTab === id;
    return (
      <button
        onClick={() => onTabChange?.(id)}
        className={`h-[34px] px-3 text-[13px] border-b-2 -mb-px transition-colors ${
          is
            ? "border-black text-black font-medium"
            : "border-transparent text-gray-500 hover:text-black"
        }`}
      >
        {children}
      </button>
    );
  };

  // Compact version for mobile only (smaller font so it fits one line)
  const MobileTab = ({ id, children }) => {
    const is = activeTab === id;
    return (
      <button
        onClick={() => onTabChange?.(id)}
        className={`h-[28px] px-2 text-[11px] border-b-2 -mb-px transition-colors ${
          is
            ? "border-black text-black font-medium"
            : "border-transparent text-gray-500 hover:text-black"
        }`}
      >
        {children}
      </button>
    );
  };

  /** ---------------------------------------------
   *  DOC ID for per-page autosave / local state
   *  --------------------------------------------- */
  const docId = useMemo(() => {
    if (docIdProp) return String(docIdProp);
    if (optPageId) return String(optPageId);
    if (page?.id) return String(page.id);
    if (page?.slug) return String(page.slug).toLowerCase();
    return String(title || "untitled").toLowerCase();
  }, [docIdProp, optPageId, page, title]);

  /** ---------------------------------------------
   *  LOCAL CONTENT STATE (prevents JSON snapbacks)
   *  --------------------------------------------- */
  const [localContent, setLocalContent] = useState(() => content || "");
  const lastLocalEditAtRef = useRef(0);
  const LOCAL_GRACE_MS = 300; // small window where external prop won't clobber local typing

  // One-time initialize from prop on mount (in case it’s async-loaded)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      if (typeof content === "string" && content !== localContent) {
        setLocalContent(content);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the parent later changes `content` (e.g. load new doc),
  // adopt it unless we just typed locally.
  useEffect(() => {
    if (typeof content !== "string") return;
    const justEdited = Date.now() - lastLocalEditAtRef.current < LOCAL_GRACE_MS;
    if (!justEdited && content !== localContent) {
      setLocalContent(content);
    }
  }, [content, localContent]);

  // When the editor changes, update our local state + forward upstream
  const handleSetContent = useCallback(
    (html) => {
      if (html === localContent) return;
      lastLocalEditAtRef.current = Date.now();
      setLocalContent(html);
      setContent?.(html);
    },
    [localContent, setContent]
  );

  // ----- Keyword setup -----
  const PRIMARY_KEYWORD = useMemo(
    () => String(primaryKeyword || "content marketing").toLowerCase(),
    [primaryKeyword]
  );

  const LSI_KEYWORDS = useMemo(
    () =>
      (Array.isArray(lsiKeywords) && lsiKeywords.length
        ? lsiKeywords
        : ["strategy", "SEO", "engagement", "conversion", "brand", "optimization"]
      ).map((k) => String(k).toLowerCase()),
    [lsiKeywords]
  );

  // ----- Metrics state -----
  const [seoMode] = useState(seoModeProp ?? "advanced");
  const [metricsInternal, setMetricsInternal] = useState({
    plagiarism: 0,
    primaryKeyword: 0,
    wordCount: 0,
    wordTarget: metricsProp?.wordTarget ?? 1250,
    lsiKeywords: 0,
    statuses: {
      wordCount: { label: "—", color: "text-[var(--muted)]" },
      primaryKeyword: { label: "—", color: "text-[var(--muted)]" },
      lsiKeywords: { label: "—", color: "text-[var(--muted)]" },
    },
  });

  useEffect(() => {
    if (metricsProp?.wordTarget) {
      setMetricsInternal((m) => ({ ...m, wordTarget: metricsProp.wordTarget }));
    }
  }, [metricsProp?.wordTarget]);

  /** ========= Throttled emit to parent ========= */
  const metricsTimerRef = useRef(null);
  const emitMetricsThrottled = useCallback(
    (next) => {
      if (!setMetrics) return;
      clearTimeout(metricsTimerRef.current);
      metricsTimerRef.current = setTimeout(() => {
        setMetrics(next);
      }, 80);
    },
    [setMetrics]
  );

  useEffect(() => () => clearTimeout(metricsTimerRef.current), []);

  // ----- Recompute metrics (debounced) -----
  useEffect(() => {
    const html = localContent;
    if (html == null) return;

    const timer = setTimeout(() => {
      const plain = normalizePlain(html);

      if (!plain) {
        const emptyMetrics = {
          plagiarism: 0,
          primaryKeyword: 0,
          wordCount: 0,
          lsiKeywords: 0,
          wordTarget: metricsInternal.wordTarget,
        };
        setMetricsInternal((m) => ({
          ...m,
          ...emptyMetrics,
          statuses: {
            wordCount: { label: "Empty", color: "text-[var(--muted)]" },
            primaryKeyword: { label: "Needs Review", color: "text-red-600" },
            lsiKeywords: { label: "Needs Review", color: "text-red-600" },
          },
        }));
        emitMetricsThrottled(emptyMetrics);
        return;
      }

      const words = plain.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      // --- Keyword detection ---
      const pkRegex = buildPhraseRegex(PRIMARY_KEYWORD);
      const pkMatches = pkRegex ? (plain.match(pkRegex) || []).length : 0;
      const pkScore = Math.min(100, pkMatches * 25);

      // --- LSI coverage ---
      let lsiCovered = 0;
      for (const term of LSI_KEYWORDS) {
        const rx = buildPhraseRegex(term);
        if (rx && rx.test(plain)) lsiCovered += 1;
      }
      const lsiPct =
        LSI_KEYWORDS.length > 0
          ? Math.max(
              0,
              Math.min(100, Math.round((lsiCovered / LSI_KEYWORDS.length) * 100))
            )
          : 0;

      // --- Simple plagiarism heuristic ---
      const freq = Object.create(null);
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
      const repeats = Object.values(freq).filter((n) => n > 2).length;
      const unique = Object.keys(freq).length;
      const repRatio = repeats / Math.max(1, unique);
      const plagiarism = Math.max(0, Math.min(100, Math.round(repRatio * 100)));

      const status = (val) => {
        if (val >= 75) return { label: "Good", color: "text-green-600" };
        if (val >= 40) return { label: "Moderate", color: "text-yellow-600" };
        return { label: "Needs Review", color: "text-red-600" };
      };

      const next = {
        plagiarism,
        wordCount,
        primaryKeyword: pkScore,
        lsiKeywords: lsiPct,
        wordTarget: metricsInternal.wordTarget,
      };

      setMetricsInternal((m) => ({
        ...m,
        ...next,
        statuses: {
          wordCount:
            wordCount >= (m.wordTarget || 1200)
              ? { label: "Good", color: "text-green-600" }
              : wordCount >= Math.round((m.wordTarget || 1200) * 0.5)
              ? { label: "Moderate", color: "text-yellow-600" }
              : { label: "Needs Review", color: "text-red-600" },
          primaryKeyword: status(pkScore),
          lsiKeywords: status(lsiPct),
        },
      }));

      emitMetricsThrottled(next);
    }, 40);

    return () => clearTimeout(timer);
  }, [
    localContent,
    PRIMARY_KEYWORD,
    LSI_KEYWORDS,
    metricsInternal.wordTarget,
    emitMetricsThrottled,
  ]);

  const metrics = metricsProp ?? metricsInternal;
  const effectiveSeoMode = seoModeProp ?? seoMode;

  /** =========================
   * Paste-to-editor hook
   * ========================= */
  const handlePasteHeadingToEditor = useCallback(
    (heading, destination = "editor") => {
      if (destination !== "editor") return; // Tab2 is managed by the right panel itself

      // Support bulk arrays or single item
      const items = Array.isArray(heading) ? heading : [heading];

      const blocks = items.map((item) => toHeadingHtml(item)).join("");

      // Add a soft separator before appended content for readability
      const separator = localContent ? "<p><br/></p>" : "";

      const nextHtml = (localContent || "") + separator + blocks;
      handleSetContent(nextHtml);
    },
    [localContent, handleSetContent]
  );

  /** =========================
   * Mobile toolbar visibility
   * ========================= */
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [hasTypedSinceFocus, setHasTypedSinceFocus] = useState(false);
  const baselineViewportHeightRef = useRef(null);

  // Detect keyboard visibility using viewport height changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const KEYBOARD_THRESHOLD_PX = 150;

    const updateFromHeight = (currentHeight) => {
      if (!currentHeight) return;

      if (
        baselineViewportHeightRef.current == null ||
        currentHeight > baselineViewportHeightRef.current
      ) {
        // keep track of the largest height we've seen (no keyboard)
        baselineViewportHeightRef.current = currentHeight;
      }

      const baseline =
        baselineViewportHeightRef.current != null
          ? baselineViewportHeightRef.current
          : currentHeight;

      const keyboardIsOpen = baseline - currentHeight > KEYBOARD_THRESHOLD_PX;
      setKeyboardVisible(keyboardIsOpen);
    };

    const vv = window.visualViewport;
    if (vv) {
      updateFromHeight(vv.height);
      const onResize = () => updateFromHeight(vv.height);
      vv.addEventListener("resize", onResize);
      return () => vv.removeEventListener("resize", onResize);
    }

    // Fallback: use window.innerHeight
    updateFromHeight(window.innerHeight);
    const onResize = () => updateFromHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleTypingPulse = useCallback(() => {
    setHasTypedSinceFocus(true);
  }, []);

  const handleFocus = useCallback(() => {
    setHasTypedSinceFocus(false);
  }, []);

  const handleBlur = useCallback(() => {
    setHasTypedSinceFocus(false);
  }, []);

  const showMobileToolbar = keyboardVisible && hasTypedSinceFocus;

  /** =========================
   * Mobile metrics collapse toggle
   * ========================= */
  const [mobileMetricsCollapsed, setMobileMetricsCollapsed] = useState(false);

  const handleToggleMobileMetrics = useCallback(() => {
    setMobileMetricsCollapsed((prev) => {
      const next = !prev;

      if (typeof window !== "undefined") {
        const stripEl = document.getElementById("ce-metrics-mobile");
        const summaryEl = document.getElementById("ce-metrics-mobile-summary");

        if (stripEl) {
          if (next) stripEl.classList.add("hidden");
          else stripEl.classList.remove("hidden");
        }

        if (summaryEl) {
          if (next) summaryEl.classList.remove("hidden");
          else summaryEl.classList.add("hidden");
        }
      }

      return next;
    });
  }, []);

  return (
    <div
      className="
        grid grid-cols-1 lg:grid-cols-[2fr_1fr] items-stretch
        rounded-[18px] overflow-hidden border border-[var(--border)] bg-white
        transition-colors
      "
    >
      {/* LEFT AREA */}
      <div className="min-w-0 bg-white lg:border-r border-[var(--border)]">
        {/* Mobile tabs row (smaller, one-line, no 'Edited' text) */}
        <div className="flex lg:hidden items-center gap-1 px-2 pt-[3px] border-b border-[var(--border)]">
          <button
            onMouseDown={(e) => e.preventDefault()}
            className="h-7 w-7 grid place-items-center rounded hover:bg-gray-100 text-gray-700 transition-colors"
            title="Menu"
          >
            <Menu size={14} />
          </button>
          <MobileTab id="content">Content</MobileTab>
          <MobileTab id="summary">Article Summary</MobileTab>
          <MobileTab id="final">Final Content</MobileTab>
        </div>

        {/* Tabs + 'Edited' row (desktop only – unchanged) */}
        <div className="hidden lg:flex items-center justify-between px-2 pt-[3px]">
          <div className="flex items-center gap-1">
            <button
              onMouseDown={(e) => e.preventDefault()}
              className="h-7 w-7 grid place-items-center rounded hover:bg-gray-100 text-gray-700 transition-colors"
              title="Menu"
            >
              <Menu size={15} />
            </button>
            <Tab id="content">Content</Tab>
            <Tab id="summary">Article Summary</Tab>
            <Tab id="final">Final Content</Tab>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pr-2">
            <span>Edited {lastEdited}</span>
            <SquareStack size={13} className="opacity-70" />
          </div>
        </div>

        {/* Desktop formatting toolbar only (second row) */}
        <div className="hidden lg:block">
          <CEToolbar editorRef={editorRef} />
        </div>

        {/* Mobile/tablet only double-chevron icon (between tabs and content) */}
        <div className="flex lg:hidden items-center justify-start px-2 py-1 bg-white">
          <button
            type="button"
            onClick={handleToggleMobileMetrics}
            className="h-6 w-6 flex items-center justify-center text-gray-400"
            aria-label="Toggle metrics strip"
          >
            {mobileMetricsCollapsed ? (
              <ChevronsDown size={16} />
            ) : (
              <ChevronsUp size={16} />
            )}
          </button>
        </div>

        <div className="bg-white">
          <CECanvas
            ref={editorRef}
            docId={docId}
            title={title}
            content={localContent}
            setContent={handleSetContent}
            /* mobile typing signals */
            onTyping={handleTypingPulse}
            onFocusEditor={handleFocus}
            onBlurEditor={handleBlur}
          />
        </div>
      </div>

      {/* RIGHT PANEL — desktop only (mobile uses slide-over) */}
      <div className="hidden lg:block min-w-[320px] border-l border-[var(--border)] bg-white">
        <CEResearchPanel
          query={query}
          onQueryChange={onQueryChange}
          onStart={onStart}
          seoMode={effectiveSeoMode}
          metrics={metrics}
          editorContent={localContent}
          /* Allow panel to paste headings into canvas */
          onPasteToEditor={handlePasteHeadingToEditor}
          /* Pass through page + explicit optPageId so the Research panel
             can select the correct optimize-dataset page instead of
             guessing from editor HTML and falling back to the first page. */
          page={page}
          optPageId={optPageId}
        />
      </div>

      {/* MOBILE: docked, horizontally scrollable toolbar */}
      <div
        className={`
          lg:hidden fixed left-0 right-0 z-50
          ${
            showMobileToolbar
              ? "bottom-[env(safe-area-inset-bottom,0px)]"
              : "-bottom-24 pointer-events-none"
          }
          transition-all duration-200
        `}
      >
        <CEToolbar mode="mobile" editorRef={editorRef} />
        {/* spacer to ensure canvas content isn’t covered when toolbar is visible */}
        <div className={showMobileToolbar ? "h-14" : "h-0"} />
      </div>
    </div>
  );
}
