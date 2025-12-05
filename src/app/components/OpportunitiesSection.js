"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  FileText,
  ChevronRight,
  Eye,
  Check,
  PencilLine,
  X,
} from "lucide-react";

/* ============================================================
   Helpers (only what's needed for Opportunities)
============================================================ */

// Generic titles for cards (UI only)
const GENERIC_CARD_TITLES = [
  "How to Improve Site Speed",
  "Complete Local SEO Guide",
  "Content Strategy Basics",
  "Beginner’s Guide to SEO",
];

const STORAGE_DOMAIN_KEYS = [
  "websiteData",
  "site",
  "website",
  "selectedWebsite",
  "drfizzm.site",
  "drfizzm.website",
];

const normalizeDomain = (input = "") => {
  try {
    const url = input.includes("://")
      ? new URL(input)
      : new URL(`https://${input}`);
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return String(input)
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
};

const slugify = (title = "") =>
  String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Try to recover current site/domain from storage or URL.
 * IMPORTANT: Prefer storage (what wizard/editor last wrote),
 * and only fall back to ?site= so we don't get stuck on an
 * old query-string domain.
 */
function getSiteFromStorageOrQuery(searchParams) {
  // 1) First try localStorage / sessionStorage
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (const k of STORAGE_DOMAIN_KEYS) {
        const v = store.getItem(k);
        if (!v) continue;
        try {
          const o = JSON.parse(v);
          const cands = [o?.site, o?.website, o?.url, o?.domain, o?.value];
          for (const c of cands) {
            if (c) return normalizeDomain(String(c));
          }
        } catch {
          // plain string?
          return normalizeDomain(v);
        }
      }
    }
  } catch {
    // ignore storage errors (e.g. SSR/private mode)
  }

  // 2) Then fall back to ?site=... in the URL
  const qp = searchParams?.get?.("site");
  if (qp) return normalizeDomain(qp);

  // 3) Finally, hard default
  return "example.com";
}

/**
 * Mapper for seo-data.json rows (metrics + basic content)
 */
function mapSeoRowToSchema(row) {
  const n = (x, d = undefined) => {
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string") {
      const v = Number(x.replace?.(/[, ]/g, "") ?? x);
      if (Number.isFinite(v)) return v;
    }
    return d;
  };
  const s = (x, d = undefined) => (typeof x === "string" ? x : d);

  return {
    domain: normalizeDomain(s(row["Domain/Website"], s(row["Domain"], ""))),
    content: {
      blog: [
        {
          title: s(row["Blog1_Title"], "Untitled"),
          priority: s(row["Blog1_Priority"], "Medium Priority"),
          wordCount: n(row["Blog1_Word_Count"], 0),
          keywords: n(row["Blog1_Num_Keywords"], 0),
          score: n(row["Blog1_Score"], 0),
          status: s(row["Blog1_Status"], "Draft"),
          content: s(row["Blog1_Content"], ""),
        },
        {
          title: s(row["Blog2_Title"], "Untitled"),
          priority: s(row["Blog2_Priority"], "Medium Priority"),
          wordCount: n(row["Blog2_Word_Count"], 0),
          keywords: n(row["Blog2_Num_Keywords"], 0),
          score: n(row["Blog2_Score"], 0),
          status: s(row["Blog2_Status"], "Draft"),
          content: s(row["Blog2_Content"], ""),
        },
      ],
      pages: [
        {
          title: s(row["Page1_Title"], "Untitled"),
          priority: s(row["Page1_Priority"], "Medium Priority"),
          wordCount: n(row["Page1_Word_Count"], 0),
          keywords: n(row["Page1_Num_Keywords"], 0),
          score: n(row["Page1_Score"], 0),
          status: s(row["Page1_Status"], "Draft"),
          content: s(row["Page1_Content"], ""),
        },
        {
          title: s(row["Page2_Title"], "Untitled"),
          priority: s(row["Page2_Priority"], "Medium Priority"),
          wordCount: n(row["Page2_Word_Count"], 0),
          keywords: n(row["Page2_Num_Keywords"], 0),
          score: n(row["Page2_Score"], 0),
          status: s(row["Page2_Status"], "Draft"),
          content: s(row["Page2_Content"], ""),
        },
      ],
    },
  };
}

/**
 * Mapper for multi-content.json:
 * keeps primaryKeyword, lsiKeywords, plagiarism, searchVolume, keywordDifficulty per slot.
 */
function mapMultiRowToContent(row) {
  const safeSlot = (slot) =>
    slot && typeof slot === "object"
      ? {
          title: slot.title || null,
          content: slot.content || "",
          primaryKeyword: slot.primaryKeyword || null,
          lsiKeywords: Array.isArray(slot.lsiKeywords) ? slot.lsiKeywords : [],
          plagiarism:
            typeof slot.plagiarism === "number" ? slot.plagiarism : null,
          searchVolume:
            typeof slot.searchVolume === "number" ? slot.searchVolume : null,
          keywordDifficulty:
            typeof slot.keywordDifficulty === "number"
              ? slot.keywordDifficulty
              : null,
        }
      : {
          title: null,
          content: "",
          primaryKeyword: null,
          lsiKeywords: [],
          plagiarism: null,
          searchVolume: null,
          keywordDifficulty: null,
        };

  return {
    domain: normalizeDomain(row.domain || ""),
    content: {
      blog: [safeSlot(row.blog1), safeSlot(row.blog2)],
      pages: [safeSlot(row.page1), safeSlot(row.page2)],
    },
  };
}

/* ============================================================
   Start Modal
============================================================ */
function StartModal({
  open,
  onClose,
  onCreateFromScratch,
  onEditExisting,
  onCreateWithStyle,
}) {
  const STYLES = [
    {
      id: "wander",
      title: "Wander & Wonder",
      desc: "A journal of curious thoughts, quiet travels, and unexpected discoveries.",
    },
    {
      id: "bytesized",
      title: "ByteSized Mind",
      desc: "Quick, sharp takes on tech, life, and learning. Small posts, big ideas—delivered fresh.",
    },
    {
      id: "lazycompass",
      title: "The Lazy Compass",
      desc: "Travel stories for slow movers and deep thinkers. Wander less, feel more.",
    },
  ];
  const [hover, setHover] = useState(STYLES[0].id);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40">
      <div
        className="
          relative grid overflow-hidden rounded-2xl bg-white shadow-2xl
          w-[min(980px,100vw-32px)]
          grid-cols-1 md:grid-cols-2
          h-[92vh] md:h-auto
          min-h-0
        "
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Mobile banner */}
        <div className="md:hidden relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-16 h-72 w-72 rounded-full"
            style={{
              background:
                "radial-gradient(160px 160px at 65% 40%, #F8B06B 0%, #F39C4F 45%, rgba(248,176,107,0.2) 70%, rgba(255,255,255,0) 72%)",
            }}
          />
          <div className="pt-12 pb-3 px-6 text-center">
            <div className="text-[34px] font-extrabold leading-[1.05] tracking-tight text-[#0F172A]">
              CREATE,<br />
              OPTIMIZE &<br />
              PUBLISH
            </div>
            <div className="mt-2 text-[13px] text-[#9CA3AF]">
              No tab-hopping required.
            </div>
          </div>
        </div>

        {/* Desktop left banner */}
        <div
          className="relative hidden min-h-[520px] flex-col justify-end p-10 md:flex"
          style={{
            background:
              "radial-gradient(520px 220px at -8% 70%, #FAD7A5 0%, transparent 65%), #FFF9F2",
          }}
        >
          <div className="pointer-events-none select-none">
            <div className="text-[56px] font-extrabold leading-[0.95] tracking-tight text-[#0F172A]">
              CREATE,<br />
              OPTIMIZE &<br />
              PUBLISH
            </div>
            <div className="mt-4 text-[15px] text-[#6B7280]">
              No tab-hopping required.
            </div>
          </div>
        </div>

        {/* Right column / content */}
        <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA]">
          {/* Mobile header + helper panel */}
          <div className="md:hidden px-6">
            <div className="text-[16px] font-semibold text-[#0F172A]">
              Blogs
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
              Explore the latest article &amp; stay updated with latest trend
              &amp; insights in the industry
            </p>

            <div className="mt-4 rounded-2xl bg-[#F5F5F5] px-4 pt-3 pb-2 border border-[#ECECEC]">
              <div className="text-[12px] text-[#9CA3AF]">
                Select any{" "}
                <span className="font-medium text-[#6B7280]">1 style</span> to
                proceed
              </div>
              <div className="mt-2 border-t border-[#E5E7EB]" />
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden md:flex flex-col p-6">
            <div className="text-xl font-semibold text-[#0F172A]">Blogs</div>
            <div className="mt-1 text-[12px] text-[#6B7280]">
              Select any 1 to create with that style
            </div>
          </div>

          {/* Scrollable list area */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-24 md:pb-6"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="mt-3 md:mt-0 space-y-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onMouseEnter={() => setHover(s.id)}
                  onClick={() => {
                    setHover(s.id);
                    onCreateWithStyle(s.id);
                  }}
                  className={`
                    w-full rounded-2xl p-4 text-left transition
                    bg-white border border-[#EFEFEF] shadow-[0_2px_10px_rgba(0,0,0,0.06)]
                    flex items-center justify-between
                    ${
                      hover === s.id
                        ? "ring-1 ring-black/5"
                        : "hover:ring-1 hover:ring-black/5"
                    }
                  `}
                  aria-pressed={hover === s.id}
                  title="Click to create a new blog with this style"
                >
                  <div className="pr-3">
                    <div className="font-semibold text-[15px] text-[#0F172A]">
                      {s.title}
                    </div>
                    <div className="mt-1 max-w-[380px] text-[12px] leading-relaxed text-[#6B7280]">
                      {s.desc}
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <div className="h-[76px] w-[116px] rounded-[14px] bg-[#E5E7EB]" />
                    <div className="pointer-events-none absolute inset-2 rounded-[10px] border border-white/60 shadow-inner" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-6 py-4 flex items-center justify-between gap-3">
            <button
              onClick={onCreateFromScratch}
              className="text-[13px] font-medium text-[#F97316]"
            >
              Create from scratch
            </button>
            <button
              onClick={onEditExisting}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white bg-[#F97316] hover:brightness-95 shadow-sm"
            >
              Edit existing page
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Opportunities Section
============================================================ */

export default function OpportunitiesSection({ onOpenContentEditor }) {
  const searchParams = useSearchParams();
  const [domain, setDomain] = useState("example.com");

  const [seoRows, setSeoRows] = useState(null);
  const [multiRows, setMultiRows] = useState(null);

  const [prog, setProg] = useState(0);

  // Modal state
  const [startOpen, setStartOpen] = useState(false);
  const startPayloadRef = useRef(null); // keep real title/kind/content/domain for "Edit existing"

  useEffect(() => {
    const d = getSiteFromStorageOrQuery(searchParams);
    setDomain(d);
  }, [searchParams]);

  // Load seo-data.json
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/seo-data.json", { cache: "no-store" });
        const json = await res.json();
        if (alive && Array.isArray(json)) {
          setSeoRows(json.map(mapSeoRowToSchema));
        }
      } catch (e) {
        console.error("Failed to load /data/seo-data.json", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load multi-content.json
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/multi-content.json", {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive && Array.isArray(json)) {
          setMultiRows(json.map(mapMultiRowToContent));
        }
      } catch (e) {
        console.error("Failed to load /data/multi-content.json", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedSeo = useMemo(() => {
    if (!seoRows?.length) return null;
    const key = normalizeDomain(domain);
    return seoRows.find((r) => r.domain === key) || null;
  }, [seoRows, domain]);

  const selectedMulti = useMemo(() => {
    if (!multiRows?.length) return null;
    const key = normalizeDomain(domain);
    return multiRows.find((r) => r.domain === key) || null;
  }, [multiRows, domain]);

  // Score tick animation for cards – based on seoRows being loaded
  useEffect(() => {
    if (!seoRows) return;
    let raf;
    const t0 = performance.now();
    const dur = 900;
    const tick = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dur));
      const ease = 1 - Math.pow(1 - p, 3);
      setProg(ease);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seoRows]);

  // Merge slots: metrics from seo-data, content/title + SEO fields from multi-content when available
  const mergeSlot = (seoSlot, multiSlot, fallbackTitle) => {
    const title =
      multiSlot?.title || seoSlot?.title || fallbackTitle || "Untitled";
    const content = multiSlot?.content || seoSlot?.content || "";

    if (!seoSlot && !multiSlot) return {};

    const primaryKeyword =
      multiSlot?.primaryKeyword ?? seoSlot?.primaryKeyword ?? null;
    const lsiKeywords =
      (Array.isArray(multiSlot?.lsiKeywords) && multiSlot.lsiKeywords.length
        ? multiSlot.lsiKeywords
        : Array.isArray(seoSlot?.lsiKeywords)
        ? seoSlot.lsiKeywords
        : []) || [];
    const plagiarism =
      typeof multiSlot?.plagiarism === "number"
        ? multiSlot.plagiarism
        : typeof seoSlot?.plagiarism === "number"
        ? seoSlot.plagiarism
        : null;

    const searchVolume =
      typeof multiSlot?.searchVolume === "number"
        ? multiSlot.searchVolume
        : typeof seoSlot?.searchVolume === "number"
        ? seoSlot.searchVolume
        : null;

    const keywordDifficulty =
      typeof multiSlot?.keywordDifficulty === "number"
        ? multiSlot.keywordDifficulty
        : typeof seoSlot?.keywordDifficulty === "number"
        ? seoSlot.keywordDifficulty
        : null;

    const baseTitle = multiSlot?.title || seoSlot?.title || fallbackTitle;

    return {
      ...seoSlot,
      ...multiSlot,
      title,
      content,
      primaryKeyword,
      lsiKeywords,
      plagiarism,
      searchVolume,
      keywordDifficulty,
      slug:
        multiSlot?.slug ||
        seoSlot?.slug ||
        (baseTitle ? slugify(baseTitle) : undefined),
    };
  };

  const blogCards = useMemo(() => {
    const seo = selectedSeo?.content?.blog ?? [];
    const multi = selectedMulti?.content?.blog ?? [];
    const out = [];
    for (let i = 0; i < 2; i += 1) {
      const merged = mergeSlot(
        seo[i],
        multi[i],
        `Blog Opportunity ${i + 1}`
      );
      out.push(merged);
    }
    return out;
  }, [selectedSeo, selectedMulti]);

  const pageCards = useMemo(() => {
    const seo = selectedSeo?.content?.pages ?? [];
    const multi = selectedMulti?.content?.pages ?? [];
    const out = [];
    for (let i = 0; i < 2; i += 1) {
      const merged = mergeSlot(
        seo[i],
        multi[i],
        `Page Opportunity ${i + 1}`
      );
      out.push(merged);
    }
    return out;
  }, [selectedSeo, selectedMulti]);

  /* ---------- Start Flow helpers ---------- */

  const styleTemplate = useCallback((id) => {
    if (id === "wander")
      return {
        title: "Wander & Wonder — New Post",
        content:
          "<h1>Wander & Wonder</h1><p>A journal of curious thoughts, quiet travels, and unexpected discoveries.</p><h2>Opening</h2><p>Share a quiet observation or a poetic snapshot.</p><h2>Reflection</h2><p>Connect a place with an idea.</p><h2>Closing</h2><p>Invite the reader to slow down.</p>",
      };
    if (id === "bytesized")
      return {
        title: "ByteSized Mind — Quick Take",
        content:
          "<h1>ByteSized Mind</h1><ul><li>One strong idea</li><li>One practical tip</li><li>One link to explore</li></ul>",
      };
    if (id === "lazycompass")
      return {
        title: "The Lazy Compass — Field Notes",
        content:
          "<h1>The Lazy Compass</h1><h2>Route</h2><p>Where are we going?</p><h2>Texture</h2><p>What does it feel like?</p><h2>Keepsake</h2><p>A takeaway for the reader.</p>",
      };
    return { title: "Untitled", content: "" };
  }, []);

  const dispatchOpen = (payload) => {
    try {
      window.dispatchEvent(
        new CustomEvent("content-editor:open", { detail: payload })
      );
    } catch {}
    onOpenContentEditor?.(payload);
  };

  const handleEditExisting = () => {
    const real = startPayloadRef.current || {};
    if (!real.title && !real.content) {
      setStartOpen(false);
      return;
    }
    dispatchOpen({
      title: real.title,
      slug: real.slug || (real.title ? slugify(real.title) : undefined),
      kind: real.kind || "blog",
      content: real.content || "",
      domain: real.domain || domain,
      primaryKeyword: real.primaryKeyword || null,
      lsiKeywords: real.lsiKeywords || [],
      plagiarism:
        typeof real.plagiarism === "number" ? real.plagiarism : null,
      searchVolume:
        typeof real.searchVolume === "number" ? real.searchVolume : null,
      keywordDifficulty:
        typeof real.keywordDifficulty === "number"
          ? real.keywordDifficulty
          : null,
    });
    setStartOpen(false);
  };

  // 👉 Brand-new doc: make a unique slug/id so Canvas does NOT re-use autosave
  const handleCreateFromScratch = () => {
    const base = `untitled-${Date.now()}`;
    const slug = slugify(base);
    const payload = {
      title: "Untitled",
      content: "", // empty so CE.Canvas starts blank
      kind: "blog",
      domain,
      slug,
      id: slug,
    };
    dispatchOpen(payload);
    setStartOpen(false);
  };

  // Styled docs also get their own unique slug/id
  const handleCreateWithStyle = (styleId) => {
    const tpl = styleTemplate(styleId);
    const base = `${tpl.title || "styled-doc"}-${Date.now()}`;
    const slug = slugify(base);
    const payload = {
      ...tpl,
      kind: "blog",
      styleId,
      domain,
      slug,
      id: slug,
    };
    dispatchOpen(payload);
    setStartOpen(false);
  };

  /* ---------- Small UI pieces ---------- */

  function PriorityBadge({ score }) {
    const v = Number(score) || 0;
    const cfg =
      v <= 30
        ? {
            label: "High Priority",
            bg: "#FFF0F4",
            br: "#FFE1EA",
            dot: "#EF4444",
            txt: "#D12C2C",
          }
        : v <= 70
        ? {
            label: "Medium Priority",
            bg: "#FFF5D9",
            br: "#FDE7B8",
            dot: "#F59E0B",
            txt: "#B98500",
          }
        : {
            label: "Low Priority",
            bg: "#EAF8F1",
            br: "#CBEBD9",
            dot: "#22C55E",
            txt: "#178A5D",
          };
    return (
      <span
        className="inline-flex items-center gap-2 rounded-[10px] px-2.5 py-1 text-[12px] font-medium"
        style={{
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.br}`,
          color: cfg.txt,
        }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: cfg.dot }}
        />
        {cfg.label}
      </span>
    );
  }

  function OpportunityCard({ type, index, data }) {
    const score = data?.score ?? 0;
    const wc = data?.wordCount ?? 0;
    const kws = data?.keywords ?? 0;
    const status = data?.status ?? "Draft";

    const realTitle = data?.title;

    // prefer realTitle (from multi-content/seo-data) first
    const displayTitle =
      realTitle ||
      GENERIC_CARD_TITLES[index % GENERIC_CARD_TITLES.length] ||
      "SEO Opportunity";

    return (
      <div className="relative rounded-[18px] border border-[var(--border)] bg-[var(--input)] p-4 shadow-sm">
        <div className="group absolute right-4 top-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold shadow-sm tabular-nums bg-[#FFF5D9] border border-[#FDE7B8] text-[#B98500]">
            {Math.round(score * prog)}
          </div>
        </div>

        <div className="pr-14">
          <h3 className="text-[20px] font-semibold leading-snug text-[var(--text)]">
            {displayTitle}
          </h3>
        </div>

        <hr className="mt-3 border-t border-[var(--border)]" />

        <div className="mt-3 flex items-center gap-2">
          <PriorityBadge score={score} />
          <span className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[#F6F8FB] px-2.5 py-1 text-[12px] text-[var(--muted)]">
            {status === "Published" ? (
              <Check size={14} />
            ) : (
              <PencilLine size={14} />
            )}
            {status}
          </span>
        </div>

        <div className="mt-4 rounded-[12px] border border-[var(--border)] bg-[var(--input)] px-4 py-3">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[12px] text-[var(--muted)]">Word Count</div>
              <div className="mt-1 text-[28px] font-semibold leading-none text-[var(--text)] tabular-nums">
                {wc.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[var(--muted)]">Keywords</div>
              <div className="mt-1 text-[28px] font-semibold leading-none text-[var(--text)] tabular-nums">
                {kws}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-[12px] font-medium text-[var(--muted)]">
            <Eye size={14} /> View Details
          </button>
          <button
            onClick={() => {
              const titleForSlug = realTitle || displayTitle;
              startPayloadRef.current = {
                kind: type, // "blog" or "page"
                title: realTitle || displayTitle,
                slug:
                  data?.slug ||
                  (titleForSlug ? slugify(titleForSlug) : undefined),
                content: data?.content || "",
                domain,
                primaryKeyword: data?.primaryKeyword || null,
                lsiKeywords: data?.lsiKeywords || [],
                plagiarism:
                  typeof data?.plagiarism === "number"
                    ? data.plagiarism
                    : null,
                searchVolume:
                  typeof data?.searchVolume === "number"
                    ? data.searchVolume
                    : null,
                keywordDifficulty:
                  typeof data?.keywordDifficulty === "number"
                    ? data.keywordDifficulty
                    : null,
              };
              setStartOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2 text-[13px] font-semibold text-white shadow-sm bg-[image:var(--infoHighlight-gradient)] hover:opacity-90 transition"
          >
            Start <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     UI — Opportunities grid + Start modal
  ============================================================ */

  return (
    <>
      <h2 className="mb-3 ml-1 text-[16px] font-bold text-[var(--text)]">
        Top On-Page Content Opportunities
      </h2>

      <section className="mb-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--input)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#FDE7B8] bg-[#FFF5D9] text-[#B98500]">
              <BookOpen size={14} />
            </span>
            <span className="text-[13px] font-semibold">BLOG</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(blogCards.length ? blogCards.slice(0, 2) : [{}, {}]).map(
              (b, i) => (
                <OpportunityCard
                  key={`b-${i}`}
                  type="blog"
                  index={i}
                  data={b}
                />
              )
            )}
          </div>
        </div>

        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--input)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#D1FAE5] bg-[#EAF8F1] text-[#178A5D]">
              <FileText size={14} />
            </span>
            <span className="text-[13px] font-semibold">PAGES</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(pageCards.length ? pageCards.slice(0, 2) : [{}, {}]).map(
              (p, i) => (
                <OpportunityCard
                  key={`p-${i}`}
                  type="page"
                  index={i}
                  data={p}
                />
              )
            )}
          </div>
        </div>
      </section>

      <StartModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onCreateFromScratch={handleCreateFromScratch}
        onEditExisting={handleEditExisting}
        onCreateWithStyle={handleCreateWithStyle}
      />
    </>
  );
}
