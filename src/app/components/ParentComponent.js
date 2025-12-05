"use client";
import { useState } from "react";

// Use your existing step components (matching the filenames you shared)
import StepSlide3 from "./StepSlide3";
import StepSlide4 from "./StepsSlide4";
import StepSlide5 from "./StepSlide5";
import InfoPanel from "./InfoPanel";

export default function ParentComponent() {
  // Step flow (demoing 3→4→5 like before)
  const [currentStep, setCurrentStep] = useState(4);

  // Right-panel controls
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true);
  const [isPinned, setIsPinned] = useState(false);

  // Collected data for the InfoPanel
  const [languageLocationData, setLanguageLocationData] = useState(null);
  const [selectedKeywords, setSelectedKeywords] = useState([]); // array for InfoPanel
  const [competitorData, setCompetitorData] = useState(null);

  // Handlers passed to slides (unchanged functionality)
  const handleLanguageLocationSubmit = (data) => {
    setLanguageLocationData(data);
  };

  const handleKeywordSubmit = (data) => {
    // slides emit { keywords: [...] }
    setSelectedKeywords(data?.keywords || []);
  };

  const handleCompetitorSubmit = (data) => {
    setCompetitorData(
      data || { businessCompetitors: [], searchCompetitors: [], totalCompetitors: [] }
    );
  };

  const handleNext = () => setCurrentStep((s) => Math.min(5, s + 1));
  const handleBack = () => setCurrentStep((s) => Math.max(3, s - 1));

  return (
    <div className="relative">
      {/* Slides area */}
      {currentStep === 3 && (
        <StepSlide3
          onNext={handleNext}
          onBack={handleBack}
          onLanguageLocationSubmit={handleLanguageLocationSubmit}
        />
      )}
      {currentStep === 4 && (
        <StepSlide4
          onNext={handleNext}
          onBack={handleBack}
          onKeywordSubmit={handleKeywordSubmit}
        />
      )}
      {currentStep === 5 && (
        <StepSlide5
          onNext={handleNext}
          onBack={handleBack}
          onCompetitorSubmit={handleCompetitorSubmit}
        />
      )}

      {/* Existing InfoPanel (no functionality changed) */}
      <InfoPanel
        isOpen={isInfoPanelOpen}
        onClose={() => setIsInfoPanelOpen(false)}
        isPinned={isPinned}
        setIsPinned={setIsPinned}
        websiteData={{ website: "hola.com" }}
        businessData={null}
        languageLocationData={languageLocationData}
        keywordData={selectedKeywords}
        competitorData={competitorData}
        currentStep={currentStep}
      />
    </div>
  );
}
