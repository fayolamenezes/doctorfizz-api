"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Languages,
  Tag,
  UsersRound,
} from "lucide-react";

/**
 * Props:
 * - onBack(): go to previous slide
 * - onDashboard(): open dashboard
 * - navigateToStep?(n: number)
 *
 * - businessData:   { industrySector/industry, offeringType/offering, specificService/category }
 * - languageLocationData: selections[] or flat fields
 * - keywordData:    string[] | {label: string}[]
 * - competitorData: { businessCompetitors: string[], searchCompetitors: string[] }
 */
export default function Step5Slide2({
  onBack,
  onDashboard,
  navigateToStep,
  websiteData,
  businessData,
  languageLocationData,
  keywordData = [],
  competitorData = null,
}) {
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'business' | 'language' | 'keywords' | 'competition'

  // ----- Fixed-height shell (consistent with other slides) ----------------------
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomBarRef = useRef(null);
  const loaderAnchorRef = useRef(null);
  const [panelHeight, setPanelHeight] = useState(null);
  const dashTimer = useRef(null);

  const recomputePanelHeight = () => {
    if (typeof window === "undefined" || !panelRef.current) return;
    const vpH = window.innerHeight;
    const barH = bottomBarRef.current?.getBoundingClientRect().height ?? 0;
    const topOffset = panelRef.current.getBoundingClientRect().top;
    const guard = 24;
    const h = Math.max(360, vpH - barH - topOffset - guard);
    setPanelHeight(h);
  };

  useEffect(() => {
    recomputePanelHeight();
    if (typeof window === "undefined") return;
    const ro = new ResizeObserver(recomputePanelHeight);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", recomputePanelHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputePanelHeight);
    };
  }, []);

  useEffect(() => {
    recomputePanelHeight();
  }, [loading]);

  // ----- Data shaping -----------------------------------------------------------
  const industry =
    businessData?.industrySector ??
    businessData?.industry ??
    "—";

  const offeringType =
    businessData?.offeringType ??
    businessData?.offering ??
    "—";

  const specificService =
    businessData?.specificService ??
    businessData?.category ??
    "—";

  const getStr = (x) =>
    typeof x === "string" ? x : (x && (x.label || x.name || x.title)) || undefined;

  const buildLocation = useCallback(({ city, state, country, location }) => {
    const loc = getStr(location);
    if (loc) return loc;
    const parts = [getStr(city), getStr(state) /*, getStr(country)*/].filter(Boolean);
    return parts.length ? parts.join(", ") : "";
  }, []);

  const langSel = useMemo(() => {
    const d = languageLocationData || {};
    const s =
      Array.isArray(d.selections) && d.selections.length ? d.selections[0] : d;

    const language =
      getStr(s?.language) ||
      getStr(d?.selectedLanguage) ||
      getStr(d?.language) ||
      "English";

    const location =
      buildLocation({
        city: s?.city ?? d?.selectedCity ?? d?.city,
        state: s?.state ?? d?.selectedState ?? d?.state,
        country: s?.country ?? d?.selectedCountry ?? d?.country,
        location: s?.location ?? d?.selectedLocation ?? d?.location,
      }) || "—";

    return { language, location };
  }, [languageLocationData, buildLocation]);

  const keywords = useMemo(() => {
    if (!keywordData) return [];
    return (Array.isArray(keywordData) ? keywordData : [])
      .map((k) => (typeof k === "string" ? k : k?.label))
      .filter(Boolean);
  }, [keywordData]);

  const businessCompetitors = Array.isArray(competitorData?.businessCompetitors)
    ? competitorData.businessCompetitors
    : [];
  const searchCompetitors = Array.isArray(competitorData?.searchCompetitors)
    ? competitorData.searchCompetitors
    : [];

  // ----- Jump to step helpers ---------------------------------------------------
  const goToStep = (section) => {
    const map = { business: 2, language: 3, keywords: 4, competition: 5 };
    const step = map[section];
    if (typeof navigateToStep === "function") {
      navigateToStep(step);
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wizard:navigate", { detail: { step } }));
    }
  };

  // ----- Loader scroll & dashboard transition ----------------------------------
  const scrollLoaderIntoView = () => {
    const tryScroll = () => {
      loaderAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    };
    tryScroll();
    requestAnimationFrame(tryScroll);
    setTimeout(tryScroll, 120);
  };

  const handleDashboard = () => {
    if (loading) return;
    setLoading(true);
    scrollLoaderIntoView();
    dashTimer.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("dashboard:open"));
      }
      onDashboard?.();
    }, 6000);
  };

  useEffect(() => {
    return () => clearTimeout(dashTimer.current);
  }, []);

  // ----- UI primitives ----------------------------------------------------------
  const CardShell = ({
    title,
    icon,
    children,
    onClick,
    isActive = false,
    ariaLabel,
  }) => (
    <div className="relative h-full">
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel || title}
        onClick={onClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.(e)}
        className={[
          "h-full flex flex-col rounded-2xl bg-[var(--input)] border shadow-sm focus:outline-none transition-colors",
          isActive
            ? "border-[#ff8a2a] ring-1 ring-[#ff8a2a]/40"
            : "border-[var(--border)]",
        ].join(" ")}
      >
        {/* header */}
        <div className="px-4 sm:px-5 md:px-6 pt-5 sm:pt-6 pb-3 flex items-center gap-2">
          <span className="text-[var(--muted)]">{icon}</span>
          <h3 className="text-[14px] md:text-base font-semibold text-[var(--text)]">
            {title}
          </h3>
        </div>
        <div className="border-t border-[var(--border)]/70" />
        {/* content grows to equalize heights */}
        <div className="px-4 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 flex-1">
          {children}
        </div>
      </div>

      {/* Absolutely positioned — doesn't change grid height */}
      {isActive && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-full text-center">
          <button
            onClick={() => goToStep(ariaLabel)}
            className="text-[13px] md:text-[14px] font-semibold text-[#ff8a2a] hover:opacity-90"
          >
            Edit ‘{title}’
          </button>
        </div>
      )}
    </div>
  );

  // Field: label above, value in a light box (like your mock)
  const Field = ({ label, value }) => (
    <div className="space-y-1.5">
      <div className="text-[13px] sm:text-[14px] md:text-[15px] font-medium opacity-80">
        {label}
      </div>
      <div className="rounded-xl bg-[var(--input)] px-4 py-2.5 text-[13px] sm:text-[14px] md:text-[15px] text-[var(--text)]">
        {value || "—"}
      </div>
    </div>
  );

  // Small bordered chip (used for keywords + competitors)
  const Chip = ({ children }) => (
    <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] sm:text-[13px] md:text-[14px]">
      {children}
    </span>
  );

  return (
    <div className="w-full h-full flex flex-col bg-transparent">
      {/* global utilities + loader/progress css */}
      <style jsx global>{`
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }

        .wave-loader { height: 46px; width: 46px; border-radius: 9999px; overflow: hidden;
          border: 2px solid #d45427; background: var(--input); position: relative; }
        .shine { position:absolute; top:2px; left:50%; transform:translateX(-50%); width:72%; height:26%;
          border-radius:0 0 9999px 9999px;
          background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.96), rgba(255,255,255,.2) 70%, transparent 80%);
          pointer-events:none; z-index:3; }
        .layer { position:absolute; inset:0; bottom:-2px; height:120%; transform:translateY(20%); }
        .seg { position:absolute; left:0; bottom:0; width:200%; height:140%; }
        .seg.clone { left:200%; }
        @keyframes drift { 0% { transform: translate(0, 20%); } 100% { transform: translate(-200%, 20%); } }
        .layer-back { opacity:.92; animation: drift 6.8s linear infinite; }
        .layer-front { opacity:.98; animation: drift 5.6s linear infinite; }

        .progress-wrap { position:relative; height:10px; width:100%; border-radius:9999px; background: var(--border); overflow:hidden; }
        .progress-track {
          position:absolute; inset:0;
          background: linear-gradient(90deg, #d45427 0%, #ffa615 100%);
          transform: translateX(-60%);
          animation: slide 2.2s cubic-bezier(.37,.01,.22,1) infinite;
        }
        @keyframes slide { 0% { transform: translateX(-60%); } 50% { transform: translateX(10%); } 100% { transform: translateX(120%); } }
        .progress-shine {
          position:absolute; top:0; bottom:0; width:30%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.65) 50%, transparent 100%);
          filter: blur(8px);
          animation: shine 1.6s linear infinite;
        }
      `}</style>

      {/* ---------------- Fixed-height content area ---------------- */}
      <div className="px-3 sm:px-4 md:px-6 pt-5 sm:pt-6">
        <div
          ref={panelRef}
          className="mx-auto w-full max-w-[1120px] rounded-2xl bg-transparent"
          style={{ padding: "0px 24px", height: panelHeight ? `${panelHeight}px` : "auto" }}
        >
          <div ref={scrollRef} className="no-scrollbar h-full w-full overflow-y-auto">
            <div className="max-w-[1120px] mx-auto pt-6 sm:pt-8">
              {/* Title */}
              <div className="text-center">
                <h1 className="text-[20px] sm:text-[24px] md:text-3xl lg:text-4xl font-bold text-[var(--text)]">
                  Great! You’re all done.
                </h1>
                <p className="mt-1.5 sm:mt-2 text-[12px] sm:text-[13px] md:text-base text-[var(--muted)]">
                  Here is your <span className="font-semibold">entire report</span> based on your input.
                </p>
              </div>

              {/* Grid: items-stretch to equalize card heights */}
              <div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 items-stretch pb-8">
                {/* Business Selected */}
                <CardShell
                  title="Business Selected"
                  icon={<BriefcaseBusiness size={18} />}
                  isActive={activeSection === "business"}
                  onClick={() => setActiveSection("business")}
                  ariaLabel="business"
                >
                  <div className="space-y-3">
                    <Field label="Industry Sector :" value={industry} />
                    <Field label="Offering Type :" value={offeringType} />
                    <Field label="Specific Service :" value={specificService} />
                  </div>
                </CardShell>

                {/* Language Selected */}
                <CardShell
                  title="Language Selected"
                  icon={<Languages size={18} />}
                  isActive={activeSection === "language"}
                  onClick={() => setActiveSection("language")}
                  ariaLabel="language"
                >
                  <div className="space-y-3">
                    <Field label="Language Selected" value={langSel.language} />
                    <Field label="Location Selected" value={langSel.location} />
                  </div>
                </CardShell>

                {/* Keyword Selected */}
                <CardShell
                  title="Keyword Selected"
                  icon={<Tag size={18} />}
                  isActive={activeSection === "keywords"}
                  onClick={() => setActiveSection("keywords")}
                  ariaLabel="keywords"
                >
                  <div className="grid grid-cols-1 gap-2">
                    {keywords.length ? (
                      keywords.map((k, i) => <Chip key={i}>{String(k)}</Chip>)
                    ) : (
                      <span className="text-[12px] sm:text-[13px] text-[var(--muted)]">
                        No keywords selected
                      </span>
                    )}
                  </div>
                </CardShell>

                {/* Competition */}
                <CardShell
                  title="Competition"
                  icon={<UsersRound size={18} />}
                  isActive={activeSection === "competition"}
                  onClick={() => setActiveSection("competition")}
                  ariaLabel="competition"
                >
                  <div className="space-y-5">
                    <div>
                      <div className="text-[11px] sm:text-[12px] tracking-wide font-semibold text-[var(--muted)]">
                        Business Competitors
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {businessCompetitors.length ? (
                          businessCompetitors.map((c, i) => <Chip key={`biz-${i}`}>{String(c)}</Chip>)
                        ) : (
                          <span className="text-[12px] sm:text-[13px] text-[var(--muted)]">None selected</span>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-[var(--border)]/70" />
                    <div>
                      <div className="text-[11px] sm:text-[12px] tracking-wide font-semibold text-[var(--muted)]">
                        Search Engine Competitors
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {searchCompetitors.length ? (
                          searchCompetitors.map((c, i) => <Chip key={`sea-${i}`}>{String(c)}</Chip>)
                        ) : (
                          <span className="text-[12px] sm:text-[13px] text-[var(--muted)]">None selected</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardShell>
              </div>

              {/* Instruction line */}
              <div className="mt-2 text-center text-[12px] sm:text-[13px] md:text-[14px] text-[var(--muted)]">
                All set? Click <span className="font-semibold">‘Dashboard’</span> to continue.
                <span className="mx-1" />
                <button
                  onClick={onBack}
                  className="underline hover:no-underline text-[var(--text)]"
                  type="button"
                >
                  Back
                </button>{" "}
                to edit input
              </div>

              {/* Anchor to scroll to when showing loader */}
              <div ref={loaderAnchorRef} className="mt-5 sm:mt-6" />

              {/* Loader (appears after Dashboard click) */}
              {loading && (
                <div className="mt-6 sm:mt-8 flex flex-col items-center">
                  <p className="text-[12px] sm:text-[13px] md:text-[14px] text-[var(--muted)]">Great things take time!</p>
                  <p className="text-[12px] sm:text-[13px] md:text-[14px] text-[var(--muted)]">
                    Preparing your <span className="font-semibold">Dashboard</span>.
                  </p>

                  {/* Wave */}
                  <div className="mt-5 sm:mt-6 scale-95 sm:scale-100">
                    <div className="wave-loader">
                      <div className="shine" />
                      <div className="layer layer-back">
                        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="seg">
                          <defs>
                            <linearGradient id="inkBack" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%">
                                <animate attributeName="stop-color" values="#d45427;#ffa615;#d45427" dur="6s" repeatCount="indefinite" />
                              </stop>
                              <stop offset="100%">
                                <animate attributeName="stop-color" values="#ffa615;#d45427;#ffa615" dur="6s" repeatCount="indefinite" />
                              </stop>
                            </linearGradient>
                          </defs>
                          <path d="M0 30 Q 25 22 50 30 T 100 30 T 150 30 T 200 30 V60 H0 Z" fill="url(#inkBack)" />
                        </svg>
                        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="seg clone">
                          <defs>
                            <linearGradient id="inkBack2" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%">
                                <animate attributeName="stop-color" values="#d45427;#ffa615;#d45427" dur="6s" repeatCount="indefinite" />
                              </stop>
                              <stop offset="100%">
                                <animate attributeName="stop-color" values="#ffa615;#d45427;#ffa615" dur="6s" repeatCount="indefinite" />
                              </stop>
                            </linearGradient>
                          </defs>
                          <path d="M0 30 Q 25 22 50 30 T 100 30 T 150 30 T 200 30 V60 H0 Z" fill="url(#inkBack2)" />
                        </svg>
                      </div>

                      <div className="layer layer-front">
                        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="seg">
                          <defs>
                            <linearGradient id="inkFront" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%">
                                <animate attributeName="stop-color" values="#ffa615;#d45427;#ffa615" dur="5s" repeatCount="indefinite" />
                              </stop>
                              <stop offset="100%">
                                <animate attributeName="stop-color" values="#d45427;#ffa615;#d45427" dur="5s" repeatCount="indefinite" />
                              </stop>
                            </linearGradient>
                          </defs>
                          <path d="M0 30 Q 25 18 50 30 T 100 30 T 150 30 T 200 30 V60 H0 Z" fill="url(#inkFront)" />
                        </svg>
                        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="seg clone">
                          <defs>
                            <linearGradient id="inkFront2" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%">
                                <animate attributeName="stop-color" values="#ffa615;#d45427;#ffa615" dur="5s" repeatCount="indefinite" />
                              </stop>
                              <stop offset="100%">
                                <animate attributeName="stop-color" values="#d45427;#ffa615;#d45427" dur="5s" repeatCount="indefinite" />
                              </stop>
                            </linearGradient>
                          </defs>
                          <path d="M0 30 Q 25 18 50 30 T 100 30 T 150 30 T 200 30 V60 H0 Z" fill="url(#inkFront2)" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-5 sm:mt-6 w-full max-w-[320px] sm:max-w-[420px] md:max-w-[560px]">
                    <div className="progress-wrap">
                      <div className="progress-track" />
                      <div className="progress-shine" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Bottom bar ---------------- */}
      <div ref={bottomBarRef} className="flex-shrink-0 bg-transparent">
        <div className="border-t border-[var(--border)]" />
        <div className="mx-auto w-full max-w-[1120px] px-3 sm:px-4 md:px-6">
          <div className="py-5 sm:py-6 md:py-7 flex justify-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--input)] px-5 sm:px-6 py-2.5 sm:py-3 text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] hover:bg-[var(--input)] shadow-sm border border-[#d45427]"
            >
              <ArrowLeft size={16} /> Back
            </button>
            {!loading && (
              <button
                onClick={handleDashboard}
                className="inline-flex items-center gap-2 rounded-full bg-[image:var(--infoHighlight-gradient)] px-6 sm:px-8 py-2.5 sm:py-3 text-white hover:opacity-90 shadow-sm text-[13px] md:text-[14px]"
              >
                Dashboard <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
