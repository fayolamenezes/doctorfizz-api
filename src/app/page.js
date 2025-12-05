// app/page.js (or wherever this file lives)
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Steps from "./components/Steps";
import Step1Slide1 from "./components/Step1Slide1";
import StepSlide2 from "./components/StepSlide2";
import StepSlide3 from "./components/StepSlide3";
import StepSlide4 from "./components/StepSlide4";
import StepSlide5 from "./components/StepSlide5";
import Step5Slide2 from "./components/Step5Slide2";
import ThemeToggle from "./components/ThemeToggle";
import SidebarInfoPanel from "./components/SidebarInfoPanel";
import Dashboard from "./components/Dashboard";
import ContentEditor from "./components/ContentEditor";

/* ---------- Mobile-only compact steps: 3 / 2 with dotted connectors ---------- */
function MobileStepsThreeTwo({ currentStep }) {
  const active = typeof currentStep === "number" ? currentStep : 5;

  const Dot = ({ n }) => {
    const state = n === active ? "active" : n < active ? "complete" : "idle";
    const cls =
      state === "active"
        ? "bg-[image:var(--infoHighlight-gradient)] text-white"
        : state === "complete"
        ? "bg-gray-700 text-white"
        : "bg-gray-200 text-gray-600";
    return (
      <div
        className={`h-7 w-7 rounded-full grid place-items-center text-[11px] font-semibold ${cls}`}
        aria-current={n === active ? "step" : undefined}
        aria-label={`Step ${n} of 5`}
      >
        {n}
      </div>
    );
  };

  // true circular dotted connector (mobile)
  const DottedConnector = ({ size = 3, count = 5, color = "bg-gray-300/90" }) => (
    <div className="flex items-center justify-center shrink-0 gap-1.5" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`block rounded-full ${color}`}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );

  const Row3 = ({ a, b, c }) => (
    <div className="flex items-center justify-center gap-2">
      <Dot n={a} />
      <DottedConnector />
      <Dot n={b} />
      <DottedConnector />
      <Dot n={c} />
    </div>
  );

  const Row2 = ({ a, b }) => (
    <div className="flex items-center justify-center gap-2">
      <Dot n={a} />
      <DottedConnector />
      <Dot n={b} />
    </div>
  );

  return (
    <div className="sm:hidden w-full bg-[var(--bg-panel)] rounded-tl-2xl rounded-tr-2xl pt-10 pb-2 px-3">
      <div className="mx-auto w-fit space-y-6">
        <Row3 a={1} b={2} c={3} />
        <Row2 a={4} b={5} />
      </div>
    </div>
  );
}

export default function Home() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [websiteData, setWebsiteData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [languageLocationData, setLanguageLocationData] = useState(null);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [competitorData, setCompetitorData] = useState(null);

  // holds payload for editor (null => open empty document)
  const [editorData, setEditorData] = useState(null);

  // catalog from public/data/contenteditor.json
  const [catalog, setCatalog] = useState([]);

  const infoRef = useRef(null);

  // scroll container ref for the main host panel
  const scrollContainerRef = useRef(null);

  // on first load, if URL hash is #editor, land on Content Editor
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#editor") {
      setCurrentStep("contentEditor");
    }
  }, []);

  // Load Content Editor catalog once
  useEffect(() => {
    fetch("/data/contenteditor.json")
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  // Sidebar click-outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        infoRef.current &&
        !infoRef.current.contains(event.target) &&
        !event.target.closest("#sidebar-info-btn") &&
        !isPinned
      ) {
        setIsInfoOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPinned]);

  // Listen for custom events to switch between Dashboard and Content Editor
  useEffect(() => {
    const toEditor = (e) => {
      // e.detail may be { title, content, domain, kind } or null (for new doc)
      const p = e?.detail ?? null;
      if (!p) {
        setEditorData(null);
        setCurrentStep("contentEditor");
        return;
      }

      // merge: catalog (contenteditor.json) for SEO config, payload (multi-content) for title+content
      // When merging payload with SEO config from the catalog, prefer
      // matching by the exact title first.  Domains often have
      // multiple entries (one per blog/page) so matching on domain
      // alone would always pick the first entry and override the
      // payload with the wrong SEO data.  By checking the title
      // first, we ensure we pick the correct page.  Only if the
      // title is absent or unmatched do we fall back to domain.
      const match =
        catalog.find((x) => x.title === p.title) ||
        catalog.find((x) => x.domain === p.domain) ||
        null;

      const merged = match
        ? {
            ...match,
            ...p,
            // ensure title + content from payload win
            title: p.title ?? match.title,
            content: p.content ?? match.content,
          }
        : p;

      // Persist the selected domain to localStorage for the research panel.
      // Without updating this key the optimize tab may load data from a previous
      // domain and fallback to the first page【14921893551222†L259-L279】.
      if (merged && merged.domain) {
        try {
          localStorage.setItem(
            "websiteData",
            JSON.stringify({ site: merged.domain })
          );
        } catch {
          // ignore storage errors (e.g. private browsing)
        }
      }

      setEditorData(merged);
      setCurrentStep("contentEditor");
    };

    const toDashboard = () => {
      setEditorData(null);
      setCurrentStep("dashboard");
    };

    window.addEventListener("content-editor:open", toEditor);
    window.addEventListener("content-editor:back", toDashboard);
    return () => {
      window.removeEventListener("content-editor:open", toEditor);
      window.removeEventListener("content-editor:back", toDashboard);
    };
  }, [catalog]);

  // keep the URL hash in sync ONLY for Content Editor
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentStep === "contentEditor") {
      if (window.location.hash !== "#editor") {
        history.replaceState(null, "", "#editor");
      }
    } else if (window.location.hash === "#editor") {
      // when leaving editor, clear the hash
      history.replaceState(null, "", "#");
    }
  }, [currentStep]);

  // always reset scroll position when step changes
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop = 0;
  }, [currentStep]);

  // listen for "wizard:navigate" from Step5Slide2 "Edit …" buttons
  useEffect(() => {
    const onWizardNavigate = (e) => {
      const step = e?.detail?.step ?? e?.step ?? null; // supports CustomEvent or plain object
      if (!step) return;
      setCurrentStep(step);
    };
    window.addEventListener("wizard:navigate", onWizardNavigate);
    return () => window.removeEventListener("wizard:navigate", onWizardNavigate);
  }, []);

  const handleNextStep = () => {
    if (currentStep === 5) {
      setCurrentStep("5b");
      return;
    }
    if (typeof currentStep === "number" && currentStep < 5) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBackStep = () => {
    if (currentStep === "5b") {
      setCurrentStep(5);
      return;
    }
    if (typeof currentStep === "number" && currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  // keep your original submit behavior; InfoPanel.js already ensures "pin only on desktop"
  const handleWebsiteSubmit = useCallback((website) => {
    let cleanWebsite = website.toLowerCase();
    if (cleanWebsite.startsWith("http://")) cleanWebsite = cleanWebsite.replace("http://", "");
    if (cleanWebsite.startsWith("https://")) cleanWebsite = cleanWebsite.replace("https://", "");
    if (cleanWebsite.startsWith("www.")) cleanWebsite = cleanWebsite.replace("www.", "");
    setWebsiteData({ website: cleanWebsite, submittedAt: new Date() });

    setIsInfoOpen(true);
    setIsPinned(true); // fine to keep; small screens won't shift because we only offset on lg+
  }, []);

  const handleBusinessDataSubmit = useCallback((business) => setBusinessData(business), []);
  const handleLanguageLocationSubmit = useCallback(
    (data) => setLanguageLocationData(data),
    []
  );
  const handleKeywordSubmit = useCallback((data) => setSelectedKeywords(data.keywords), []);
  const handleCompetitorSubmit = useCallback(
    (data) =>
      setCompetitorData(
        data || { businessCompetitors: [], searchCompetitors: [], totalCompetitors: [] }
      ),
    []
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Slide1 onNext={handleNextStep} onWebsiteSubmit={handleWebsiteSubmit} />;
      case 2:
        return (
          <StepSlide2
            onNext={handleNextStep}
            onBack={handleBackStep}
            onBusinessDataSubmit={handleBusinessDataSubmit}
          />
        );
      case 3:
        return (
          <StepSlide3
            onNext={handleNextStep}
            onBack={handleBackStep}
            onLanguageLocationSubmit={handleLanguageLocationSubmit}
          />
        );
      case 4:
        return (
          <StepSlide4
            onNext={handleNextStep}
            onBack={handleBackStep}
            onKeywordSubmit={handleKeywordSubmit}
          />
        );
      case 5:
        return (
          <StepSlide5
            onNext={handleNextStep}
            onBack={handleBackStep}
            onCompetitorSubmit={handleCompetitorSubmit}
          />
        );
      case "5b":
        return (
          <Step5Slide2
            onBack={() => setCurrentStep(5)}
            onDashboard={() => setCurrentStep("dashboard")}
            businessData={businessData}
            languageLocationData={languageLocationData}
            keywordData={selectedKeywords}
            competitorData={competitorData}
          />
        );
      case "dashboard":
        return (
          <Dashboard
            // Start from a card: pass payload to open editor with content from multi-content.json
            onOpenContentEditor={(payload) => {
              if (!payload) {
                setEditorData(null);
                setCurrentStep("contentEditor");
                return;
              }

              // Same matching logic as in the toEditor handler: pick by
              // title first to avoid grabbing the wrong page when
              // multiple pages share a domain.  Fall back to domain
              // only if the title isn’t available.
              const match =
                catalog.find((x) => x.title === payload.title) ||
                catalog.find((x) => x.domain === payload.domain) ||
                null;

              const merged = match
                ? {
                    ...match,
                    ...payload,
                    title: payload.title ?? match.title,
                    content: payload.content ?? match.content,
                  }
                : payload;

              // Persist the selected domain to localStorage so the
              // research panel opens the correct optimize dataset.  Without
              // this, the optimize tab may retain the previous domain and
              // default to the first page【14921893551222†L259-L279】.
              if (merged && merged.domain) {
                try {
                  localStorage.setItem(
                    "websiteData",
                    JSON.stringify({ site: merged.domain })
                  );
                } catch {
                  // ignore storage errors
                }
              }

              setEditorData(merged);
              setCurrentStep("contentEditor");
            }}
          />
        );
      case "contentEditor":
        return (
          <ContentEditor
            data={editorData} // null => empty editor; object => prefilled
            onBackToDashboard={() => {
              setEditorData(null);
              setCurrentStep("dashboard");
            }}
          />
        );
      default:
        return <Step1Slide1 onNext={handleNextStep} onWebsiteSubmit={handleWebsiteSubmit} />;
    }
  };

  // Only desktop shifts left when the info panel is open/pinned.
  const mainOffsetClass =
    isInfoOpen || isPinned
      ? "ml-[56px] md:ml-[72px] lg:ml-[510px]"
      : "ml-[56px] md:ml-[72px] lg:ml-[80px]";

  // Switch the left sidebar content when Content Editor is active
  const sidebarVariant = currentStep === "contentEditor" ? "editor" : "default";

  return (
    <div className="flex h-screen overflow-hidden bg-[image:var(--brand-gradient)] bg-no-repeat bg-[size:100%_100%] p-3">
      <SidebarInfoPanel
        ref={infoRef}
        onInfoClick={() => {
          if (isPinned) return;
          setIsInfoOpen((prev) => !prev);
        }}
        infoActive={isInfoOpen || isPinned}
        isOpen={isInfoOpen}
        isPinned={isPinned}
        setIsPinned={setIsPinned}
        websiteData={websiteData}
        businessData={businessData}
        languageLocationData={languageLocationData}
        keywordData={selectedKeywords}
        competitorData={competitorData}
        currentStep={currentStep === "5b" ? 5 : currentStep}
        onClose={() => setIsInfoOpen(false)}
        variant={sidebarVariant}
      />

      <ThemeToggle />

      {/* FLEX COLUMN ROOT */}
      <main
        className={`flex-1 min-w-0 flex flex-col min-h-0 transition-all duration-300 ${mainOffsetClass}`}
      >
        {/* Steps header (hidden on 5b & dashboard & editor) */}
        {currentStep !== "5b" &&
          currentStep !== "dashboard" &&
          currentStep !== "contentEditor" && (
            <>
              {/* Mobile: 3 / 2 steps – centered, dotted connectors, lowered */}
              <MobileStepsThreeTwo currentStep={currentStep} />

              {/* Tablet/Desktop: original full Steps bar */}
              <div className="hidden sm:flex w-full justify-center">
                <div
                  className="
                    max-w-[100%] w-full rounded-tr-2xl rounded-tl-2xl
                    px-5 md:px-6 py-5 md:py-6 bg-[var(--bg-panel)]
                    text-sm md:text-base
                    overflow-hidden
                  "
                >
                  <div className="flex justify-center">
                    <Steps currentStep={currentStep === "5b" ? 5 : currentStep} />
                  </div>
                </div>
              </div>
            </>
          )}

        {/* HOST PANEL — the only scroll container */}
        <div className="flex-1 min-w-0 h-full flex justifyцентр items-start no-scrollbar">
          <style jsx global>{`
            .no-scrollbar {
              -ms-overflow-style: none; /* IE & Edge */
              scrollbar-width: none; /* Firefox */
            }
            .no-scrollbar::-webkit-scrollbar {
              display: none; /* Chrome, Safari, Opera */
            }
          `}</style>

          <div
            ref={scrollContainerRef}
            className={`relative flex-1 min-w-0 h-full bg-[var(--bg-panel)] shadow-sm 
              ${
                currentStep === "dashboard" ||
                currentStep === "contentEditor" ||
                currentStep === "5b"
                  ? "rounded-2xl"
                  : "rounded-bl-2xl rounded-br-2xl"
              } 
              overflow-y-scroll overscroll-contain no-scrollbar`}
          >
            {renderCurrentStep()}
          </div>
        </div>
      </main>
    </div>
  );
}
