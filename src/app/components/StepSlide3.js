"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, ChevronDown } from "lucide-react";

export default function StepSlide3({ onNext, onBack, onLanguageLocationSubmit }) {
  // selections
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // UI state
  const [openDropdown, setOpenDropdown] = useState(null);

  // fixed height like Step1Slide1 / StepSlide2
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomBarRef = useRef(null);
  const tailRef = useRef(null); // <-- anchor for auto-scroll-to-bottom
  const [panelHeight, setPanelHeight] = useState(null);

  // submit guard
  const lastSubmittedData = useRef(null);

  // Lists (sample data; extend/replace with real lists)
  const languages = [
    "English","Spanish","French","German","Italian","Portuguese",
    "Chinese (Mandarin)","Japanese","Korean","Hindi","Bengali","Russian",
    "Arabic","Turkish","Vietnamese","Polish","Persian","Dutch","Thai"
  ];

  // Country → State → City map (demo)
  const geo = {
    India: {
      Karnataka: ["Bengaluru", "Mysuru"],
      Maharashtra: ["Mumbai", "Pune"],
      Delhi: ["New Delhi"],
    },
    "United States": {
      California: ["San Francisco", "Los Angeles"],
      "New York": ["New York City", "Buffalo"],
    },
    "United Kingdom": {
      England: ["London", "Manchester"],
      Scotland: ["Edinburgh", "Glasgow"],
    },
  };

  const countries = Object.keys(geo);
  const states = selectedCountry ? Object.keys(geo[selectedCountry] || {}) : [];
  const cities =
    selectedCountry && selectedState ? geo[selectedCountry]?.[selectedState] || [] : [];

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
  }, [selectedLanguage, selectedCountry, selectedState, selectedCity]);

  // show summary & enable Next only when all four chosen
  const selectionsComplete =
    !!(selectedLanguage && selectedCountry && selectedState && selectedCity);

  // submit to parent whenever selection changes
  useEffect(() => {
    const payload = {
      language: selectedLanguage || "",
      country: selectedCountry || "",
      state: selectedState || "",
      city: selectedCity || "",
    };
    const now = JSON.stringify(payload);
    if (now !== JSON.stringify(lastSubmittedData.current)) {
      lastSubmittedData.current = payload;
      onLanguageLocationSubmit?.(payload);
    }
  }, [selectedLanguage, selectedCountry, selectedState, selectedCity, onLanguageLocationSubmit]);

  /* ---------------- Auto-scroll to bottom (matches Step1/2 pattern) ---------------- */
  useEffect(() => {
    if (tailRef.current) {
      // wait a frame so new DOM has rendered/measured before scrolling
      requestAnimationFrame(() => {
        tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [
    selectedLanguage,
    selectedCountry,
    selectedState,
    selectedCity,
    openDropdown,         // optional: follow dropdown open/close
    selectionsComplete,   // ensures we scroll when the summary appears
  ]);

  /* ---------------- Handlers ---------------- */
  const handleNext = () => onNext?.();
  const handleBack = () => onBack?.();

  const handleDropdownToggle = (name, disabled) => {
    if (disabled) return;
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  // parent→child clears
  const onSelectLanguage = (l) => {
    setSelectedLanguage(l);
    setOpenDropdown(null);
  };
  const onSelectCountry = (c) => {
    setSelectedCountry(c);
    setSelectedState("");
    setSelectedCity("");
    setOpenDropdown(null);
  };
  const onSelectState = (s) => {
    setSelectedState(s);
    setSelectedCity("");
    setOpenDropdown(null);
  };
  const onSelectCity = (ct) => {
    setSelectedCity(ct);
    setOpenDropdown(null);
  };

  const handleReset = () => {
    setSelectedLanguage("");
    setSelectedCountry("");
    setSelectedState("");
    setSelectedCity("");
    lastSubmittedData.current = null;
  };

  // close dropdowns if clicked outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest(".dropdown-container")) setOpenDropdown(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // helpers
  const btnBase =
    "w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-4 py-2.5 sm:py-3 text-left flex items-center justify-between transition-colors";
  const labelCls = "text-[12px] sm:text-[13px] md:text-[14px]";
  const ddListCls =
    "absolute top-full left-0 right-0 bg-[var(--input)] border border-[var(--border)] rounded-lg mt-1 shadow-2xl max-h-56 overflow-y-auto z-20";

  return (
    <div className="w-full h-full flex flex-col bg-transparent slides-accent overflow-x-hidden">
      {/* ---------------- Fixed-height section ---------------- */}
      <div className="px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 md:pt-6">
        <div
          ref={panelRef}
          className="mx-auto w-full max-w-[1120px] rounded-2xl bg-transparent box-border"
          style={{ padding: "0px 24px", height: panelHeight ? `${panelHeight}px` : "auto" }}
        >
          {/* hide inner scrollbar cross-browser */}
          <style jsx>{`
            .inner-scroll { scrollbar-width: none; -ms-overflow-style: none; }
            .inner-scroll::-webkit-scrollbar { display: none; }
          `}</style>

          {/* Inner scrollable */}
          <div ref={scrollRef} className="inner-scroll h-full w-full overflow-y-auto">
            <div className="flex flex-col items-start text-start gap-5 sm:gap-6 md:gap-8 max-w-[820px] mx-auto">
              {/* Step label */}
              <div className="text-[11px] sm:text-[12px] md:text-[13px] text-[var(--muted)] font-medium">
                Step - 3
              </div>
              <div className="spacer-line w-[80%] self-start h-[1px] bg-[#d45427] mt-[-1%]" />

              {/* Heading & copy */}
              <div className="space-y-2.5 sm:space-y-3 max-w-[640px]">
                <h1 className="text-[16px] sm:text-[18px] md:text-[22px] lg:text-[26px] font-bold text-[var(--text)]">
                  Select the languages and locations relevant to your business
                </h1>
                <p className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--muted)] leading-relaxed">
                  Choose your language & business locations. Select at least one country to localise your analysis.
                </p>
              </div>

              {/* Four pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full max-w-[880px] relative pb-6">
                {/* Language */}
                <div
                  className="relative dropdown-container overflow-visible"
                  style={{ zIndex: openDropdown === "lang" ? 1000 : 1 }}
                >
                  <button
                    onClick={() => handleDropdownToggle("lang", false)}
                    type="button"
                    className={`${btnBase} hover:border-[var(--border)] focus:outline-none focus:border-[var(--border)]`}
                  >
                    <span className={`${selectedLanguage ? "text-[var(--text)]" : "text-[var(--muted)]"} ${labelCls}`}>
                      {selectedLanguage || "Select Language"}
                    </span>
                    <ChevronDown size={20} className={`transition-transform ${openDropdown === "lang" ? "rotate-180" : ""}`} />
                  </button>

                  {openDropdown === "lang" && (
                    <div className={ddListCls}>
                      {languages.map((l) => (
                        <button
                          key={l}
                          onClick={() => onSelectLanguage(l)}
                          type="button"
                          className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-[var(--menuHover)] focus:bg-[var(--menuFocus)] text-[var(--text)] text-[12px] sm:text-[13px] md:text-[14px] border-b border-[var(--border)] last:border-b-0 focus:outline-none transition-colors"
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Country */}
                <div
                  className="relative dropdown-container overflow-visible"
                  style={{ zIndex: openDropdown === "country" ? 1000 : 1 }}
                >
                  <button
                    onClick={() => handleDropdownToggle("country", !selectedLanguage)}
                    type="button"
                    disabled={!selectedLanguage}
                    className={`${btnBase} ${!selectedLanguage ? "opacity-60 cursor-not-allowed" : "hover:border-[var(--border)]"} focus:outline-none focus:border-[var(--border)]`}
                  >
                    <span className={`${selectedCountry ? "text-[var(--text)]" : "text-[var(--muted)]"} ${labelCls}`}>
                      {selectedCountry || "Select Country"}
                    </span>
                    <ChevronDown size={20} className={`transition-transform ${openDropdown === "country" ? "rotate-180" : ""}`} />
                  </button>

                  {openDropdown === "country" && (
                    <div className={ddListCls}>
                      {countries.map((c) => (
                        <button
                          key={c}
                          onClick={() => onSelectCountry(c)}
                          type="button"
                          className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-[var(--menuHover)] focus:bg-[var(--menuFocus)] text-[var(--text)] text-[12px] sm:text-[13px] md:text-[14px] border-b border-[var(--border)] last:border-b-0 focus:outline-none transition-colors"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* State */}
                <div
                  className="relative dropdown-container overflow-visible"
                  style={{ zIndex: openDropdown === "state" ? 1000 : 1 }}
                >
                  <button
                    onClick={() => handleDropdownToggle("state", !selectedCountry)}
                    type="button"
                    disabled={!selectedCountry}
                    className={`${btnBase} ${!selectedCountry ? "opacity-60 cursor-not-allowed" : "hover:border-[var(--border)]"} focus:outline-none focus:border-[var(--border)]`}
                  >
                    <span className={`${selectedState ? "text-[var(--text)]" : "text-[var(--muted)]"} ${labelCls}`}>
                      {selectedState || "Select State"}
                    </span>
                    <ChevronDown size={20} className={`transition-transform ${openDropdown === "state" ? "rotate-180" : ""}`} />
                  </button>

                  {openDropdown === "state" && (
                    <div className={ddListCls}>
                      {states.map((s) => (
                        <button
                          key={s}
                          onClick={() => onSelectState(s)}
                          type="button"
                          className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-[var(--menuHover)] focus:bg-[var(--menuFocus)] text-[var(--text)] text-[12px] sm:text-[13px] md:text-[14px] border-b border-[var(--border)] last:border-b-0 focus:outline-none transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* City */}
                <div
                  className="relative dropdown-container overflow-visible"
                  style={{ zIndex: openDropdown === "city" ? 1000 : 1 }}
                >
                  <button
                    onClick={() => handleDropdownToggle("city", !selectedState)}
                    type="button"
                    disabled={!selectedState}
                    className={`${btnBase} ${!selectedState ? "opacity-60 cursor-not-allowed" : "hover:border-[var(--border)]"} focus:outline-none focus:border-[var(--border)]`}
                  >
                    <span className={`${selectedCity ? "text-[var(--text)]" : "text-[var(--muted)]"} ${labelCls}`}>
                      {selectedCity || "Select City"}
                    </span>
                    <ChevronDown size={20} className={`transition-transform ${openDropdown === "city" ? "rotate-180" : ""}`} />
                  </button>

                  {openDropdown === "city" && (
                    <div className={ddListCls}>
                      {cities.map((ct) => (
                        <button
                          key={ct}
                          onClick={() => onSelectCity(ct)}
                          type="button"
                          className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-[var(--menuHover)] focus:bg-[var(--menuFocus)] text-[var(--text)] text-[12px] sm:text-[13px] md:text-[14px] border-b border-[var(--border)] last:border-b-0 focus:outline-none transition-colors"
                        >
                          {ct}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary BELOW the dropdowns, right-aligned */}
              {selectionsComplete && (
                <>
                  <div className="w-full flex justify-end">
                    <div className="bg-[var(--input)] max-w-[360px] w-full sm:w-auto rounded-2xl shadow-sm border border-[var(--border)] px-5 py-4 text-left">
                      <div className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--text)]">
                        <span className="font-semibold">Language :</span> {selectedLanguage}
                      </div>
                      <div className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--text)]">
                        <span className="font-semibold">Country :</span> {selectedCountry}
                      </div>
                      <div className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--text)]">
                        <span className="font-semibold">State :</span> {selectedState}
                      </div>
                      <div className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--text)]">
                        <span className="font-semibold">City :</span> {selectedCity}
                      </div>
                    </div>
                  </div>

                  {/* Confirmation text left-aligned below the card */}
                  <div className="mt-5 self-start">
                    <h3 className="text-[15px] sm:text-[16px] md:text-[18px] font-bold text-[var(--text)] mb-2.5 sm:mb-3">
                      Here’s your site report — take a quick look on the
                      <br /> Info Tab.
                    </h3>
                    <p className="text-[12px] sm:text-[13px] md:text-[15px] text-[var(--muted)]">
                      If not, Want to do some changes?
                    </p>
                    <div className="mt-3 text-[12px] sm:text-[13px]">
                      <button
                        onClick={handleReset}
                        className="text-gray-500 hover:text-gray-700 font-semibold"
                        type="button"
                      >
                        YES!
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="h-2" />
              <div ref={tailRef} /> {/* <-- tail element to anchor auto-scroll */}
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
              onClick={handleBack}
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--input)] px-5 sm:px-6 py-2.5 sm:py-3 text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] hover:bg-[var(--input)] shadow-sm border border-[#d45427]"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {selectionsComplete && (
              <button
                onClick={handleNext}
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
