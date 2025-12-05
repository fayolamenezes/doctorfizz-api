// components/content-editor/CE.MetricsStrip.js
"use client";

import React, { useEffect, useRef, useState } from "react";
import { HelpCircle, MinusCircle, PlusCircle, ListChecks } from "lucide-react";

/** Smooth animation hook for number transitions */
function useSpringNumber(target = 0, ms = 700) {
  const [value, setValue] = useState(target);
  const prevTarget = useRef(target);
  const raf = useRef();

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;

    cancelAnimationFrame(raf.current);
    const from = value;
    const to = Number.isFinite(target) ? target : 0;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

const pctText = (n, digits = 0) =>
  `${Math.max(0, Math.min(100, n || 0)).toFixed(digits)}%`;

/** Status helper with optional inversion (for metrics where lower is better, e.g., Plagiarism) */
function getStatus(pct, { invert = false } = {}) {
  const v = invert ? 100 - (pct || 0) : (pct || 0);
  if (v >= 75) return { label: "Good", color: "text-green-600" };
  if (v >= 40) return { label: "Moderate", color: "text-yellow-600" };
  return { label: "Needs Review", color: "text-red-600" };
}

/** progress bar (desktop) */
function Bar({ pct = 0, tone = "default", className = "" }) {
  const width = Math.max(0, Math.min(100, pct));
  const color =
    tone === "warn"
      ? "#F59E0B"
      : tone === "good"
      ? "#16A34A"
      : tone === "bad"
      ? "#DC2626"
      : "#CBD5E1";
  return (
    <div className={`mt-1 h-1.5 rounded bg-gray-200 overflow-hidden ${className}`}>
      <div
        className="h-full rounded transition-all duration-500"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

/** Generic metric card (desktop) */
function MetricCard({ label, valuePct }) {
  const invert = label === "PLAGIARISM";
  const anim = useSpringNumber(valuePct ?? 0);
  const status = getStatus(valuePct, { invert });
  const tone =
    status.label === "Good" ? "good" : status.label === "Moderate" ? "warn" : "bad";

  return (
    <div className="relative min-w-0 h-[74px] rounded-[12px] border border-[var(--border)] bg-white px-3 py-2 transition-colors">
      <div className="flex h-full flex-col justify-end">
        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[var(--text-primary)]">
          <span className="truncate">{label}</span>
          <HelpCircle size={13} className="text-[var(--muted)] shrink-0" />
        </div>

        <div className="mb-1 flex items-center justify-between">
          <div className="text-[14px] font-bold text-[var(--text-primary)]">
            {pctText(anim)}
          </div>
          <div className={`text-[11px] ${status.color} font-medium`}>
            {status.label}
          </div>
        </div>

        <Bar pct={anim} tone={tone} />
      </div>
    </div>
  );
}

/** Word count card (desktop) */
function WordcountCard({ count = 0, target = 1200 }) {
  const pct = Math.max(0, Math.min(100, (count / Math.max(1, target)) * 100));

  const [lastAt, setLastAt] = useState(0);
  useEffect(() => {
    setLastAt(performance.now());
  }, [count]);
  const recentlyUpdated = performance.now() - lastAt < 120;

  const countSpring = useSpringNumber(count, 400);
  const pctSpring = useSpringNumber(pct, 400);

  const animCount = recentlyUpdated ? count : countSpring;
  const animPct = recentlyUpdated ? pct : pctSpring;

  const tone = pct >= 75 ? "good" : pct >= 40 ? "warn" : "bad";

  return (
    <div className="min-w-0 h-[74px] rounded-[12px] border border-[var(--border)] bg-white px-3 py-2 transition-colors">
      <div className="flex h-full flex-col justify-end">
        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[var(--text-primary)]">
          <span className="truncate">WORD COUNT</span>
          <HelpCircle size={13} className="text-[var(--muted)] shrink-0" />
        </div>

        <div className="mb-1 flex items-center justify-between">
          <div className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
            {Math.round(animCount)} <span className="font-normal">/ {target}</span>
          </div>
          <div className="text-[11.5px] font-semibold text-[var(--muted)] opacity-70">
            {pctText(animPct)}
          </div>
        </div>

        <Bar pct={animPct} tone={tone} />
      </div>
    </div>
  );
}

/** SEO pill (desktop) */
function SeoPill({ active, title, Icon, onClick, disabled }) {
  const base =
    "min-w-0 h-[74px] rounded-[12px] border px-3 text-left transition-all";
  const activeCls = "border-[1.5px] border-orange-600 bg-orange-50";
  const inactiveCls = "border-[var(--border)] bg-white hover:bg-gray-50";
  const disabledCls = "opacity-50 cursor-not-allowed hover:bg-white";

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={disabled ? "Type a keyword and click Start to unlock" : title}
      className={`${base} ${active ? activeCls : inactiveCls} ${
        disabled ? disabledCls : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid place-items-center h-6 w-6 rounded-full border ${
            active ? "border-orange-300 bg-orange-100" : "border-gray-300 bg-gray-100"
          }`}
        >
          <Icon size={16} className={active ? "text-orange-600" : "text-gray-500"} />
        </span>
        <div className="leading-tight min-w-0">
          <div
            className={`text-[10px] font-medium ${
              active ? "text-orange-700/80" : "text-[var(--muted)]"
            }`}
          >
            SEO
          </div>
          <div
            className={`text-[12.5px] font-bold truncate ${
              active ? "text-orange-700" : "text-[var(--muted)]"
            }`}
          >
            {title}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------- MOBILE ONLY ------------------------------- */

/** Mobile pill (extra–extra compact) */
function SeoPillMobile({ active, title, Icon, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        "h-[46px] w-full rounded-[12px] border text-left transition-all",
        active
          ? "border-orange-300 bg-orange-50 shadow-[0_1px_0_0_rgba(255,159,64,0.25),0_0_0_2px_rgba(255,159,64,0.10)_inset]"
          : "border-gray-200 bg-white",
        disabled ? "opacity-60 cursor-not-allowed" : "",
        "px-2",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={[
            "grid place-items-center h-4 w-4 rounded-full border",
            active ? "border-orange-200 bg-orange-100" : "border-gray-300 bg-gray-100",
          ].join(" ")}
        >
          <Icon size={12} className={active ? "text-orange-600" : "text-gray-500"} />
        </span>
        <div className="leading-tight min-w-0">
          <div
            className={[
              "text-[8.5px] font-semibold tracking-wide",
              active ? "text-gray-600" : "text-gray-400",
            ].join(" ")}
          >
            SEO
          </div>
          <div
            className={[
              "truncate font-semibold",
              active ? "text-orange-600" : "text-gray-500",
              "text-[11px]",
            ].join(" ")}
          >
            {title}
          </div>
        </div>
      </div>
    </button>
  );
}

/** Circular metric (ultra compact, perfectly centered & balanced) */
function CircularStat({
  pct = 0,
  label,
  ring = "#10B981",
  alt = false,
  count,
  target,
}) {
  const size = 48;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const clamped = Math.max(0, Math.min(100, pct));
  const anim = useSpringNumber(clamped, 500);

  const hasCt = typeof count === "number" && typeof target === "number";
  const rounded = hasCt ? Math.round(count) : 0;

  const NUMERIC_STYLE = {
    fontVariantNumeric: "tabular-nums lining-nums",
    fontFeatureSettings: "'tnum' 1, 'lnum' 1",
  };

  const mainSize = hasCt ? 12 : 13;
  const subSize = 9;
  const mainDy = "-0.15em";
  const subDy = "0.95em";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#fff"
          strokeWidth={stroke}
          fill="#fff"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ring}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (anim / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-500"
        />

        {hasCt ? (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-900"
            fontWeight="700"
            style={NUMERIC_STYLE}
          >
            <tspan fontSize={mainSize} dy={mainDy}>
              {rounded}
            </tspan>
            <tspan
              x="50%"
              dy={subDy}
              className="fill-gray-500"
              fontWeight="600"
              fontSize={subSize}
              style={NUMERIC_STYLE}
            >
              /{target}
            </tspan>
          </text>
        ) : (
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            className={alt ? "fill-rose-600" : "fill-gray-900"}
            fontWeight="700"
            fontSize={mainSize + 1}
            style={NUMERIC_STYLE}
          >
            {Math.round(anim)}%
          </text>
        )}
      </svg>

      <div className="mt-1 text-[8.5px] font-medium text-gray-700 text-center leading-[1.1]">
        {label}
      </div>
    </div>
  );
}

/* Tiny inline badge used in collapsed mobile summary bar */
/* Compact inline badge — slightly larger than micro */
function MiniMetricBadge({ colorClass, bgClass, label, value }) {
  return (
    <div className="flex items-center gap-[1px] whitespace-nowrap m-0 p-0">
      <span
        className={`flex items-center justify-center min-w-[10px] h-[11px] rounded-full px-[2px] text-[6px] font-semibold text-white ${bgClass}`}
      >
        {value}
      </span>
      <span
        className={`text-[6px] leading-[1] font-semibold tracking-tight ${colorClass}`}
      >
        {label}
      </span>
    </div>
  );
}

/* ---------------------------------- MAIN ---------------------------------- */

export default function CEMetricsStrip({
  metrics,
  seoMode,
  onChangeSeoMode,
  /** Gate Advanced/Details until a search has been run in SEO Basics */
  canAccessAdvanced = true,
}) {
  const plagPct = metrics?.plagiarism ?? 0;
  const pkPct = metrics?.primaryKeyword ?? 0;
  const wc = metrics?.wordCount ?? 0;
  const wcTarget = metrics?.wordTarget ?? 1200;
  const lsiPct = metrics?.lsiKeywords ?? 0;

  const wcPct = Math.max(0, Math.min(100, (wc / Math.max(1, wcTarget)) * 100));

  const pkBadge = Math.round(pkPct);
  const plagBadge = Math.round(plagPct);
  const wcBadge = Math.round(wcPct);
  const lsiBadge = Math.round(lsiPct);

  return (
    <div className="mb-4">
      {/* --------------------- DESKTOP (unchanged) --------------------- */}
      <div className="hidden md:grid grid-cols-[1.2fr_1.2fr_1.2fr_1.2fr_.8fr_.8fr_.8fr] gap-2.5 items-stretch">
        <MetricCard label="PLAGIARISM" valuePct={plagPct} />
        <MetricCard label="PRIMARY KEYWORD" valuePct={pkPct} />
        <WordcountCard count={wc} target={wcTarget} />
        <MetricCard label="LSI KEYWORDS" valuePct={lsiPct} />

        <SeoPill
          title="Basic"
          Icon={MinusCircle}
          active={seoMode === "basic"}
          onClick={() => onChangeSeoMode?.("basic")}
          disabled={false}
        />
        <SeoPill
          title="Advanced"
          Icon={PlusCircle}
          active={seoMode === "advanced"}
          onClick={() => onChangeSeoMode?.("advanced")}
          disabled={!canAccessAdvanced}
        />
        <SeoPill
          title="Details"
          Icon={ListChecks}
          active={seoMode === "details"}
          onClick={() => onChangeSeoMode?.("details")}
          disabled={!canAccessAdvanced}
        />
      </div>

      {/* --------- MOBILE: collapsed summary strip (shown on collapse) --------- */}
      <div
        id="ce-metrics-mobile-summary"
        className="md:hidden hidden px-2 pt-1 pb-1 border-b border-[var(--border)] bg-white"
      >
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto no-scrollbar">
          <MiniMetricBadge
            value={pkBadge}
            label="PRIMARY KEYWORD"
            colorClass="text-gray-800"
            bgClass="bg-emerald-500"
          />
          <MiniMetricBadge
            value={plagBadge}
            label="PLAGIARISM"
            colorClass="text-gray-800"
            bgClass="bg-rose-500"
          />
          <MiniMetricBadge
            value={wcBadge}
            label="WORD COUNT"
            colorClass="text-gray-800"
            bgClass="bg-violet-500"
          />
          <MiniMetricBadge
            value={lsiBadge}
            label="LSI KEYWORDS"
            colorClass="text-gray-800"
            bgClass="bg-amber-500"
          />
        </div>
      </div>

      {/* ----------------------- MOBILE (full metrics) ------------------------ */}
      <div id="ce-metrics-mobile" className="md:hidden space-y-3">
        {/* Pills row */}
        <div className="grid grid-cols-3 gap-2">
          <SeoPillMobile
            title="Basic"
            Icon={MinusCircle}
            active={seoMode === "basic"}
            onClick={() => onChangeSeoMode?.("basic")}
          />
          <SeoPillMobile
            title="Advance"
            Icon={PlusCircle}
            active={seoMode === "advanced"}
            onClick={() => onChangeSeoMode?.("advanced")}
            disabled={!canAccessAdvanced}
          />
          <SeoPillMobile
            title="Details"
            Icon={ListChecks}
            active={seoMode === "details"}
            onClick={() => onChangeSeoMode?.("details")}
            disabled={!canAccessAdvanced}
          />
        </div>

        {/* Circular metrics row */}
        <div className="grid grid-cols-4 gap-2">
          <CircularStat pct={pkPct} label="PRIMARY KEYWORD" ring="#10B981" />
          <CircularStat pct={plagPct} label="PLAGIARISM" ring="#E11D48" alt />
          <CircularStat pct={lsiPct} label="LSI KEYWORDS" ring="#F59E0B" />
          <CircularStat
            pct={wcPct}
            label="WORD COUNT"
            ring="#8B5CF6"
            count={wc}
            target={wcTarget}
          />
        </div>
      </div>
    </div>
  );
}
