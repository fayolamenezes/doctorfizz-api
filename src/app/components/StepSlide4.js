"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, ArrowLeft, Plus, X, Check } from "lucide-react";

export default function StepSlide4({ onNext, onBack, onKeywordSubmit }) {
  /* ---------------- State ---------------- */
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [customKeyword, setCustomKeyword] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const [suggestedKeywords, setSuggestedKeywords] = useState([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [showInlineMoreInput, setShowInlineMoreInput] = useState(false);
  const moreInputRef = useRef(null);

  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomBarRef = useRef(null);
  const tailRef = useRef(null);
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
    const keys = [
      "websiteData",
      "site",
      "website",
      "selectedWebsite",
      "drfizzm.site",
      "drfizzm.website",
    ];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k) ?? sessionStorage.getItem(k);
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          const val =
            obj?.website || obj?.site || obj?.domain || obj?.host || raw;
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
    const stored = getStoredSite();
    if (stored) return stored;
    return "example.com";
  }, [normalizeHost, getStoredSite]);

  /* ---------------- Load keywords via Serper-backed API ---------------- */
  useEffect(() => {
    let active = true;

    async function loadKeywords() {
      setIsLoadingKeywords(true);
      setLoadError(null);

      try {
        const domain = getTargetSite();

        const res = await fetch("/api/keywords/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        });

        if (!res.ok) throw new Error(`Keyword API failed (${res.status})`);

        const data = await res.json();
        let kw = Array.isArray(data.keywords) ? data.keywords : [];

        // dedupe + trim to 8 suggestions
        const seen = new Set();
        kw = kw
          .map((k) => (k || "").toString().trim())
          .filter((k) => {
            if (!k) return false;
            const key = k.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8);

        const final =
          kw.length > 0
            ? kw.concat("More")
            : [
                "Keyword 1",
                "Keyword 2",
                "Keyword 3",
                "Keyword 4",
                "Keyword 5",
                "Keyword 6",
                "Keyword 7",
                "Keyword 8",
                "More",
              ];

        if (active) setSuggestedKeywords(final);
      } catch (err) {
        if (active) {
          setLoadError(err?.message || "Failed to fetch keywords");
          setSuggestedKeywords([
            "Keyword 1",
            "Keyword 2",
            "Keyword 3",
            "Keyword 4",
            "Keyword 5",
            "Keyword 6",
            "Keyword 7",
            "Keyword 8",
            "More",
          ]);
        }
      } finally {
        if (active) setIsLoadingKeywords(false);
      }
    }

    loadKeywords();
    return () => {
      active = false;
    };
  }, [getTargetSite]);

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
  }, [showSummary, selectedKeywords.length, showInlineMoreInput]);

  /* ---------------- Keyword handlers ---------------- */
  const handleKeywordToggle = (keyword) => {
    if (isLoadingKeywords && keyword === "More") return;

    if (keyword === "More") {
      setShowInlineMoreInput(true);
      setTimeout(() => moreInputRef.current?.focus(), 50);
      return;
    }

    setSelectedKeywords((prev) =>
      prev.includes(keyword)
        ? prev.filter((k) => k !== keyword)
        : [...prev, keyword]
    );
  };

  const handleAddCustom = () => {
    const trimmed = customKeyword.trim();
    if (trimmed && !selectedKeywords.includes(trimmed)) {
      setSelectedKeywords((prev) => [...prev, trimmed]);
      setCustomKeyword("");
      setTimeout(() => moreInputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustom();
    }
  };

  const handleReset = () => {
    setSelectedKeywords([]);
    setCustomKeyword("");
    setShowInlineMoreInput(false);
    lastSubmittedData.current = null;
    setShowSummary(false);
  };

  /* ---------------- Submit to parent + summary toggle ---------------- */
  useEffect(() => {
    if (selectedKeywords.length > 0) {
      const payload = { keywords: selectedKeywords };
      const curr = JSON.stringify(payload);

      if (curr !== JSON.stringify(lastSubmittedData.current)) {
        lastSubmittedData.current = payload;
        onKeywordSubmit?.(payload);
      }

      setShowSummary(true);
    } else {
      setShowSummary(false);
      onKeywordSubmit?.({ keywords: [] });
    }
  }, [selectedKeywords, onKeywordSubmit]);

  /* ---------------- Auto-scroll to bottom ---------------- */
  useEffect(() => {
    if (tailRef.current) {
      requestAnimationFrame(() => {
        tailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    }
  }, [
    showSummary,
    selectedKeywords.length,
    showInlineMoreInput,
    isLoadingKeywords,
  ]);

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full h-full flex flex-col bg-transparent overflow-x-hidden">
      {/* Fixed-height section */}
      <div className="px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 md:pt-6">
        <div
          ref={panelRef}
          className="mx-auto w-full max-w-[1120px] rounded-2xl bg-transparent box-border"
          style={{
            padding: "0px 24px",
            height: panelHeight ? `${panelHeight}px` : "auto",
          }}
        >
          <style jsx>{`
            .inner-scroll {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .inner-scroll::-webkit-scrollbar {
              display: none;
            }
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
              0%,
              100% {
                opacity: 0.6;
              }
              50% {
                opacity: 1;
              }
            }
          `}</style>

          <div
            ref={scrollRef}
            className="inner-scroll h-full w-full overflow-y-auto"
          >
            <div className="flex flex-col items-start text-start gap-5 sm:gap-6 md:gap-8 max-w-[820px] mx-auto">
              {/* Step label */}
              <div className="text-[11px] sm:text-[12px] md:text-[13px] text-[var(--muted)] font-medium">
                Step - 4
              </div>

              <div className="spacer-line w-[80%] self-start h-[1px] bg-[#d45427] mt-[-1%]" />

              {/* Heading */}
              <div className="space-y-2.5 sm:space-y-3 max-w-[640px]">
                <h1 className="text-[16px] sm:text-[18px] md:text-[22px] lg:text-[26px] font-bold text-[var(--text)]">
                  Unlock high-impact keywords.
                </h1>

                <p className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--muted)] leading-relaxed">
                  {isLoadingKeywords
                    ? "Scanning your site…"
                    : loadError
                    ? "Showing starter suggestions (we'll refine once data is available)."
                    : "I scanned your site and found these gems."}
                </p>
              </div>

              {/* Keyword suggestions */}
              <div className="w-full max-w-[880px] space-y-5 sm:space-y-6">
                <div className="flex flex-wrap justify-start gap-2 sm:gap-2.5 md:gap-3 -mx-1">
                  {/* Skeletons */}
                  {isLoadingKeywords &&
                    suggestedKeywords.length === 0 &&
                    Array.from({ length: 8 }).map((_, i) => (
                      <span key={`skel-${i}`} className="chip-skel mx-1" />
                    ))}

                  {/* Real chips */}
                  {!isLoadingKeywords &&
                    suggestedKeywords.map((keyword) => {
                      const isSelected = selectedKeywords.includes(keyword);

                      if (keyword === "More" && showInlineMoreInput) {
                        return (
                          <div
                            key="more-input"
                            className="flex flex-wrap items-center gap-2 mx-1 w-full sm:w-auto"
                          >
                            <input
                              ref={moreInputRef}
                              type="text"
                              placeholder="Add your own keyword"
                              value={customKeyword}
                              onChange={(e) =>
                                setCustomKeyword(e.target.value)
                              }
                              onKeyDown={handleKeyDown}
                              className="w-full sm:w-[220px] px-3 sm:px-4 py-2 border border-[#d45427] rounded-xl bg-[var(--input)] text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#d45427]"
                            />
                            <button
                              onClick={handleAddCustom}
                              disabled={!customKeyword.trim()}
                              type="button"
                              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-[image:var(--infoHighlight-gradient)] text-white rounded-xl hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed transition-opacity duration-200"
                              aria-label="Add custom keyword"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={keyword}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleKeywordToggle(keyword)}
                          className={`keyword-chip group inline-flex items-center justify-between mx-1 px-3.5 sm:px-4 py-2.5 min-h-[34px] sm:min-h-[36px] text-[11px] sm:text-[12px] md:text-[13px] leading-normal ${
                            isSelected ? "active" : ""
                          }`}
                        >
                          <span className="truncate max-w-[150px] sm:max-w-[180px] md:max-w-none">
                            {keyword}
                          </span>

                          {keyword !== "More" && (
                            <>
                              {!isSelected && (
                                <Plus
                                  size={16}
                                  className="ml-1 flex-shrink-0"
                                />
                              )}
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
                    })}
                </div>
              </div>

              {/* Summary */}
              {showSummary && (
                <div className="max-w=[640px] text-left self-start mt-5 sm:mt-6">
                  <h3 className="text-[15px] sm:text-[16px] md:text-[18px] font-bold text=[var(--text)] mb-2.5 sm:mb-3">
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
              <div ref={tailRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
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