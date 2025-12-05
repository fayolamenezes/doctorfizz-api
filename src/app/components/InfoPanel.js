
"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pin, PinOff, BarChart2 } from "lucide-react";
import Image from "next/image";

/* -------------------- Video helpers -------------------- */
const DEFAULT_VIDEO = "https://youtube.com/shorts/_7LPvKmZkwg?si=vD25P17VltV7szZu";

function toYouTubeEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/")[2];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    return url;
  } catch {
    return url;
  }
}

/* ---------- simple portal hook ---------- */
function usePortal(targetId = "modal-root") {
  const [el, setEl] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let node = document.getElementById(targetId);
    if (!node) {
      node = document.createElement("div");
      node.id = targetId;
      document.body.appendChild(node);
    }
    setEl(node);
  }, [targetId]);
  return el;
}

/* ---------- GLOBAL MODAL rendered via PORTAL ---------- */
function VideoModal({ open, title, url, onClose, onExpand }) {
  const container = usePortal("modal-root");

  // lock body scroll when open
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !container) return null;

  const embedUrl = toYouTubeEmbed(url || DEFAULT_VIDEO);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/70 grid place-items-center p-4">
      <div className="relative w-[90vw] sm:w-[78vw] md:w-[60vw] lg:w-[560px] max-w-[560px] max-h-[80vh] overflow-hidden rounded-2xl bg-[var(--panel)] text-[var(--text)] shadow-2xl p-4">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-[var(--muted)] hover:text-[var(--text)]"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="text-lg font-semibold mb-3">{title}</div>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title={title}
            allowFullScreen
            frameBorder="0"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onExpand}
            className="px-4 py-2 rounded-md text-white font-medium shadow bg-[image:var(--brand-gradient)]"
          >
            Expand in New Tab
          </button>
        </div>
      </div>
    </div>,
    container
  );
}

/* -------------------- Data helpers (non-UI) -------------------- */
function normalizeDomain(input = "") {
  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return String(input)
      .toLowerCase()
      .replace(/^https?:\/\/\//, "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}
function coerceNumber(x) {
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const v = Number(x.replace(/[, ]/g, ""));
    return Number.isFinite(v) ? v : undefined;
  }
  return undefined;
}
function mapRowToMini(row) {
  if (!row || typeof row !== "object") return null;
  const domain = normalizeDomain(row["Domain/Website"] ?? "");
  return {
    domain,
    domainRating: coerceNumber(row["Domain_Rating"]),
    organicTrafficMonthly: coerceNumber(row["Organic_Traffic"]),
    organicKeywordsTotal: coerceNumber(row["Total_Organic_Keywords"]),
  };
}
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "--";
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(num);
}

/* -------------------- Presentational helpers -------------------- */
function WebsiteStatsCard({ website, stats }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 dark:bg-[var(--extra-input-dark)] dark:border-[var(--extra-border-dark)]">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-wide text-gray-500 dark:text-[var(--muted)] font-medium">
          WEBSITE :
          <span className="ml-2 text-[13px] font-semibold text-[#d45427]">{website}</span>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2.5 py-[3px]">
          Good
        </span>
      </div>
      {/* stats */}
      <div className="mt-3 rounded-xl bg-white p-4 dark:bg-[var(--extra-input-dark)]">
        <div className="flex items-stretch divide-x divide-gray-200 dark:divide-[var(--extra-border-dark)]">
          {[
            ["Domain Authority", stats.domainAuthority],
            ["Organic Traffic", stats.organicTraffic],
            ["Organic Keyword", stats.organicKeyword],
          ].map(([label, value], idx) => (
            <div key={idx} className="flex-1 px-5 text-center">
              <div className="text-[13px] leading-[16px] text-gray-600 dark:text-[var(--muted)] font-medium">
                {label}
              </div>
                <div className="mt-2 mb-1.5 flex items-center justify-center gap-2">
                <div className="text-[clamp(20px,3vw,23px)] leading-tight font-extrabold text-gray-900 dark:text-[var(--text)]">
                  {Number.isFinite(value) ? formatNumber(value) : "--"}
                </div>
                {value >= 70 ? (
                  <span className="text-emerald-400 text-[14px]">↑</span>
                ) : (
                  <span className="text-red-400 text-[14px]">↓</span>
                )}
              </div>
              <div className="text-[13px] text-gray-500 dark:text-[var(--muted)]" suppressHydrationWarning>
                {Math.floor(Math.random() * (100 - 26 + 1)) + 26}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small video preview row with POSTER support */
function VideoRow({ title, author = "@itzfizz", onOpen, poster }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 w-full rounded-xl bg-white dark:bg-[var(--extra-input-dark)] border border-gray-200 dark:border-[var(--extra-border-dark)] p-3 shadow-sm hover:shadow transition text-left"
    >
      <div className="flex items-center gap-3">
        {/* poster thumbnail */}
        <div className="w-16 h-10 rounded-lg overflow-hidden relative bg-black/10 dark:bg-white/5 shrink-0">
          <Image
            src={poster || "/assets/poster.png"}
            alt={title}
            fill
            sizes="64px"
            className="object-cover"
            priority={false}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-gray-900 dark:text-[var(--text)] truncate">
            {title}
          </div>
          <div className="text-xs text-gray-500 dark:text-[var(--muted)]">{author}</div>
        </div>

        <div className="text-gray-400">⋯</div>
      </div>
    </button>
  );
}

/** Content card that preserves copy ABOVE the video row and forwards poster */
function ContentCard({
  title,
  subtitle,
  lines = [],
  badge, // {text, tone: 'warning'|'info'|'success'}
  videoTitle,
  videoUrl = DEFAULT_VIDEO,
  author = "@itzfizz",
  rightBadgeIcon = "i",
  poster, // NEW
}) {
  const [open, setOpen] = useState(false);
  const badgeClass =
    badge?.tone === "warning"
      ? "bg-[#ffedd5] text-[#b45309] border border-[#fdba74]"
      : badge?.tone === "success"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : "bg-gray-100 text-gray-700 border border-gray-200";

  return (
    <div className="bg-white rounded-lg shadow-sm p-3 dark:bg-[var(--extra-input-dark)] border border-gray-200 dark:border-[var(--extra-border-dark)]">
      {/* header + text content */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-[var(--text)]">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-500 dark:text-[var(--muted)] mt-0.5">{subtitle}</div>
          )}
          {lines?.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {lines.map((l, i) => (
                <div key={i} className="text-xs text-gray-500 dark:text-[var(--muted)]">
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-gray-400 dark:text-[var(--muted)] cursor-help select-none">{rightBadgeIcon}</div>
      </div>

      {/* CTA / warning badge */}
      {badge?.text && (
        <div className={`mt-3 inline-flex items-center px-3 py-1.5 text-xs rounded-md ${badgeClass}`}>
          {badge.text}
        </div>
      )}

      {/* video preview row with poster */}
      <VideoRow
        title={videoTitle}
        author={author}
        poster={poster}
        onOpen={() => setOpen(true)}
      />

      {/* modal via portal (global overlay) */}
      <VideoModal
        open={open}
        title={videoTitle}
        url={videoUrl}
        onClose={() => setOpen(false)}
        onExpand={() => window.open(videoUrl || DEFAULT_VIDEO, "_blank")}
      />
    </div>
  );
}

/* ---------- Responsive breakpoint helper (Tailwind lg = 1024px) ---------- */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);
  return isDesktop;
}

/* -------------------- Component -------------------- */
export default function InfoPanel({
  isOpen,
  onClose,
  isPinned,
  setIsPinned,
  websiteData,
  businessData,
  languageLocationData,
  keywordData = [],
  competitorData = null,
  currentStep,
}) {
  const panelRef = useRef(null);
  const isDesktop = useIsDesktop();

  // (optional) global video state if you add a top header play button later
  const [activeVideo, setActiveVideo] = useState(null);

  // load dataset (for stat numbers)
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/seo-data.json", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load seo-data.json");
        const json = await res.json();
        const mapped = Array.isArray(json) ? json.map(mapRowToMini).filter(Boolean) : [];
        if (alive) setRows(mapped);
      } catch (e) {
        /* fallback to generated stats */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(() => {
    if (!rows?.length) return null;
    const key = normalizeDomain(websiteData?.website || "");
    return rows.find((r) => r.domain === key) || rows.find((r) => r.domain === `www.${key}`) || null;
  }, [rows, websiteData?.website]);

  // outside click close (except when pinned)
  useEffect(() => {
    function handleClickOutside(e) {
      if (isPinned) return;
      if (e.target.closest("#sidebar-info-btn")) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose && onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPinned, onClose]);

  /* ---------- Auto-pin only on DESKTOP; disable on tablet/mobile ---------- */
  const LAST_STEP = 6;
  const hasWebsite = Boolean(websiteData?.website && String(websiteData.website).trim());
  useEffect(() => {
    if (!isDesktop) return; // only on desktop
    if (hasWebsite && typeof currentStep === "number" && currentStep <= LAST_STEP) {
      setIsPinned(true);
    }
  }, [hasWebsite, currentStep, setIsPinned, isDesktop]);
  useEffect(() => {
    if (!hasWebsite) setIsPinned(false);
  }, [hasWebsite, setIsPinned]);

  // If website just changed on non-desktop, close & unpin to negate "auto open/pin" from submit
  const prevWebsite = useRef(websiteData?.website || "");
  useEffect(() => {
    const curr = websiteData?.website || "";
    if (curr !== prevWebsite.current) {
      if (!isDesktop) {
        setIsPinned(false);
        onClose && onClose();
      }
      prevWebsite.current = curr;
    }
  }, [websiteData?.website, isDesktop, onClose, setIsPinned]);

  // Unpin + close when Dashboard opens (desktop parity)
  useEffect(() => {
    if (currentStep === "dashboard") {
      setIsPinned(false);
      onClose && onClose();
    }
  }, [currentStep, setIsPinned, onClose]);

  // (optional) custom event fallback
  useEffect(() => {
    function handleDashboardOpen() {
      setIsPinned(false);
      onClose && onClose();
    }
    window.addEventListener("dashboard:open", handleDashboardOpen);
    return () => window.removeEventListener("dashboard:open", handleDashboardOpen);
  }, [onClose, setIsPinned]);

  const generateRandomStats = (website) => {
    if (!website) return { domainAuthority: 49, organicTraffic: 72, organicKeyword: 75 };
    const seed = website.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const r1 = (seed * 9301 + 49297) % 233280;
    const r2 = (r1 * 9301 + 49297) % 233280;
    const r3 = (r2 * 9301 + 49297) % 233280;
    return {
      domainAuthority: Math.floor((r1 / 233280) * 100) + 1,
      organicTraffic: Math.floor((r2 / 233280) * 100) + 1,
      organicKeyword: Math.floor((r3 / 233280) * 100) + 1,
    };
  };

  const stats = selected
    ? {
        domainAuthority: Math.round(selected.domainRating ?? 0),
        organicTraffic: Math.round(selected.organicTrafficMonthly ?? 0),
        organicKeyword: Math.round(selected.organicKeywordsTotal ?? 0),
      }
    : generateRandomStats(websiteData?.website);
  const displayWebsite = websiteData?.website || "yourcompany.com";

  /* -------------------- STEP VIEWS -------------------- */

  const renderStep1Content = () => (
    <div className="space-y-6">
      <WebsiteStatsCard website={displayWebsite} stats={stats} />

      <div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm flex items-center justify-center fixthis-badge">
            <span className="text-xs font-bold">!</span>
          </div>
          <h4 className="text-sm font-bold fixthis-title">FIX THIS</h4>
        </div>
        <div className="place-items-center flex justify-center">
          <div className="divider-gradient-line h-[1px] w-[100%] bg-[image:var(--brand-gradient)] my-2 mb-5"></div>
        </div>

        <div className="space-y-4">
          <ContentCard
            title={`Domain Authority (${stats.domainAuthority})`}
            subtitle="Your site trust score (0–100)"
            lines={[`${stats.domainAuthority} = above average for SMBs`]}
            badge={{ text: "Improve : Build Quality Backlinks", tone: "warning" }}
            videoTitle="How to Build Domain Authority"
            videoUrl={DEFAULT_VIDEO}
            poster="/assets/poster.png"
          />

          <ContentCard
            title={`Organic Traffic (${stats.organicTraffic})`}
            subtitle="Monthly visits from free searches."
            lines={[`${stats.organicTraffic} = visitors last month.`]}
            badge={{ text: "Each organic visitor costs $0 vs $2–5 for ads.", tone: "warning" }}
            videoTitle="Turn Traffic Into Customers"
            videoUrl={DEFAULT_VIDEO}
            poster="/assets/poster.png"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2Content = () => (
    <div className="space-y-6">
      <WebsiteStatsCard website={displayWebsite} stats={stats} />
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm flex items-center justify-center fixthis-badge">
          <span className="text-xs font-bold">!</span>
        </div>
        <h4 className="text-sm font-bold fixthis-title">FIX THIS</h4>
      </div>
      <div className="space-y-4">
        <ContentCard
          title="Why Industry Matters"
          subtitle="Personalized Benchmarks vs. relevant peers"
          lines={["Keyword suggestion", "KEYWORD-1   KEYWORD-2   KEYWORD-3"]}
          videoTitle="Industry SEO Strategies"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
        <ContentCard
          title="Business Type Impact"
          lines={["Local vs. national focus", "Content and customer journey differences"]}
          videoTitle="How to Build Domain Authority"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
      </div>
    </div>
  );

  const renderStep3Content = () => (
    <div className="space-y-6">
      <WebsiteStatsCard website={displayWebsite} stats={stats} />
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm flex items-center justify-center fixthis-badge">
          <span className="text-xs font-bold">!</span>
        </div>
        <h4 className="text-sm font-bold fixthis-title">FIX THIS</h4>
      </div>
      <div className="space-y-4">
        <ContentCard
          title="Local SEO Power"
          subtitle="76% of local searches lead to store visits"
          videoTitle="Dominate Local Search"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
        <ContentCard
          title="Language Strategy"
          lines={["Match customers' search language", "Less competition in non-English terms"]}
          badge={{ text: "Less competition in non-English terms", tone: "warning" }}
          videoTitle="Multi-Language SEO"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
        <ContentCard
          title="Location Guide"
          lines={["Map service areas", "Track new markets separately"]}
          badge={{ text: "Track new markets separately", tone: "warning" }}
          videoTitle="Location Optimization"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
      </div>
    </div>
  );

  const renderStep4Content = () => (
    <div className="space-y-6">
      <WebsiteStatsCard website={displayWebsite} stats={stats} />
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm flex items-center justify-center fixthis-badge">
          <span className="text-xs font-bold">!</span>
        </div>
        <h4 className="text-sm font-bold fixthis-title">FIX THIS</h4>
      </div>
      <div className="space-y-4">
        <ContentCard
          title="Keyword Fundamentals"
          subtitle="What keywords are & why they matter"
          videoTitle="Keyword Research 101"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
        <ContentCard
          title="Volume & Competition"
          lines={["Match industry volume & Competition", "100–1,000 searches = sweet spot"]}
          videoTitle="Low-Competition Keywords"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
        <ContentCard
          title="Customer Language"
          lines={["Think like your customers", "Use question-based & local phrases"]}
          videoTitle="Find the Language Your Customers Use"
          videoUrl={DEFAULT_VIDEO}
          poster="/assets/poster.png"
        />
      </div>

    </div>
  );

  const cleanLabel = (s) => (typeof s === "string" ? s.replace(/-\d+$/, "") : s);
  const {
    businessCompetitors = [],
    searchCompetitors = [],
    totalCompetitors = [],
  } = competitorData || {};

  const renderStep5Content = () => {
    return (
      <div className="space-y-6">
        <WebsiteStatsCard website={displayWebsite} stats={stats} />
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm flex items-center justify-center fixthis-badge">
            <span className="text-xs font-bold">!</span>
          </div>
          <h4 className="text-sm font-bold fixthis-title">FIX THIS</h4>
        </div>
        <div className="space-y-4">
          <ContentCard
            title="Business vs. Search Competitors"
            subtitle="Market vs. ranking competitors"
            videoTitle="Identify Your SEO Competition"
            videoUrl={DEFAULT_VIDEO}
            poster="/assets/poster.png"
          />

          <ContentCard
            title="Competitive Intelligence"
            lines={[
              "Strategy insights & gap analysis",
              "Analyze your competitors' strengths and gaps",
            ]}
            badge={{ text: "Analyse, Compare, Discover & Optimize.", tone: "warning" }}
            videoTitle="Spy on Competitors"
            videoUrl={DEFAULT_VIDEO}
            poster="/assets/poster.png"
          />

          <ContentCard
            title="How to Find Them?"
            subtitle="Ask customers & search your keywords"
            videoTitle="Find Your Competitors via SERPs"
            videoUrl={DEFAULT_VIDEO}
            poster="/assets/poster.png"
          />
        </div>
      </div>
    );
  };

  const renderStep5Slide2Content = renderStep5Content;

  /* -------------------- Render -------------------- */
  // Gradient background like the original, with desktop width fixed and sm/md taking remaining space.
  // Important: use lg:bg-[image:none] to override arbitrary bg-image at lg+.
  const basePos =
    "fixed top-0 h-screen z-40 flex flex-col " +
    "bg-[image:var(--brand-gradient)] bg-no-repeat bg-[size:100%_100%] " +
    "left-[56px] w-[calc(100vw-56px)] " +           // phones: remaining width beside 56px rail
    "md:left-[72px] md:w-[calc(100vw-72px)] " +     // tablets: beside 72px rail
    "lg:left-[80px] lg:w-[430px] lg:bg-[image:none]"; // desktop: original look (no gradient image)

  return (
    <>
      {/* keep dark overlay for dark theme */}
      <div
        className="hidden dark:block fixed inset-0 -z-10 pointer-events-none bg-no-repeat bg-cover"
        style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), var(--app-gradient-strong)" }}
      />
      <div
        ref={panelRef}
        aria-hidden={!isOpen}
        className={`${basePos} transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 pt-6 bg-transparent">
          <div className="flex items-center gap-3">
            <BarChart2 className="text-[#111827]" size={26} />
            <h3 className="text-xl font-black text-[#111827] dark:text-[var(--text)]">INFO</h3>
          </div>
          <button
            onClick={() => setIsPinned((p) => !p)}
            className="text-[#111827] hover:text-[#D45427] rounded font-bold dark:text-[var(--text)]"
            title={isPinned ? "Unpin panel" : "Pin panel"}
          >
            {isPinned ? <PinOff size={20} /> : <Pin size={20} />}
          </button>
        </div>
        <div className="place-items-center flex justify-center">
          <div className="divider-gradient-line h-[1px] w-[97.5%] bg-[image:var(--brand-gradient)] my-2 mb-0"></div>
        </div>

        {/* body */}
        <div
          className="flex-1 overflow-y-auto p-4 bg-transparent"
          style={{ height: "calc(100vh - 60px)", scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style jsx>{`div::-webkit-scrollbar{display:none}`}</style>

          {currentStep === 1
            ? renderStep1Content()
            : currentStep === 2
            ? renderStep2Content()
            : currentStep === 3
            ? renderStep3Content()
            : currentStep === 4
            ? renderStep4Content()
            : currentStep === 6
            ? renderStep5Slide2Content()
            : renderStep5Content()}
        </div>
      </div>

      {/* global modal for any top-level buttons (kept for future use) */}
      <VideoModal
        open={!!activeVideo}
        title={activeVideo?.title || ""}
        url={activeVideo?.url || DEFAULT_VIDEO}
        onClose={() => setActiveVideo(null)}
        onExpand={() => window.open(activeVideo?.url || DEFAULT_VIDEO, "_blank")}
      />
    </>
  );
}
