"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Settings,
  Loader2,
  CheckCircle2,
  Circle,
  TriangleAlert,
  ChevronDown,
  Search as SearchIcon,
  ListChecks,
  List,
  XCircle,
  Wand2,
  CircleHelp,
} from "lucide-react";

/* ---------- ATOMS (theme via your global remaps) ---------- */
function Pill({ tone = "default", children }) {
  const map = {
    default: "bg-gray-50 text-gray-700 border-gray-200",
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

function StepRow({ status, text }) {
  const isDone = status === "done";
  const isActive = status === "active";
  return (
    <div
      className={`flex items-start gap-2 text-[12px] rounded-md px-2 py-1.5 transition ${
        isActive ? "bg-blue-50" : ""
      }`}
    >
      {isDone ? (
        <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
      ) : isActive ? (
        <Loader2 size={15} className="text-blue-600 mt-0.5 shrink-0 animate-spin" />
      ) : (
        <Circle size={15} className="text-gray-300 mt-0.5 shrink-0" />
      )}
      <span className="leading-5 text-gray-700">{text}</span>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  statusTone = "default",
  statusText,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneMap = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    default: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 px-4 py-2.5"
      >
        <span className="grid place-items-center h-7 w-7 rounded-full border border-gray-200 bg-white">
          <Icon size={16} className="text-gray-500" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[13px] font-semibold text-gray-900 truncate">{title}</div>
        </div>
        {statusText ? (
          <span
            className={`ml-auto text-[11px] px-2 py-0.5 border rounded-full font-medium ${toneMap[statusTone]}`}
          >
            {statusText}
          </span>
        ) : null}
        <ChevronDown
          size={16}
          className={`ml-2 text-gray-400 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function ResultItem({ type = "success", children, onFix }) {
  const colorMap = {
    success: "text-emerald-600",
    warning: "text-amber-500",
    error: "text-rose-600",
  };
  const iconMap = { success: CheckCircle2, warning: TriangleAlert, error: XCircle };
  const Icon = iconMap[type];

  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex items-start gap-2 text-[12px] text-gray-700 leading-5">
        <Icon size={15} className={`${colorMap[type]} mt-0.5 shrink-0`} />
        <span>{children}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {onFix && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:underline"
            onClick={onFix}
          >
            <Wand2 size={13} />
            Fix Now
          </button>
        )}
        <CircleHelp size={15} className="text-gray-300" />
      </div>
    </div>
  );
}
/* ---------- /ATOMS ---------- */

export default function SeoBasics({
  query,
  onQueryChange,
  onStart,
  onFix,
  onPasteToEditor,
  phase,
  setPhase,
  /* injected by CE.ResearchPanel */
  currentPage,
  cfgLoading,
  cfgError,
  basicsData, // ← currentPage?.seoBasics from JSON
}) {
  // Fallbacks in case JSON is missing pieces
  const safeBasics = basicsData || {
    basicSEO: [],
    additional: [],
    titleReadability: { score: null, notes: [], expansion: "" },
    contentReadability: { score: null, notes: [], expansion: "" },
    steps: [],
  };

  // Steps come from JSON if present; else defaults.
  const SEARCH_STEPS = useMemo(
    () =>
      Array.isArray(safeBasics.steps) && safeBasics.steps.length
        ? safeBasics.steps
        : [
            "Crawling top results & extracting headings…",
            "Checking keyword usage in title & meta…",
            "Scanning first 10% of content for focus term…",
            "Collecting readability & structure hints…",
          ],
    [safeBasics.steps]
  );

  const STEP_DELAY = 900;
  const END_PAUSE = 700;

  const [activeIndex, setActiveIndex] = useState(-1);
  const [doneMap, setDoneMap] = useState(Array(SEARCH_STEPS.length).fill(false));

  useEffect(() => {
    if (phase !== "searching") return;
    setActiveIndex(0);
    setDoneMap(Array(SEARCH_STEPS.length).fill(false));
    let cancelled = false;

    const run = (i) => {
      if (cancelled) return;
      setActiveIndex(i);
      const t = setTimeout(() => {
        if (cancelled) return;
        setDoneMap((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        if (i < SEARCH_STEPS.length - 1) run(i + 1);
        else {
          setTimeout(() => !cancelled && setPhase("results"), END_PAUSE);
          setActiveIndex(-1);
        }
      }, STEP_DELAY);
      return () => clearTimeout(t);
    };

    const cleanup = run(0);
    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
    };
  }, [phase, setPhase, SEARCH_STEPS.length]); // ← ESLint-safe deps

  const handleStart = () => {
    onStart?.(query);
    setPhase("searching");
  };

  /* ---------- PHASE: idle ---------- */
  if (phase === "idle") {
    return (
      <aside className="h-full rounded-r-[18px] border-l border-gray-200 bg-white px-7 md:px-8 py-6 flex flex-col">
        <h3 className="text-[22px] font-semibold text-gray-900 text-center">
          {safeBasics.title || "Research"}
        </h3>
        <p className="mt-3 mb-5 text-center text-[12px] leading-relaxed text-gray-600">
          {safeBasics.description ||
            "Process the top 20 Google search results for your keyword."}
        </p>

        <div className="mx-auto w-full max-w-[420px]">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => onQueryChange?.(e.target.value)}
              placeholder={
                safeBasics.placeholder ||
                currentPage?.primaryKeyword?.trim() ||
                "Enter search query"
              }
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-8 pr-10 text-sm outline-none focus:border-blue-300"
            />
            <SearchIcon size={14} className="absolute left-2 top-2.5 text-gray-500" />
            <button
              type="button"
              aria-label="Query settings"
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            >
              <Settings size={14} />
            </button>
          </div>

          <button
            onClick={handleStart}
            className="mt-5 mx-auto block rounded-full border border-blue-300 px-6 py-2 text-[12px] font-medium text-blue-600 hover:bg-blue-50"
          >
            Start
          </button>
        </div>
      </aside>
    );
  }

  /* ---------- PHASE: searching ---------- */
  if (phase === "searching") {
    return (
      <aside className="h-full rounded-r-[18px] border-l border-gray-200 bg-white px-6 md:px-7 py-6">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          Searching
          <Pill tone="info">Reference found</Pill>
        </div>

        <div className="mt-4 text-[12px] text-gray-900 font-semibold">
          {query?.trim() ||
            currentPage?.ui?.query ||
            currentPage?.primaryKeyword ||
            "Content marketing strategies"}
        </div>

        <div className="mt-3 space-y-2">
          {SEARCH_STEPS.map((text, i) => {
            const status = doneMap[i] ? "done" : i === activeIndex ? "active" : "todo";
            return <StepRow key={i} status={status} text={text} />;
          })}
        </div>
      </aside>
    );
  }

  /* ---------- PHASE: results ---------- */
  return (
    <aside className="h-full rounded-r-[18px] border-l border-gray-200 bg-white px-6 md:px-7 py-6 flex flex-col gap-3">
      {cfgLoading && (
        <div className="rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-700">
          Loading SEO basics…
        </div>
      )}
      {cfgError && (
        <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          Failed to load data: {cfgError}
        </div>
      )}

      {!cfgLoading && !cfgError && (
        <>
          <div className="mb-1 flex items-center gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2">
            <TriangleAlert size={16} className="text-amber-700" />
            <div className="text-[12px] font-medium text-amber-800">Fix this</div>
            <div className="ml-auto text-[10px] text-amber-800/80">
              Once done, switch to ADVANCE for deep research
            </div>
          </div>

          {/* BASIC SEO from JSON: seoBasics.basicSEO[] */}
          <Section
            icon={ListChecks}
            title="Basic SEO"
            statusTone="good"
            statusText={
              safeBasics.basicSEO?.length ? "All Good" : "No Data"
            }
            defaultOpen
          >
            <div className="space-y-1.5">
              {(safeBasics.basicSEO?.length
                ? safeBasics.basicSEO
                : [
                    "Write a unique, descriptive title with the primary keyword once.",
                    "Use one H1, logical H2/H3 hierarchy, and scannable lists.",
                    "Add meta description with clear benefit and CTA.",
                  ]
              ).map((line, i) => (
                <ResultItem key={i} type="success">
                  {line}
                </ResultItem>
              ))}
            </div>
          </Section>

          {/* ADDITIONAL from JSON: seoBasics.additional[] */}
          <Section
            icon={TriangleAlert}
            title="Additional"
            statusTone={safeBasics.additional?.length ? "warn" : "default"}
            statusText={
              safeBasics.additional?.length
                ? `${safeBasics.additional.length} Tips`
                : "No Data"
            }
            defaultOpen
          >
            <div className="space-y-1.5">
              {(safeBasics.additional || []).map((line, i) => (
                <ResultItem
                  key={i}
                  type="warning"
                  onFix={onFix ? () => onFix(`additional-${i}`) : undefined}
                >
                  {line}
                </ResultItem>
              ))}

              {/* explicit “Fix Now” examples kept */}
              <ResultItem type="error" onFix={() => onFix?.("title-dup-keyword")}>
                The focus keyword appears twice in the title, which may look spammy. —{" "}
                <span className="font-medium">Revise to use it only once.</span>
              </ResultItem>
              <ResultItem type="error" onFix={() => onFix?.("meta-variation-missing")}>
                Missing Keyword Variation in Meta Description.
              </ResultItem>
              <ResultItem type="error" onFix={() => onFix?.("slug-shorten")}>
                Your URL includes unnecessary words:{" "}
                <span className="font-mono text-[12px]">
                  /best-seo-tools-2025-for-digital-marketing-guide/
                </span>
                . Shorten it.
              </ResultItem>
              <ResultItem
                type="error"
                onFix={() =>
                  onPasteToEditor?.(
                    "Add a clear statement about how these tools improve rankings."
                  )
                }
              >
                The first paragraph does not directly address the user’s search intent.
              </ResultItem>
            </div>
          </Section>

          {/* TITLE READABILITY from JSON */}
          <Section
            icon={List}
            title="Title Readability"
            statusTone="good"
            statusText={
              safeBasics.titleReadability?.score != null
                ? `Score ${safeBasics.titleReadability.score}`
                : "No Score"
            }
            defaultOpen={false}
          >
            <div className="space-y-1.5">
              {(safeBasics.titleReadability?.notes || []).map((n, i) => (
                <ResultItem key={i} type="success">
                  {n}
                </ResultItem>
              ))}
              {safeBasics.titleReadability?.expansion ? (
                <div
                  className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-[12px] text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: safeBasics.titleReadability.expansion,
                  }}
                />
              ) : null}
            </div>
          </Section>

          {/* CONTENT READABILITY from JSON */}
          <Section
            icon={List}
            title="Content Readability"
            statusTone="good"
            statusText={
              safeBasics.contentReadability?.score != null
                ? `Score ${safeBasics.contentReadability.score}`
                : "No Score"
            }
            defaultOpen={false}
          >
            <div className="space-y-1.5">
              {(safeBasics.contentReadability?.notes || []).map((n, i) => (
                <ResultItem key={i} type="success">
                  {n}
                </ResultItem>
              ))}
              {safeBasics.contentReadability?.expansion ? (
                <div
                  className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-[12px] text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: safeBasics.contentReadability.expansion,
                  }}
                />
              ) : null}
            </div>
          </Section>
        </>
      )}
    </aside>
  );
}
