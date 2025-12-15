// components/ContentEditor.js
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import CENavbar from "./content-editor/CE.Navbar";
import CEMetricsStrip from "./content-editor/CE.MetricsStrip";
import CEContentArea from "./content-editor/CE.ContentArea";
import { AlertTriangle, X } from "lucide-react";

/* utils */
function isBlankHtml(html) {
  if (!html) return true;
  return (
    String(html).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === ""
  );
}
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Tell Research panel to reset and clear any persisted UI state it may use. */
function broadcastResearchReset(nextQuery = "") {
  try {
    localStorage.removeItem("research-panel-state");
    localStorage.removeItem("research:lastHost");
    localStorage.removeItem("research:lastKeyword");
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("research:reset"));
    window.dispatchEvent(
      new CustomEvent("content-editor:query-changed", {
        detail: { query: nextQuery },
      })
    );
  } catch {}
}

/** Lazy-load the Research panel so it only runs when opened (mobile). */
const CEResearchPanel = dynamic(
  () => import("./content-editor/CE.ResearchPanel"),
  { ssr: false }
);

export default function ContentEditor({ data, onBackToDashboard }) {
  /* load contenteditor.json (optional for downstream comps) */
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/data/contenteditor.json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (mounted) setConfig(json);
      } catch (e) {
        if (mounted) setConfigError(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* page config lookup key(s) */
  const rawPageKey = data?.slug || data?.page || data?.id || data?.title || "";
  const pageKey = norm(rawPageKey);
  // slugified version of title: "SEO Research Services Overview" -> "seo-research-services-overview"
  const titleSlugKey = data?.title ? norm(data.title).replace(/\s+/g, "-") : "";

  const pageConfig = useMemo(() => {
    if (!config?.length && !config?.pages?.length) return null;

    // Support both `[ ... ]` and `{ pages: [...] }` shapes
    const pages = Array.isArray(config?.pages) ? config.pages : config;

    if (!Array.isArray(pages) || !pages.length) return null;

    let hit = null;

    // 1) Direct match via slug/id against pageKey (slug/id/title/id-from-data)
    if (pageKey) {
      hit =
        pages.find((p) => norm(p.slug) === pageKey) ||
        pages.find((p) => norm(p.id) === pageKey);
    }

    // 2) Try slug-from-title : "seo research services overview" -> "seo-research-services-overview"
    if (!hit && titleSlugKey) {
      hit =
        pages.find((p) => norm(p.slug) === titleSlugKey) ||
        pages.find((p) => norm(p.id) === titleSlugKey);
    }

    // 3) Exact title match
    if (!hit && data?.title) {
      hit = pages.find((p) => norm(p.title) === norm(data.title));
    }

    // 4) Final safety net – now NO default pages[0] fallback
    return hit || null;
  }, [config, pageKey, titleSlugKey, data?.title]);

  // Stable doc identity for per-document persistence
  const docId = useMemo(() => {
    const idCandidate =
      data?.slug ||
      data?.id ||
      pageConfig?.slug ||
      pageConfig?.id ||
      pageConfig?.optPageId ||
      pageKey ||
      null;
    return idCandidate || null;
  }, [
    data?.slug,
    data?.id,
    pageConfig?.slug,
    pageConfig?.id,
    pageConfig?.optPageId,
    pageKey,
  ]);

  const STORAGE_KEY = docId
    ? `content-editor-state:${docId}`
    : "content-editor-state:global";

  const hasIncomingData = !!(data && (data.title || data.content));

  /* editor state */
  const [title, setTitle] = useState(data?.title || "Untitled");
  const [content, setContent] = useState(
    typeof data?.content === "string" ? data.content : ""
  );
  const [activeTab, setActiveTab] = useState("content");
  const [seoMode, setSeoMode] = useState("basic");
  const [lastEdited, setLastEdited] = useState(
    data?.ui?.lastEdited || "1 day ago"
  );
  const [query, setQuery] = useState(
    data?.ui?.query || data?.primaryKeyword || ""
  );
  const [basicsUnlocked, setBasicsUnlocked] = useState(false);

  /* session id to force-remount CEContentArea (and its children like Research) */
  const [editorSessionId, setEditorSessionId] = useState(0);

  // 🔑 Primary keyword source: always use canonical PK from data/pageConfig, not the live query
  const PRIMARY_KEYWORD = useMemo(
    () =>
      norm(
        data?.primaryKeyword ||
          pageConfig?.primaryKeyword ||
          "content marketing"
      ),
    [data?.primaryKeyword, pageConfig?.primaryKeyword]
  );

  const LSI = useMemo(
    () =>
      (Array.isArray(data?.lsiKeywords) && data.lsiKeywords.length
        ? data.lsiKeywords
        : Array.isArray(pageConfig?.lsiKeywords)
        ? pageConfig.lsiKeywords
        : [
            "strategy",
            "engagement",
            "brand",
            "seo",
            "audience",
            "education",
            "trust",
            "subscription",
            "saas",
            "decision-making",
          ]
      ).map((k) => norm(k)),
    [data?.lsiKeywords, pageConfig?.lsiKeywords]
  );

  const WORD_TARGET_FROM_DATA =
    data?.metrics?.wordTarget ??
    data?.wordTarget ??
    pageConfig?.wordTarget ??
    1480;

  // Initial plagiarism pulled from data (multi-content) when available
  const [metrics, setMetrics] = useState(() => ({
    plagiarism:
      typeof data?.plagiarism === "number"
        ? data.plagiarism
        : typeof data?.metrics?.plagiarism === "number"
        ? data.metrics.plagiarism
        : 0,
    primaryKeyword: 0,
    wordCount: 0,
    wordTarget: WORD_TARGET_FROM_DATA,
    lsiKeywords: 0,
  }));

  // Unified SEO data from /api/seo for this document
  const [seo, setSeo] = useState(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoError, setSeoError] = useState("");

  /* persistence + fresh-new guard */
  const restoredRef = useRef(false);
  const newDocRef = useRef(false);

  // ✅ NEW: a stateful "restored" flag so SEO hydration doesn't miss the moment
  const [restored, setRestored] = useState(false);

  // ✅ ensure we hydrate from SEO content only once per opened doc
  const hydratedFromSeoRef = useRef(false);
  useEffect(() => {
    hydratedFromSeoRef.current = false;
  }, [docId, editorSessionId]);

  // ------------------------------------------------------------------
  // Persist the current domain to localStorage for the Research panel.
  const pageDomain = data?.domain || pageConfig?.domain || "";
  useEffect(() => {
    if (!pageDomain) return;
    try {
      localStorage.setItem("websiteData", JSON.stringify({ site: pageDomain }));
    } catch {}
  }, [pageDomain]);

  // ------------------------------------------------------------------
  // Resolve the canonical URL for this page and fetch unified SEO data
  const seoUrl = useMemo(() => {
    if (!pageDomain) return null;

    // Prefer explicit URL from data if provided
    if (data?.url && typeof data.url === "string") {
      return data.url;
    }

    // If a slug is available, build a page-level URL
    if (data?.slug && typeof data.slug === "string") {
      const cleanedSlug = data.slug.replace(/^\/+/, "");
      return `https://${pageDomain}/${cleanedSlug}`;
    }

    // Fallback: just the domain root
    return `https://${pageDomain}`;
  }, [pageDomain, data?.url, data?.slug]);

  useEffect(() => {
    if (!seoUrl) return;

    let alive = true;

    (async () => {
      try {
        setSeoLoading(true);
        setSeoError("");

        const payload = {
          url: seoUrl,
          keyword: PRIMARY_KEYWORD || seoUrl,
          countryCode: "in",
          languageCode: "en",
          depth: 10,
          providers: ["psi", "authority", "dataforseo", "content", "serper"],
        };

        console.log("[ContentEditor] Calling /api/seo with payload:", payload);

        const res = await fetch("/api/seo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Failed to load /api/seo: ${res.status}`);
        }

        const json = await res.json();
        console.log("[ContentEditor] /api/seo response:", json);

        if (alive) setSeo(json);
      } catch (e) {
        console.error("[ContentEditor] Error while fetching /api/seo:", e);
        if (alive) setSeoError(e.message || "Failed to load SEO data");
      } finally {
        if (alive) setSeoLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [seoUrl, PRIMARY_KEYWORD]);

  useEffect(() => {
    console.log("[ContentEditor] seo", { seo, seoLoading, seoError });
  }, [seo, seoLoading, seoError]);

  // ✅ Hydrate editor content (and optionally title) from SEO extraction
  // Fixes: "Empty page" starter still showing (hydration was getting skipped if seo arrived early)
  useEffect(() => {
    if (!restored) return; // IMPORTANT: stateful, not ref-only
    if (newDocRef.current) return;
    if (hydratedFromSeoRef.current) return;

    // Only hydrate if incoming payload did NOT already bring content
    const hasPayloadContent =
      typeof data?.content === "string" && data.content.trim();
    if (hasPayloadContent) return;

    // Only hydrate if current content is blank-ish
    if (!isBlankHtml(content)) return;

    const extractedHtml =
      typeof seo?.content?.html === "string" ? seo.content.html.trim() : "";
    const extractedText =
      typeof seo?.content?.rawText === "string" ? seo.content.rawText.trim() : "";

    // Prefer HTML (from API), fallback to raw text (Canvas will still handle it)
    const nextContent = extractedHtml || extractedText;

    if (nextContent) {
      // 1) Update editor state (this will make CE.Canvas hide the starter)
      setContent(nextContent);
      setLastEdited("just now");
      hydratedFromSeoRef.current = true;

      // 2) Persist immediately so CE.Canvas autosave seeding can't "win" with empty content
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            title,
            content: nextContent,
            query,
          })
        );
      } catch {}

      // 3) Also write into CE.Canvas autosave scope (it uses this exact key)
      try {
        const AUTOSAVE_KEY = `ce:autosave:${docId || title || "untitled"}`;
        localStorage.setItem(AUTOSAVE_KEY, String(nextContent));
      } catch {}
    }

    // Optional: hydrate title only if current title is a placeholder AND we got an extracted title
    const extractedTitle =
      typeof seo?.content?.title === "string" ? seo.content.title.trim() : "";
    const titleIsPlaceholder = !title || title === "Untitled";
    const noIncomingTitle = !data?.title;

    if (extractedTitle && (titleIsPlaceholder || noIncomingTitle)) {
      setTitle(extractedTitle);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            title: extractedTitle,
            content: nextContent || content,
            query,
          })
        );
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, seo, data?.content, data?.title, docId]);

  // Track previous incoming data.title to avoid clobbering user edits
  const prevDataTitleRef = useRef(data?.title);

  // ✅ Track previous incoming query source so typing doesn't get overwritten
  const prevDataQueryRef = useRef(data?.ui?.query || data?.primaryKeyword || "");

  // Mount: handle ?new/#new once, restore saved state (no more hash forcing)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const hadNewParam = url.searchParams.get("new") === "1";
      const hadNewHash = (url.hash || "").includes("#new");
      const hasNewFlag = hadNewParam || hadNewHash;

      if (hasNewFlag) {
        // NEW document boot (handle once)
        try {
          localStorage.removeItem(STORAGE_KEY);
          // legacy key cleanup
          localStorage.removeItem("content-editor-state");
        } catch {}

        setTitle("Untitled");
        setContent("");
        setQuery("");
        prevDataQueryRef.current = ""; // ✅ keep in sync
        setActiveTab("content");
        setSeoMode("basic");
        setLastEdited("just now");
        setBasicsUnlocked(false);
        setMetrics((m) => ({
          ...m,
          plagiarism: 0,
          primaryKeyword: 0,
          wordCount: 0,
          lsiKeywords: 0,
          wordTarget: WORD_TARGET_FROM_DATA,
        }));
        newDocRef.current = true;

        // Force remount & tell research to reset
        setEditorSessionId((n) => n + 1);
        broadcastResearchReset("");

        // Clean URL so refresh doesn’t repeat NEW (no hash change)
        url.searchParams.delete("new");
        window.history.replaceState(null, "", url.toString());
      } else if (!hasIncomingData) {
        // Only restore from localStorage when there is NO incoming data
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (typeof saved.title === "string") setTitle(saved.title);
            if (typeof saved.content === "string") setContent(saved.content);
            if (typeof saved.query === "string") setQuery(saved.query);
          } catch {}
        }

        // Just clean ?new if present; do not force any hash
        try {
          url.searchParams.delete("new");
          window.history.replaceState(null, "", url.toString());
        } catch {}
      } else {
        // Incoming data present: skip restore, just clean ?new if there
        try {
          url.searchParams.delete("new");
          window.history.replaceState(null, "", url.toString());
        } catch {}
      }
    } catch {}

    restoredRef.current = true;
    setRestored(true); // ✅ this triggers SEO hydration reliably
  }, [WORD_TARGET_FROM_DATA, STORAGE_KEY, hasIncomingData]);

  // Persist minimal state on edits (does NOT include activeTab/seoMode to keep scope small)
  useEffect(() => {
    try {
      const payload = { title, content, query };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      // keep Research in sync if user changes/clears keyword
      window.dispatchEvent(
        new CustomEvent("content-editor:query-changed", { detail: { query } })
      );
    } catch {}
  }, [title, content, query, STORAGE_KEY]);

  /* central reset helper (memoized to satisfy exhaustive-deps) */
  const resetToNewDocument = useCallback(
    (payload = {}) => {
      const nextTitle = payload.title || "Untitled";
      const nextContent =
        typeof payload.content === "string" ? payload.content : "";
      setTitle(nextTitle);
      setContent(nextContent);
      setQuery("");
      prevDataQueryRef.current = ""; // ✅ keep in sync
      setActiveTab("content");
      setSeoMode("basic");
      setLastEdited("just now");
      setBasicsUnlocked(false);
      setMetrics((m) => ({
        ...m,
        plagiarism: 0,
        primaryKeyword: 0,
        wordCount: 0,
        lsiKeywords: 0,
        wordTarget:
          data?.metrics?.wordTarget ??
          data?.wordTarget ??
          pageConfig?.wordTarget ??
          1480,
      }));
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            title: nextTitle,
            content: nextContent,
            query: "",
          })
        );
      } catch {}
      newDocRef.current = true;

      // Force remount & tell research to reset
      setEditorSessionId((n) => n + 1);
      broadcastResearchReset("");

      // Clean URL after programmatic new (no hash)
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("new");
        window.history.replaceState(null, "", url.toString());
      } catch {}
    },
    [
      data?.metrics?.wordTarget,
      data?.wordTarget,
      pageConfig?.wordTarget,
      STORAGE_KEY,
    ]
  );

  /* listen for multiple "new doc" event names */
  useEffect(() => {
    const handler = (e) => resetToNewDocument(e?.detail || {});
    const names = ["content-editor:new", "new-document"];
    names.forEach((n) => window.addEventListener(n, handler));
    return () => names.forEach((n) => window.removeEventListener(n, handler));
  }, [resetToNewDocument]);

  /*
   * Whenever the parent data/page key changes, (i.e. a different page is opened),
   * force a remount of the Content Area (and thus the Research panel) and
   * broadcast a reset to clear any persisted research state.
   */
  useEffect(() => {
    // skip on initial mount or new document boot
    if (!restoredRef.current || newDocRef.current) return;
    // force remount by bumping editorSessionId
    setEditorSessionId((n) => n + 1);
    // reset research state with the next query from this page
    const nextQuery = data?.ui?.query || data?.primaryKeyword || "";
    broadcastResearchReset(nextQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  /* sync when parent `data` changes, but don't clobber a fresh new doc or user edits */
  useEffect(() => {
    if (!restoredRef.current || newDocRef.current) {
      // Still keep the refs in sync even if we early-return
      prevDataTitleRef.current = data?.title;
      prevDataQueryRef.current = data?.ui?.query || data?.primaryKeyword || "";
      return;
    }

    // Title: only update when the incoming source value actually changes
    if (
      typeof data?.title === "string" &&
      data.title !== prevDataTitleRef.current
    ) {
      setTitle(data.title);
    }
    // keep ref up to date
    prevDataTitleRef.current = data?.title;

    // Content
    if (typeof data?.content === "string") {
      if (data.content !== content) setContent(data.content);
    } else if (!data?.content && isBlankHtml(content)) {
      if (content !== "") setContent("");
    }

    // ✅ Query: only update when the INCOMING query source changed (prevents wiping while typing)
    const incomingQuery = data?.ui?.query || data?.primaryKeyword || "";
    if (incomingQuery !== prevDataQueryRef.current) {
      setQuery(incomingQuery);
      prevDataQueryRef.current = incomingQuery;
    }

    // Metrics.wordTarget (avoid re-setting same value)
    const nextWordTarget =
      data?.metrics?.wordTarget ??
      data?.wordTarget ??
      pageConfig?.wordTarget ??
      metrics.wordTarget ??
      1480;

    if (nextWordTarget !== metrics.wordTarget) {
      setMetrics((m) => ({ ...m, wordTarget: nextWordTarget }));
    }

    // Metrics.plagiarism – sync from incoming data (multi-content) when present
    const nextPlagiarism =
      typeof data?.plagiarism === "number"
        ? data.plagiarism
        : typeof data?.metrics?.plagiarism === "number"
        ? data.metrics.plagiarism
        : metrics.plagiarism;

    if (nextPlagiarism !== metrics.plagiarism) {
      setMetrics((m) => ({ ...m, plagiarism: nextPlagiarism }));
    }
  }, [
    data,
    pageConfig,
    metrics.wordTarget,
    metrics.plagiarism,
    content,
  ]);

  /* ===========================
     Resolve navbar SV / KD
     =========================== */

  const resolveMetric = (rootVal, navbarVal) => {
    const rootNum =
      rootVal === undefined || rootVal === null ? null : Number(rootVal);
    const navNum =
      navbarVal === undefined || navbarVal === null ? null : Number(navbarVal);

    if (typeof rootNum === "number" && !Number.isNaN(rootNum) && rootNum > 0) {
      return rootNum;
    }
    if (typeof navNum === "number" && !Number.isNaN(navNum) && navNum > 0) {
      return navNum;
    }
    return null;
  };

  const navbarSearchVolume = resolveMetric(
    data?.searchVolume,
    data?.navbar?.searchVolume
  );

  const navbarKeywordDifficulty = resolveMetric(
    data?.keywordDifficulty,
    data?.navbar?.keywordDifficulty
  );

  /* ===========================
     MOBILE research drawer state
     =========================== */
  const [mobileResearchOpen, setMobileResearchOpen] = useState(false);

  // ESC to close on mobile
  useEffect(() => {
    if (!mobileResearchOpen) return;
    const onKey = (e) => e.key === "Escape" && setMobileResearchOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileResearchOpen]);

  // --------------------------------------
  // Back handler: make dashboard domain match this doc's domain
  // --------------------------------------
  const handleBackToDashboard = useCallback(() => {
    // Prefer the doc's explicit domain
    let effectiveDomain = pageDomain;

    // If this is a "new" doc with no domain, fall back to the
    // currently active domain from websiteData in localStorage
    if (!effectiveDomain) {
      try {
        const raw = localStorage.getItem("websiteData");
        if (raw) {
          const parsed = JSON.parse(raw);
          effectiveDomain =
            parsed?.site ||
            parsed?.website ||
            parsed?.domain ||
            parsed?.value ||
            "";
        }
      } catch {}
    }

    // Persist the (possibly fallback) domain back into storage
    if (effectiveDomain) {
      try {
        localStorage.setItem(
          "websiteData",
          JSON.stringify({ site: effectiveDomain })
        );
      } catch {}
    }

    // Emit the custom event your Home() listener uses
    try {
      window.dispatchEvent(
        new CustomEvent("content-editor:back", {
          detail: { domain: effectiveDomain || null },
        })
      );
    } catch {}

    // Call the prop so Home can switch step → "dashboard"
    onBackToDashboard?.();
  }, [pageDomain, onBackToDashboard]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <main className="bg-[var(--bg-panel)] px-2 py-6 sm:px-1 lg:px-2 xl:px-3 transition-colors duration-300">
        <CENavbar
          title={title}
          onBack={handleBackToDashboard}
          onTitleChange={setTitle}
          searchVolume={navbarSearchVolume}
          keywordDifficulty={navbarKeywordDifficulty}
        />

        <CEMetricsStrip
          metrics={metrics}
          seoMode={seoMode}
          onChangeSeoMode={setSeoMode}
          canAccessAdvanced={basicsUnlocked}
        />

        {/* Force remount of the whole content area (Research included) on new doc */}
        <CEContentArea
          key={editorSessionId}
          title={title}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          lastEdited={lastEdited}
          query={query}
          onQueryChange={(q) => {
            setQuery(q);
            try {
              window.dispatchEvent(
                new CustomEvent("content-editor:query-changed", {
                  detail: { query: q },
                })
              );
            } catch {}
          }}
          onStart={() => setBasicsUnlocked(true)} // auto-unlock when Basics → Start
          seoMode={seoMode}
          metrics={metrics}
          setMetrics={setMetrics}
          content={content}
          setContent={(html) => {
            setContent(html);
            setLastEdited("a few seconds ago");
          }}
          primaryKeyword={PRIMARY_KEYWORD}
          lsiKeywords={LSI}
          // Pass the pageConfig and optPageId down so the Research panel
          // can match the correct optimize-dataset entry without guessing.
          page={pageConfig}
          optPageId={pageConfig?.optPageId}
          // New: pass docId down so Canvas/autosave can be per-document
          docId={docId}
          // New: unified SEO data for this page from /api/seo
          seoData={seo}
          seoLoading={seoLoading}
          seoError={seoError}
        />

        {process.env.NODE_ENV !== "production" && configError && (
          <p className="mt-2 text-xs text-red-600">
            Config load error: {configError}
          </p>
        )}
      </main>

      {/* ===== MOBILE-ONLY Research FAB (bottom-right symbol) ===== */}
      <button
        type="button"
        onClick={() => setMobileResearchOpen(true)}
        aria-label="Open research"
        className="
          fixed bottom-5 right-5 z-[60] lg:hidden
          h-12 w-12 rounded-full shadow-lg grid place-items-center text-white
          active:scale-95 transition-all
          bg-gradient-to-br from-[#d74d2b] to-[#f59e0b]
        "
      >
        <AlertTriangle size={22} />
      </button>

      {/* Backdrop (mobile only) */}
      <div
        onClick={() => setMobileResearchOpen(false)}
        className={`
          fixed inset-0 z-50 bg-black/25 transition-opacity lg:hidden
          ${
            mobileResearchOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }
        `}
      />

      {/* Slide-over Drawer (mobile only) */}
      <aside
        className={`
          fixed top-0 right-0 z-[55] h-full w-[min(92vw,420px)] lg:hidden
          bg-white border-l border-[var(--border)] rounded-l-2xl shadow-xl
          transition-transform duration-300 will-change-transform
          ${mobileResearchOpen ? "translate-x-0" : "translate-x-full"}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Research panel"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-white/95 backdrop-blur">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            Research
          </div>
          <button
            onClick={() => setMobileResearchOpen(false)}
            aria-label="Close research"
            className="p-2 rounded-lg hover:bg-gray-100 text-[var(--muted)]"
          >
            <X size={18} />
          </button>
        </div>

        {mobileResearchOpen && (
          <div className="h-[calc(100%-49px)] overflow-y-auto">
            <CEResearchPanel
              query={query}
              onQueryChange={(q) => {
                setQuery(q);
                try {
                  window.dispatchEvent(
                    new CustomEvent("content-editor:query-changed", {
                      detail: { query: q },
                    })
                  );
                } catch {}
              }}
              onStart={() => setBasicsUnlocked(true)}
              seoMode={seoMode}
              metrics={metrics}
              onFix={() => {}}
              onPasteToEditor={() => {}}
              editorContent={content}
              /* Pass the resolved page and optPageId to prevent first-page fallback on mobile */
              page={pageConfig}
              optPageId={pageConfig?.optPageId}
              // Unified SEO data for this page from /api/seo (mobile research panel)
              seoData={seo}
              seoLoading={seoLoading}
              seoError={seoError}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
