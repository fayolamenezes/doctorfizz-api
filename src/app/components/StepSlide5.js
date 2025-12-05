// /mnt/data/StepSlide5.js
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, ArrowLeft, Plus, X, Check } from "lucide-react";

export default function StepSlide5({ onNext, onBack, onCompetitorSubmit }) {
  /* ---------------- State ---------------- */
  const [selectedBusinessCompetitors, setSelectedBusinessCompetitors] = useState([]);
  const [selectedSearchCompetitors, setSelectedSearchCompetitors] = useState([]);

  // Start EMPTY to avoid flicker; show skeletons while loading
  const [businessSuggestions, setBusinessSuggestions] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Inline “More → input”
  const [addingBusiness, setAddingBusiness] = useState(false);
  const [addingSearch, setAddingSearch] = useState(false);
  const [bizInput, setBizInput] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [showSummary, setShowSummary] = useState(false);

  // Fixed-height shell (match other steps)
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomBarRef = useRef(null);
  const tailRef = useRef(null); // <-- anchor for auto-scroll-to-bottom
  const [panelHeight, setPanelHeight] = useState(null);

  const lastSubmittedData = useRef(null);

  /* ---------------- Utilities ---------------- */
  const normalizeHost = useCallback((input) => {
    if (!input || typeof input !== "string") return null;
    let s = input.trim().toLowerCase();
    try {
      if (!/^https?:\/\//.test(s)) s = `https://${s}`;
      const u = new URL(s);
      s = u.hostname || s;
    } catch {
      s = s.replace(/^https?:\/\//, "").split("/")[0];
    }
    return s.replace(/^www\./, "");
  }, []);

  const getStoredSite = useCallback(() => {
    const keys = ["websiteData", "site", "website", "selectedWebsite", "drfizzm.site", "drfizzm.website"];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k) ?? sessionStorage.getItem(k);
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          const val = obj?.website || obj?.site || obj?.domain || obj?.host || raw;
          const host = normalizeHost(val);
          if (host) return host;
        } catch {
          const host = normalizeHost(raw);
          if (host) return host;
        }
      } catch {}
    }
    return null;
  }, [normalizeHost]);

  const getTargetSite = useCallback(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromParam = normalizeHost(params.get("site"));
      if (fromParam) return fromParam;
    } catch {}
    const fromStorage = getStoredSite();
    if (fromStorage) return fromStorage;
    return "example.com";
  }, [normalizeHost, getStoredSite]);

  const extractCompetitors = useCallback((row) => {
    const biz = [];
    const ser = [];
    for (let i = 1; i <= 6; i++) {
      const v = row?.[`Business_Competitor_${i}`];
      if (typeof v === "string" && v.trim()) biz.push(v.trim());
    }
    for (let i = 1; i <= 6; i++) {
      const v = row?.[`Search_Competitor_${i}`];
      if (typeof v === "string" && v.trim()) ser.push(v.trim());
    }
    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter((x) => {
        const k = x.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };
    return { biz: dedup(biz).slice(0, 8), ser: dedup(ser).slice(0, 8) };
  }, []);

  /* ---------------- Load suggestions for the chosen site ---------------- */
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const target = getTargetSite();
        const res = await fetch("/data/seo-data.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load seo-data.json (${res.status})`);
        const rows = await res.json();
        const host = normalizeHost(target);
        const variants = host ? [host, `www.${host}`] : [];

        const match = rows.find((r) => {
          const d1 = normalizeHost(r?.Domain);
          const d2 = normalizeHost(r?.["Domain/Website"]);
          return (d1 && variants.includes(d1)) || (d2 && variants.includes(d2));
        });

        const { biz, ser } = extractCompetitors(match || {});
        const bizFinal = (biz.length ? biz : ["Comp-1", "Comp-2", "Comp-3", "Comp-4"]).concat("More");
        const serFinal = (ser.length ? ser : ["Comp-1", "Comp-2", "Comp-3", "Comp-4"]).concat("More");

        if (isMounted) {
          setBusinessSuggestions(bizFinal);
          setSearchSuggestions(serFinal);
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(err?.message || "Failed to load competitor data");
          setBusinessSuggestions(["Comp-1", "Comp-2", "Comp-3", "Comp-4", "More"]);
          setSearchSuggestions(["Comp-1", "Comp-2", "Comp-3", "Comp-4", "More"]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [getTargetSite, normalizeHost, extractCompetitors]);

  /* ---------------- Fixed panel height ---------------- */
  const recomputePanelHeight = () => {
    if (!panelRef.current) return;
    const vpH = window.innerHeight;
    const barH = bottomBarRef.current?.getBoundingClientRect().height ?? 0;
    const topOffset = panelRef.current.getBoundingClientRect().top;
    const paddingGuard = 24;
    const h = Math.max(360, vpH - barH - topOffset - paddingGuard);
    setPanelHeight(h);
  };

  useEffect(() => {
    recomputePanelHeight();
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
  }, [
    showSummary,
    selectedBusinessCompetitors.length,
    selectedSearchCompetitors.length,
    addingBusiness,
    addingSearch,
  ]);

  /* ---------------- Handlers ---------------- */
  const toggleBusiness = (label) => {
    if (label === "More" && isLoading) return;
    if (label === "More") {
      setAddingBusiness(true);
      setTimeout(() => document.getElementById("biz-more-input")?.focus(), 50);
      return;
    }
    setSelectedBusinessCompetitors((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const toggleSearch = (label) => {
    if (label === "More" && isLoading) return;
    if (label === "More") {
      setAddingSearch(true);
      setTimeout(() => document.getElementById("search-more-input")?.focus(), 50);
      return;
    }
    setSelectedSearchCompetitors((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const addCustomBusiness = () => {
    const v = bizInput.trim();
    if (v && !selectedBusinessCompetitors.includes(v)) {
      setSelectedBusinessCompetitors((prev) => [...prev, v]);
    }
    setBizInput("");
    setTimeout(() => document.getElementById("biz-more-input")?.focus(), 50);
  };

  const addCustomSearch = () => {
    const v = searchInput.trim();
    if (v && !selectedSearchCompetitors.includes(v)) {
      setSelectedSearchCompetitors((prev) => [...prev, v]);
    }
    setSearchInput("");
    setTimeout(() => document.getElementById("search-more-input")?.focus(), 50);
  };

  /* ---------------- Submit + Summary toggle ---------------- */
  useEffect(() => {
    const totalSelected =
      selectedBusinessCompetitors.length + selectedSearchCompetitors.length;

    if (totalSelected > 0) {
      const payload = {
        businessCompetitors: selectedBusinessCompetitors,
        searchCompetitors: selectedSearchCompetitors,
        totalCompetitors: [
          ...selectedBusinessCompetitors,
          ...selectedSearchCompetitors,
        ],
      };
      const curr = JSON.stringify(payload);
      if (curr !== JSON.stringify(lastSubmittedData.current)) {
        lastSubmittedData.current = payload;
        onCompetitorSubmit?.(payload);
      }
      setShowSummary(true);
    } else {
      setShowSummary(false);
      onCompetitorSubmit?.({
        businessCompetitors: [],
        searchCompetitors: [],
        totalCompetitors: [],
      });
    }
  }, [selectedBusinessCompetitors, selectedSearchCompetitors, onCompetitorSubmit]);

  /* ---------------- Auto-scroll to bottom (align with StepSlide3/4 pattern) ---------------- */
  useEffect(() => {
    if (tailRef.current) {
      // wait a frame so any new DOM (chips/summary/inputs) is rendered before scrolling
      requestAnimationFrame(() => {
        tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [
    showSummary,                             // when the summary appears
    selectedBusinessCompetitors.length,      // as chips are added/removed
    selectedSearchCompetitors.length,
    addingBusiness,                          // when inline inputs open/close
    addingSearch,
    isLoading,                               // after suggestions finish loading
  ]);

  /* ---------------- Reusable chip renderer (uses global .keyword-chip) ---------------- */
  const Chip = ({ label, isSelected, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      aria-pressed={isSelected}
      className={`keyword-chip group inline-flex items-center justify-between mx-1 px-3.5 sm:px-4 py-2.5 min-h-[34px] sm:min-h-[36px] text-[11px] sm:text-[12px] md:text-[13px] leading-normal gap-1 ${
        isSelected ? "active" : ""
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <span className="truncate max-w-[150px] sm:max-w-[180px] md:max-w-none">
        {label}
      </span>

      {label !== "More" && (
        <>
          {!isSelected && <Plus size={16} className="ml-1 flex-shrink-0" />}
          {isSelected && (
            <span className="relative ml-1 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
              <Check
                size={16}
                className="absolute opacity-100 group-hover:opacity-0 transition-opacity duration-150"
                style={{ color: "#d45427" }}
              />
              <X
                size={16}
                className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ color: "#d45427" }}
              />
            </span>
          )}
        </>
      )}
    </button>
  );

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full h-full flex flex-col bg-transparent overflow-x-hidden">
      <div className="px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 md:pt-6">
        <div
          ref={panelRef}
          className="mx-auto w-full max-w-[1120px] rounded-2xl bg-transparent box-border"
          style={{ padding: "0px 24px", height: panelHeight ? `${panelHeight}px` : "auto" }}
        >
          <style jsx>{`
            .inner-scroll { scrollbar-width: none; -ms-overflow-style: none; }
            .inner-scroll::-webkit-scrollbar { display: none; }
            .chip-skel {
              display: inline-block;
              border-radius: 0.75rem;
              height: 36px;
              width: 88px;
              background: var(--border);
              animation: pulse 1.2s ease-in-out infinite;
            }
            @media (max-width: 640px) {
              .chip-skel {
                height: 32px;
                width: 72px;
              }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
          `}</style>

          <div ref={scrollRef} className="inner-scroll h-full w-full overflow-y-auto">
            <div className="flex flex-col items-start text-start gap-5 sm:gap-6 md:gap-8 max-w-[820px] mx-auto">
              {/* Step label */}
              <div className="text-[11px] sm:text-[12px] md:text-[13px] text-[var(--muted)] font-medium">
                Step - 5
              </div>
              <div className="spacer-line w-[80%] self-start h-[1px] bg-[#d45427] mt-[-1%]" />

              {/* Heading */}
              <div className="space-y-2.5 sm:space-y-3 max-w-[640px]">
                <h1 className="text-[16px] sm:text-[18px] md:text-[22px] lg:text-[26px] font-bold text-[var(--text)]">
                  Pick your competitors to compare.
                </h1>
                <p className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--muted)] leading-relaxed">
                  {isLoading
                    ? "Scanning your site…"
                    : loadError
                    ? "Showing starter suggestions (we'll refine once data is available)."
                    : "I scanned your site and found these competitors."}
                </p>
              </div>

              {/* BUSINESS SECTION */}
              <div className="w-full max-w-[880px] text-left space-y-3 sm:space-y-4">
                <h3 className="text-[13px] sm:text-[14px] md:text-[15px] font-medium text-[var(--text)]">
                  Business Competitors
                </h3>

                <div className="flex flex-wrap justify-start gap-2 sm:gap-2.5 md:gap-3 items-center -mx-1">
                  {isLoading && businessSuggestions.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <span key={`biz-skel-${i}`} className="chip-skel mx-1" />
                      ))
                    : businessSuggestions.map((label) => {
                        const isSelected = selectedBusinessCompetitors.includes(label);

                        if (label === "More" && addingBusiness) {
                          return (
                            <div
                              key="biz-inline-input"
                              className="flex flex-wrap items-center gap-2 mx-1 w-full sm:w-auto"
                            >
                              <input
                                id="biz-more-input"
                                value={bizInput}
                                onChange={(e) => setBizInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") addCustomBusiness(); }}
                                placeholder="Add business competitor"
                                className="w-full sm:w-[240px] px-3 sm:px-4 py-2 border border-[#d45427] rounded-xl bg-[var(--input)] text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#d45427]"
                              />
                              <button
                                onClick={addCustomBusiness}
                                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-[image:var(--infoHighlight-gradient)] text-white rounded-xl hover:opacity-90"
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                onClick={() => { setAddingBusiness(false); setBizInput(""); }}
                                className="px-2 py-2 text-[var(--muted)] hover:text-red-500 rounded-xl"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <Chip
                            key={`biz-${label}`}
                            label={label}
                            isSelected={isSelected}
                            onClick={() => toggleBusiness(label)}
                            disabled={isLoading && label === "More"}
                          />
                        );
                      })}
                </div>
              </div>

              {/* SEARCH SECTION */}
              <div className="w-full max-w-[880px] text-left space-y-3 sm:space-y-4">
                <h3 className="text-[13px] sm:text-[14px] md:text-[15px] font-medium text-[var(--text)]">
                  Search Engine Competitors
                </h3>

                <div className="flex flex-wrap justify-start gap-2 sm:gap-2.5 md:gap-3 items-center -mx-1">
                  {isLoading && searchSuggestions.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <span key={`ser-skel-${i}`} className="chip-skel mx-1" />
                      ))
                    : searchSuggestions.map((label) => {
                        const isSelected = selectedSearchCompetitors.includes(label);

                        if (label === "More" && addingSearch) {
                          return (
                            <div
                              key="search-inline-input"
                              className="flex flex-wrap items-center gap-2 mx-1 w-full sm:w-auto"
                            >
                              <input
                                id="search-more-input"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") addCustomSearch(); }}
                                placeholder="Add search competitor"
                                className="w-full sm:w-[240px] px-3 sm:px-4 py-2 border border-[#d45427] rounded-xl bg-[var(--input)] text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#d45427]"
                              />
                              <button
                                onClick={addCustomSearch}
                                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-[image:var(--infoHighlight-gradient)] text-white rounded-xl hover:opacity-90"
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                onClick={() => { setAddingSearch(false); setSearchInput(""); }}
                                className="px-2 py-2 text-[var(--muted)] hover:text-red-500 rounded-xl"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <Chip
                            key={`search-${label}`}
                            label={label}
                            isSelected={isSelected}
                            onClick={() => toggleSearch(label)}
                            disabled={isLoading && label === "More"}
                          />
                        );
                      })}
                </div>
              </div>

              {/* Summary copy (same as Step 4) */}
              {showSummary && (
                <div className="max-w-[640px] text-left self-start mt-5 sm:mt-6">
                  <h3 className="text-[15px] sm:text-[16px] md:text-[18px] font-bold text-[var(--text)] mb-2.5 sm:mb-3">
                    Here’s your site report — take a quick look on
                    <br />
                    the Info Tab.
                  </h3>
                  <p className="text-[12px] sm:text-[13px] md:text-[15px] text-[var(--muted)]">
                    You can always view more information in Info Tab
                  </p>
                </div>
              )}

              <div className="h-2" />
              <div ref={tailRef} /> {/* <-- tail element to anchor auto-scroll */}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar (same rhythm as other steps) */}
      <div ref={bottomBarRef} className="flex-shrink-0 bg-transparent">
        <div className="border-t border-[var(--border)]" />
        <div className="mx-auto w-full max-w-[1120px] px-3 sm:px-4 md:px-6">
          <div className="py-5 sm:py-6 md:py-7 flex justify-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--input)] px-5 sm:px-6 py-2.5 sm:py-3 text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] hover:bg-[var(--input)] shadow-sm border border-[#d45427]"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {showSummary && (
              <button
                onClick={onNext}
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-[image:var(--infoHighlight-gradient)] px-5 sm:px-6 py-2.5 sm:py-3 text-white hover:opacity-90 shadow-sm text-[13px] md:text-[14px]"
              >
                Next <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
