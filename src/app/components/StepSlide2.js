"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, ChevronDown } from "lucide-react";

export default function StepSlide2({ onNext, onBack, onBusinessDataSubmit }) {
  // selections
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedOffering, setSelectedOffering] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [customCategory, setCustomCategory] = useState("");

  // UI state
  const [showSummary, setShowSummary] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  // fixed height like Step1Slide1
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomBarRef = useRef(null);
  const tailRef = useRef(null); // <-- anchor for auto-scroll-to-bottom
  const [panelHeight, setPanelHeight] = useState(null);

  // remember last submitted payload
  const lastSubmittedData = useRef(null);

  const industries = [
    "Technology & Software",
    "Healthcare & Medical",
    "Retail & E-commerce",
    "Professional Services",
    "Food & Beverage",
    "Fashion & Apparel",
    "Others",
  ];

  const offerings = [
    "Services",
    "Products",
    "Digital/Software",
    "Hybrid - Multiple Types",
  ];

  const categories = [
    "Consulting & Advisory",
    "Marketing & Advertising",
    "Design & Creative",
    "Technology & IT Services",
    "Financial & Accounting",
    "Legal Services",
    "Others",
  ];

  /* ---------------- Fixed panel height (Step1 pattern) ---------------- */
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
  }, [showSummary, selectedIndustry, selectedOffering, selectedCategory]);

  /* ---------------- Submission / summary toggle ---------------- */
  useEffect(() => {
    if (selectedIndustry && selectedOffering && selectedCategory) {
      const industryValue =
        selectedIndustry === "Others" ? customIndustry : selectedIndustry;
      const categoryValue =
        selectedCategory === "Others" ? customCategory : selectedCategory;

      if (industryValue && categoryValue) {
        setShowSummary(true);
        const newData = {
          industry: industryValue,
          offering: selectedOffering,
          category: categoryValue,
        };
        const dataString = JSON.stringify(newData);
        const lastDataString = JSON.stringify(lastSubmittedData.current);
        if (dataString !== lastDataString && onBusinessDataSubmit) {
          lastSubmittedData.current = newData;
          onBusinessDataSubmit(newData);
        }
      } else {
        setShowSummary(false);
      }
    } else {
      setShowSummary(false);
    }
  }, [
    selectedIndustry,
    selectedOffering,
    selectedCategory,
    customIndustry,
    customCategory,
    onBusinessDataSubmit,
  ]);

  /* ---------------- Auto-scroll to bottom (matches Step1Slide1 intent) ---------------- */
  useEffect(() => {
    // Always scroll to the tail after content/summary changes.
    if (tailRef.current) {
      // wait one frame so the DOM has measured/rendered the new content
      requestAnimationFrame(() => {
        tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [
    selectedIndustry,
    selectedOffering,
    selectedCategory,
    customIndustry,
    customCategory,
    showSummary,
    openDropdown, // also scroll as dropdowns open/close (optional, feels nice)
  ]);

  /* ---------------- Handlers ---------------- */
  const handleNext = () => onNext?.();
  const handleBack = () => onBack?.();
  const handleDropdownToggle = (name) =>
    setOpenDropdown((prev) => (prev === name ? null : name));

  const handleIndustrySelect = (industry) => {
    setSelectedIndustry(industry);
    setSelectedOffering("");
    setSelectedCategory("");
    setCustomIndustry("");
    setOpenDropdown(null);
  };
  const handleOfferingSelect = (offering) => {
    setSelectedOffering(offering);
    setSelectedCategory("");
    setOpenDropdown(null);
  };
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setCustomCategory("");
    setOpenDropdown(null);
  };

  const handleResetSelections = () => {
    setSelectedIndustry("");
    setSelectedOffering("");
    setSelectedCategory("");
    setCustomIndustry("");
    setCustomCategory("");
    lastSubmittedData.current = null;
    setShowSummary(false);
  };

  // close dropdowns on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest(".dropdown-container")) setOpenDropdown(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-transparent slides-accent overflow-x-hidden">
      {/* ---------------- Content Section ---------------- */}
      <div className="px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 md:pt-6">
        <div
          ref={panelRef}
          className="mx-auto w-full max-w-[1120px] rounded-2xl bg-transparent box-border"
          style={{
            padding: "0px 24px",
            height: panelHeight ? `${panelHeight}px` : "auto",
          }}
        >
          {/* Hide scrollbars for inner area */}
          <style jsx>{`
            .inner-scroll {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .inner-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* Inner scrollable area */}
          <div
            ref={scrollRef}
            className="inner-scroll h-full w-full overflow-y-auto"
          >
            <div className="flex flex-col items-start text-start gap-5 sm:gap-6 md:gap-8 max-w-[820px] mx-auto">
              {/* Step label */}
              <div className="text-[11px] sm:text-[12px] md:text-[13px] text-[var(--muted)] font-medium">
                Step - 2
              </div>
              <div className="spacer-line w-[80%] self-start h-[1px] bg-[#d45427] mt-[-1%]" />

              {/* Heading + copy */}
              <div className="space-y-2.5 sm:space-y-3 max-w-[640px]">
                <h1 className="text-[16px] sm:text-[18px] md:text-[22px] lg:text-[26px] font-bold text-[var(--text)]">
                  Tell us about your business
                </h1>
                <p className="text-[13px] sm:text-[14px] md:text-[15px] text-[var(--muted)] leading-relaxed">
                  Pick the closest category that best describes your business.
                  This tailors benchmarks and keyword ideas.
                </p>
              </div>

              {/* Summary (when all selected) */}
              {showSummary && (
                <div className="bg-[var(--input)] max-w-[360px] w-full rounded-2xl shadow-sm border border-[var(--border)] px-4 sm:px-5 md:px-6 py-3 sm:py-4 my-1 text-left self-end">
                  <div className="space-y-2 text-[13px] sm:text-[14px] md:text-[15px]">
                    <div className="text-[var(--text)]">
                      <span className="font-semibold">Industry Sector:</span>{" "}
                      {selectedIndustry === "Others"
                        ? customIndustry
                        : selectedIndustry}
                    </div>
                    <div className="text-[var(--text)]">
                      <span className="font-semibold">Offering Type:</span>{" "}
                      {selectedOffering}
                    </div>
                    <div className="text-[var(--text)]">
                      <span className="font-semibold">Category:</span>{" "}
                      {selectedCategory === "Others"
                        ? customCategory
                        : selectedCategory}
                    </div>
                  </div>
                </div>
              )}

              {/* Dropdown grid */}
              {!showSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full max-w-[880px] relative pb-10 sm:pb-12 lg:pb-0">
                  {/* Industry */}
                  <div
                    className="relative dropdown-container overflow-visible"
                    style={{ zIndex: openDropdown === "industry" ? 1000 : 1 }}
                  >
                    <button
                      onClick={() => handleDropdownToggle("industry")}
                      type="button"
                      className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-4 py-2.5 sm:py-3 text-left flex items-center justify-between hover:border-[var(--border)] focus:outline-none focus:border-[var(--border)] transition-colors"
                    >
                      <span
                        className={`${
                          selectedIndustry
                            ? "text-[var(--text)]"
                            : "text-[var(--muted)]"
                        } text-[12px] sm:text-[13px] md:text-[14px]`}
                      >
                        {selectedIndustry || "Industry Sector"}
                      </span>
                      <ChevronDown
                        size={20}
                        className={`transition-transform ${
                          openDropdown === "industry" ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {openDropdown === "industry" && (
                      <div
                        className="absolute top-full left-0 right-0 bg-[var(--input)] border border-[var(--border)] rounded-lg mt-1 shadow-2xl max-h-56 overflow-y-auto"
                        style={{ zIndex: 1001 }}
                      >
                        {industries.map((ind) => (
                          <button
                            key={ind}
                            onClick={() => handleIndustrySelect(ind)}
                            type="button"
                            className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-[var(--menuHover)] focus:bg-[var(--menuFocus)] text-[var(--text)] text-[12px] sm:text-[13px] md:text-[14px] border-b border-[var(--border)] last:border-b-0 focus:outline-none transition-colors"
                          >
                            {ind}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedIndustry === "Others" && (
                      <input
                        type="text"
                        placeholder="Describe your sector"
                        value={customIndustry}
                        onChange={(e) => setCustomIndustry(e.target.value)}
                        className="w-full mt-2 bg-[var(--input)] border border-[var(--border)] rounded-lg px-4 py-2.5 sm:py-3 text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--border)]"
                      />
                    )}
                  </div>

                  {/* Offering */}
                  <div
                    className="relative dropdown-container overflow-visible"
                    style={{ zIndex: openDropdown === "offering" ? 1000 : 1 }}
                  >
                    <button
                      onClick={() =>
                        selectedIndustry
                          ? handleDropdownToggle("offering")
                          : null
                      }
                      disabled={!selectedIndustry}
                      type="button"
                      className={`w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-4 py-2.5 sm:py-3 text-left flex items-center justify-between focus:outline-none transition-colors ${
                        selectedIndustry
                          ? "hover:border-[var(--border)] cursor-pointer focus:border-[var(--border)]"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <span
                        className={`${
                          selectedOffering
                            ? "text-[var(--text)]"
                            : "text-[var(--muted)]"
                        } text-[12px] sm:text-[13px] md:text-[14px]`}
                      >
                        {selectedOffering || "Offering Type"}
                      </span>
                      <ChevronDown
                        size={20}
                        className={`transition-transform ${
                          openDropdown === "offering" ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {openDropdown === "offering" && selectedIndustry && (
                      <div
                        className="absolute top-full left-0 right-0 bg-[var(--input)] border border-[var(--border)] rounded-lg mt-1 shadow-2xl max-h-56 overflow-y-auto"
                        style={{ zIndex: 1001 }}
                      >
                        {offerings.map((off) => (
                          <button
                            key={off}
                            onClick={() => handleOfferingSelect(off)}
                            type="button"
                            className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-[var(--menuHover)] focus:bg-[var(--menuFocus)] text-[var(--text)] text-[12px] sm:text-[13px] md:text-[14px] border-b border-[var(--border)] last:border-b-0 focus:outline-none transition-colors"
                          >
                            {off}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div
                    className="relative dropdown-container overflow-visible"
                    style={{ zIndex: openDropdown === "category" ? 1000 : 1 }}
                  >
                    <button
                      onClick={() =>
                        selectedOffering
                          ? handleDropdownToggle("category")
                          : null
                      }
                      disabled={!selectedOffering}
                      type="button"
                      className={`w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-4 py-2.5 sm:py-3 text-left flex items-center justify-between focus:outline-none transition-colors ${
                        selectedOffering
                          ? "hover:border-[var(--border)] cursor-pointer focus:border-[var(--border)]"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <span
                        className={`${
                          selectedCategory
                            ? "text-[var(--text)]"
                            : "text-[var(--muted)]"
                        } text-[12px] sm:text-[13px] md:text-[14px]`}
                      >
                        {selectedCategory ||
                          `Specific Category for ${
                            selectedOffering?.toLowerCase() || "service"
                          }`}
                      </span>
                      <ChevronDown
                        size={20}
                        className={`transition-transform ${
                          openDropdown === "category" ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {openDropdown === "category" && selectedOffering && (
                      <div
                        className="absolute top-full left-0 right-0 bg-[var(--input)] border border-[var(--border)] rounded-lg mt-1 shadow-2xl max-h-56 overflow-y-auto"
                        style={{ zIndex: 1001 }}
                      >
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => handleCategorySelect(cat)}
                            type="button"
                            className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-[var(--menuHover)] focus:bg-[var(--menuFocus)] text-[var(--text)] text-[12px] sm:text-[13px] md:text-[14px] border-b border-[var(--border)] last:border-b-0 focus:outline-none transition-colors"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedCategory === "Others" && (
                      <input
                        type="text"
                        placeholder="Describe your service"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full mt-2 bg-[var(--input)] border border-[var(--border)] rounded-lg px-4 py-2.5 sm:py-3 text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--border)]"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Summary CTA */}
              {showSummary && (
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
                      onClick={handleResetSelections}
                      className="text-gray-500 hover:text-gray-700 font-semibold"
                      type="button"
                    >
                      YES!
                    </button>
                  </div>
                </div>
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
              className="inline-flex items-center gap-2 rounded-full bg-[var(--input)] px-5 sm:px-6 py-2.5 sm:py-3 text-[12px] sm:text-[13px] md:text-[14px] text-[var(--text)] hover:bg-[var(--input)] shadow-sm border border-[#d45427]"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {showSummary && (
              <button
                onClick={handleNext}
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
