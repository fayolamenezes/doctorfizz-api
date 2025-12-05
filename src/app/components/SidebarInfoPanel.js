"use client";

import React, { forwardRef } from "react";
import Sidebar from "./Sidebar";
import InfoPanel from "./InfoPanel";

export const SIDEBAR_WIDTH_PX = 80;
export const INFOPANEL_WIDTH_PX = 430;

const SidebarInfoPanel = forwardRef(function SidebarInfoPanel(
  {
    // sidebar
    onInfoClick,
    infoActive,
    variant = "default", // <-- NEW: accept variant from parent ("default" | "editor")

    // info panel
    isOpen,
    isPinned,
    setIsPinned,
    websiteData,
    businessData,
    languageLocationData,
    keywordData,
    competitorData,
    currentStep,
    onClose,
  },
  ref
) {
  return (
    <>
      {/* Forward the variant to the actual Sidebar so it can switch menus */}
      <Sidebar onInfoClick={onInfoClick} infoActive={infoActive} variant={variant} />

      {/* Info panel stays the same */}
      <InfoPanel
        ref={ref}
        isOpen={isOpen}
        isPinned={isPinned}
        setIsPinned={setIsPinned}
        websiteData={websiteData}
        businessData={businessData}
        languageLocationData={languageLocationData}
        keywordData={keywordData}
        competitorData={competitorData}
        currentStep={currentStep}
        onClose={onClose}
      />
    </>
  );
});

export default SidebarInfoPanel;
