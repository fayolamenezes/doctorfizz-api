"use client";

import { useEffect, useMemo, useState } from "react";
import { Wifi, FileText, Link2, ChevronRight, ThumbsUp, ThumbsDown } from "lucide-react";

/** Small thumbs up/down animation */
function LikeDislike() {
  const [choice, setChoice] = useState(null);
  const [bump, setBump] = useState(null);

  const handleClick = (dir) => {
    setChoice((prev) => (prev === dir ? null : dir));
    setBump(dir);
    setTimeout(() => setBump(null), 150);
  };

  const base = "cursor-pointer transition-transform duration-150";
  return (
    <span className="flex items-center gap-2">
      <ThumbsUp
        size={16}
        strokeWidth={2}
        fill="none"
        className={`${base} ${bump === "up" ? "scale-110" : ""} ${choice === "up" ? "text-[#22C55E]" : ""}`}
        onClick={() => handleClick("up")}
      />
      <ThumbsDown
        size={16}
        strokeWidth={2}
        fill="none"
        className={`${base} ${bump === "down" ? "scale-110" : ""} ${choice === "down" ? "text-[#EF4444]" : ""}`}
        onClick={() => handleClick("down")}
      />
    </span>
  );
}

/** Difficulty bar with thresholds: 0–50 red, 51–80 orange, 81–100 green */
function DifficultyBar({ value, progress = 1 }) {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const raw = clamp(Number(value) || 0, 0, 100);
  const pct = clamp(raw * clamp(progress, 0, 1), 0, 100);
  const color = raw <= 50 ? "#EF4444" : raw <= 80 ? "#F59E0B" : "#10B981";

  return (
    <div className="relative h-2 w-28 overflow-hidden rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
      <div
        className="h-2 rounded-full"
        style={{
          width: `${pct}%`,
          backgroundColor: color,
          transition: "width 120ms linear",
        }}
      />
    </div>
  );
}

/** Button styles */
const orangePill = {
  background: "linear-gradient(180deg, rgba(255,246,235,1) 0%, rgba(255,234,213,1) 100%)",
  border: "1px solid #FDBA74",
  color: "#F97316",
  boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
};
const orangePillHover = {
  background: "linear-gradient(180deg, rgba(255,242,227,1) 0%, rgba(255,228,201,1) 100%)",
};
const grayPill = {
  background: "linear-gradient(180deg, #F9FAFB 0%, #F3F4F6 100%)",
  border: "1px solid #E5E7EB",
  color: "#9CA3AF",
};

/** Toggleable button (demo mode) */
function DemoPill({ active, onToggle, children }) {
  const [hovered, setHovered] = useState(false);
  const style = active ? (hovered ? { ...orangePill, ...orangePillHover } : orangePill) : grayPill;

  return (
    <button
      className="inline-flex items-center justify-center rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/** Main Table */
export default function NewOnPageSEOTable({ rows, progress = 1 }) {
  // Stable fallback
  const fallback = useMemo(
    () => [
      { keyword: "How to fix slow Wi-Fi", type: "Informational", volume: 7032, difficulty: 98, suggested: "The information shown here..." },
      { keyword: "Best laptop under $1000", type: "Transactional", volume: 5500, difficulty: 72, suggested: "Comparison of popular laptops..." },
      { keyword: "SEO tools 2025", type: "Informational", volume: 12000, difficulty: 45, suggested: "List of free SEO tools..." },
      { keyword: "Fix Chrome crashes", type: "Informational", volume: 8900, difficulty: 60, suggested: "Steps to resolve frequent crashes..." },
      { keyword: "Website not indexing", type: "Transactional", volume: 3200, difficulty: 30, suggested: "Indexing troubleshooting..." },
    ],
    []
  );

  // ✅ Memoize data so the reference is stable between renders
  const data = useMemo(() => {
    const base = Array.isArray(rows) && rows.length ? rows : fallback;
    return base.slice(0, 200);
  }, [rows, fallback]);

  // Active map state
  const [activeMap, setActiveMap] = useState(() =>
    Array.from({ length: data.length }, () => ({
      blog: Math.random() < 0.45,
      page: Math.random() < 0.45,
    }))
  );

  // ✅ Only re-randomize when the LENGTH changes (prevents infinite loop)
  const dataLen = data.length;
  useEffect(() => {
    setActiveMap((prev) => {
      const next = Array.from({ length: dataLen }, (_, i) =>
        prev[i] ?? { blog: Math.random() < 0.45, page: Math.random() < 0.45 }
      );
      return next;
    });
  }, [dataLen]);

  // Toggle both ways
  const toggle = (index, key) =>
    setActiveMap((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: !next[index]?.[key] };
      return next;
    });

  return (
    <section aria-labelledby="new-on-page-seo-opportunity">
      <h2 className="text-[20px] font-semibold leading-[24px] text-[#1A1A1A] mb-2 ml-1">
        New on page SEO opportunity
      </h2>
      <p
        className="ml-1 mb-4 text-[16px] font-normal text-[#444444]"
        style={{ fontFamily: "Instrument Sans", letterSpacing: "-0.02em" }}
      >
        While it’s highly recommended to follow the AI’s suggested plan for optimal results,
        feel free to generate content based on your personal choice.
      </p>

      <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--input)] shadow-sm">
        {/* Header */}
        {/* 👇 Keywords column reduced (1.4fr) and Suggested topic widened (1.9fr) */}
        <div className="hidden md:grid grid-cols-[1.4fr_1.3fr_1.1fr_1.3fr_1.9fr_1fr_1fr_1.4fr] px-4 py-3 text-[12px] font-semibold text-[var(--muted)] text-center bg-[var(--input)]">
          <div className="text-left">Keywords</div>
          <div>Type <span className="opacity-50">↑↓</span></div>
          <div>Search Volume</div>
          <div>SEO Difficulty</div>
          <div>Suggested topic</div>
          <div>Blog</div>
          <div>Page</div>
          <div>Preference</div>
        </div>

        {/* Rows */}
        <div className="px-2 md:px-3 lg:px-4 bg-white">
          <ul className="divide-y divide-[#ECEFF5] bg-[#E5E7EB]/30">
            {data.map((row, i) => (
              <li
                key={i}
                className="grid grid-cols-1 md:grid-cols-[1.4fr_1.3fr_1.1fr_1.3fr_1.9fr_1fr_1fr_1.4fr] items-center gap-3 px-4 py-3 text-[13px] text-center"
              >
                {/* KEYWORD CELL – now lets grid control width, wraps to next line */}
                <div className="flex items-start gap-2 justify-start text-[var(--text)]">
                  <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--input)] text-[var(--muted)]">
                    <Wifi size={14} />
                  </span>
                  <span className="min-w-0 whitespace-normal break-words leading-snug text-left">
                    {row.keyword}
                  </span>
                </div>

                <div>
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] seo-badge-light">
                    {row.type === "Informational" ? <FileText size={12} /> : <Link2 size={12} />} {row.type}
                  </span>
                </div>

                <div className="tabular-nums text-[var(--text)]">
                  {Number(row.volume).toLocaleString()}
                </div>

                <div className="flex items-center gap-2 justify-start text-[var(--text)]">
                  <span className="tabular-nums">{row.difficulty}%</span>
                  <DifficultyBar value={row.difficulty} progress={progress} />
                </div>

                <div className="text-left md:text-center text-[var(--text)] whitespace-normal break-words leading-snug min-w-0">
                  {row.suggested ?? "—"}
                </div>

                {/* Blog / Page buttons */}
                <div className="flex justify-center">
                  <DemoPill active={!!activeMap[i]?.blog} onToggle={() => toggle(i, "blog")}>
                    Generate
                  </DemoPill>
                </div>
                <div className="flex justify-center">
                  <DemoPill active={!!activeMap[i]?.page} onToggle={() => toggle(i, "page")}>
                    Generate
                  </DemoPill>
                </div>

                {/* Like/dislike */}
                <div className="flex items-center justify-center gap-3 text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px]" />
                  <LikeDislike />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[var(--border)] bg-[var(--input)] px-4 py-3">
          <button
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={orangePill}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, orangePillHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, orangePill)}
          >
            View all page issue <ChevronRight size={14} color="#F97316" />
          </button>
        </div>
      </div>
    </section>
  );
}
