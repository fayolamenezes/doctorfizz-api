"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Monitor,
  Smartphone,
  Copy,
  Link2,
  Hash,
  Plus,
  X,
  Info,
  Wand2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Circle,
} from "lucide-react";

/**
 * RankMath-inspired SEO panel (JS version)
 */

const PANEL_HEIGHT = 700; // <- fixed internal scroll height (px). Change as needed.

const SUGGESTED_KEYWORDS = [
  "blogging",
  "platform",
  "best",
  "wordpress",
  "seo",
  "tutorial",
  "2025",
  "guide",
  "free",
  "beginners",
];

const avgPxPerChar = (font) => (font === "title" ? 9.5 : font === "desc" ? 6.5 : 8);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function titleCase(input) {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      ["a", "an", "the", "and", "or", "but", "for", "nor", "to", "of", "in", "on", "at", "by"].includes(w) && i !== 0
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}

function sentenceCase(input) {
  const s = (input || "").trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slugify(input) {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function pxEstimate(text, type) {
  return Math.round((text || "").length * avgPxPerChar(type));
}

function meterState(val, goodMin, goodMax) {
  if (val < goodMin) return "warn";
  if (val > goodMax) return "bad";
  return "good";
}

function Bar({ value, max, state }) {
  const pct = clamp((value / max) * 100, 0, 100);
  const color =
    state === "good" ? "bg-emerald-500" : state === "warn" ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-200">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FieldHeader({ label, right, meta }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-gray-900">{label}</span>
        {meta}
      </div>
      {right}
    </div>
  );
}

function IconButton({ title, onClick, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function useUndoable(initial) {
  const [value, setValue] = useState(initial);
  const [prev, setPrev] = useState(null);
  const set = (v) => {
    setPrev(value);
    setValue(v);
  };
  const undo = () => prev !== null && setValue(prev);
  return { value, set, undo, prev };
}

export default function SeoDetails() {
  // --- State
  const [device, setDevice] = useState("desktop");
  const [domain] = useState("https://demo.rankmath.com");
  const [path, setPath] = useState("/best-blogging-platform/");

  const title = useUndoable("How to Choose the Best Blogging Platform in 2025");
  const description = useUndoable(
    "Check out the best blogging platforms for 2025 with their detailed features — WordPress, Drupal, Wix, Squarespace, Blogger, Ghost and more."
  );
  const permalink = useUndoable(
    "A journal of curious thoughts, quiet travels, and unexpected discoveries."
  );

  const [keywords, setKeywords] = useState(["Blogging", "Platform", "Best"]);
  const [kwDraft, setKwDraft] = useState("");

  const [pillar, setPillar] = useState(false);
  const primaryKeyword = keywords[0] || "";

  // --- Meters
  const titleChars = title.value.length;
  const titlePx = pxEstimate(title.value, "title");
  const titleState = meterState(titleChars, 45, 60);

  const slug = useMemo(() => slugify(permalink.value || title.value), [permalink.value, title.value]);
  const slugPx = pxEstimate(slug, "slug");
  const slugState = meterState(slug.length, 20, 75);

  const descChars = description.value.length;
  const descPx = pxEstimate(description.value, "desc");
  const descState = meterState(descChars, 120, 160);

  // --- Helpers
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied!");
    } catch {
      alert(text);
    }
  };

  // stable for ESLint deps
  const includePrimaryIn = useCallback(
    (s) => primaryKeyword && !new RegExp(`\\b${primaryKeyword}\\b`, "i").test(s || ""),
    [primaryKeyword]
  );

  // --- Generators (local heuristics)
  const generateTitle = () => {
    const base = titleCase(
      `${primaryKeyword || "Blogging"} Platforms Compared: ${new Date().getFullYear()} Guide`
    );
    title.set(base);
  };

  const improveTitle = () => {
    const t = title.value;
    let improved = titleCase((t || "").replace(/\s+/g, " ").trim());
    if (includePrimaryIn(improved)) improved = `${primaryKeyword} — ${improved}`;
    if (!/(\d{4})/.test(improved)) improved += ` (${new Date().getFullYear()})`;
    title.set(improved);
  };

  const generateSlug = () => {
    const s = slugify(primaryKeyword ? `${primaryKeyword} ${title.value}` : title.value);
    permalink.set(s);
  };

  const generateDescription = () => {
    const year = new Date().getFullYear();
    const kw = primaryKeyword ? `${primaryKeyword.toLowerCase()} ` : "";
    const crafted = sentenceCase(
      `Discover the best ${kw}platforms in ${year} with pros, cons, pricing, and ideal use cases — including WordPress, Wix, Squarespace, and more`
    );
    description.set(crafted);
  };

  // --- Lint: Title corrections (deps trimmed)
  const titleIssues = useMemo(() => {
    const tVal = title.value; // use a local alias
    const issues = [];
    if (/[a-z]/.test(tVal) && tVal === tVal.toLowerCase()) {
      issues.push({
        id: "titlecase",
        label: "Apply Title Case",
        apply: () => title.set(titleCase(tVal)),
      });
    }
    if (includePrimaryIn(tVal)) {
      issues.push({
        id: "kw",
        label: `Include primary keyword “${primaryKeyword}”`,
        apply: () => title.set(`${tVal} | ${primaryKeyword}`),
      });
    }
    if (tVal.length > 60) {
      issues.push({
        id: "trim",
        label: "Trim length to under ~60 characters",
        apply: () => title.set(tVal.slice(0, 60).replace(/\s+\S*$/, "")),
      });
    }
    if (!/(\d{4})/.test(tVal)) {
      issues.push({
        id: "fresh",
        label: "Add current year for freshness",
        apply: () => title.set(`${tVal} (${new Date().getFullYear()})`),
      });
    }
    return issues;
  }, [primaryKeyword, includePrimaryIn, title]); // <-- no 'title.value' here, and 'title' is used (title.set)

  // --- Keyword input handlers
  const addKeyword = (k) => {
    const cleaned = titleCase((k || "").trim());
    if (!cleaned) return;
    setKeywords((prev) => {
      if (prev.find((p) => p.toLowerCase() === cleaned.toLowerCase())) return prev;
      return [...prev, cleaned];
    });
    setKwDraft("");
  };

  const removeKeyword = (k) =>
    setKeywords((prev) => prev.filter((p) => p.toLowerCase() !== (k || "").toLowerCase()));

  const kwSuggestions = useMemo(() => {
    const pool = Array.from(
      new Set(
        [...SUGGESTED_KEYWORDS, ...title.value.toLowerCase().split(/\W+/)].filter(Boolean)
      )
    );
    return pool
      .filter(
        (s) =>
          s.startsWith((kwDraft || "").toLowerCase()) &&
          !keywords.map((k) => k.toLowerCase()).includes(s.toLowerCase())
      )
      .slice(0, 6);
  }, [kwDraft, keywords, title.value]);

  // Auto-update path preview when slug changes
  useEffect(() => {
    setPath(`/${slug}/`);
  }, [slug]);

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white text-[12px] text-gray-600 shadow-sm"
      style={{ height: PANEL_HEIGHT, overflowY: "auto", padding: 16, paddingRight: 12 }}
    >
      {/* SERP Preview Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[18px] font-semibold text-gray-900">SEO Details</div>
        <div className="flex items-center gap-2">
          <IconButton title="Desktop preview" onClick={() => setDevice("desktop")}>
            <Monitor className={`h-4 w-4 ${device === "desktop" ? "text-emerald-600" : ""}`} />
          </IconButton>
          <IconButton title="Mobile preview" onClick={() => setDevice("mobile")}>
            <Smartphone className={`h-4 w-4 ${device === "mobile" ? "text-emerald-600" : ""}`} />
          </IconButton>
        </div>
      </div>

      {/* SERP Preview Card */}
      <div className="mb-6 rounded-xl border border-gray-200 p-4">
        <div className="mb-2 text-gray-500">
          {domain}
          {path}
        </div>
        <div className="mb-2 text-[20px] font-semibold leading-snug text-[#1a0dab]">
          {title.value}
        </div>
        <div className="text-[13px] leading-relaxed">{description.value}</div>
      </div>

      {/* Focus Keywords */}
      <div className="mb-6 rounded-xl border border-gray-200 p-4">
        <FieldHeader
          label="Focus Keywords"
          meta={
            <span
              title="Pick 3–5 main keywords to target."
              className="inline-flex items-center text-gray-400"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <IconButton
                title="Auto-suggest from title"
                onClick={() => {
                  const words = Array.from(
                    new Set(
                      title.value
                        .split(/\W+/)
                        .filter((w) => w.length > 3 && isNaN(Number(w)))
                    )
                  );
                  setKeywords(words.slice(0, 5).map(titleCase));
                }}
              >
                <Sparkles className="h-4 w-4" />
                Suggest
              </IconButton>
              <IconButton title="Copy keywords" onClick={() => copy(keywords.join(", "))}>
                <Copy className="h-4 w-4" />
                Copy
              </IconButton>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {keywords.map((k, i) => (
            <span
              key={k}
              className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] ${
                i === 0 ? "ring-1 ring-emerald-600 text-emerald-700" : "text-emerald-700"
              }`}
              title={i === 0 ? "Primary keyword" : undefined}
            >
              <Hash className="h-3 w-3" />
              {k}
              <button
                onClick={() => removeKeyword(k)}
                className="ml-1 rounded p-0.5 hover:bg-emerald-100"
                aria-label={`Remove ${k}`}
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <div className="relative">
            <div className="flex items-center rounded-full border border-gray-200 bg-white px-2">
              <Plus className="h-4 w-4 text-gray-400" />
              <input
                value={kwDraft}
                onChange={(e) => setKwDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword(kwDraft);
                  }
                }}
                placeholder="Add…"
                className="w-40 bg-transparent p-1 text-[12px] outline-none"
                aria-label="Add focus keyword"
              />
            </div>
            {kwDraft && kwSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {kwSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addKeyword(s)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] hover:bg-gray-50"
                  >
                    <Hash className="h-3.5 w-3.5 text-gray-400" />
                    {titleCase(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={pillar}
              onChange={() => setPillar((p) => !p)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-[12px] text-gray-700">This post is Pillar content</span>
            <Info
              title="Mark long-form, evergreen resources as Pillar to prioritize internal links."
              className="h-3.5 w-3.5 text-gray-400"
            />
          </label>
        </div>
      </div>

      {/* Title */}
      <div className="mb-6 rounded-xl border border-gray-200 p-4">
        <FieldHeader
          label="Title"
          meta={
            <span className="ml-2 text-gray-400">
              {titleChars} / 60 ({titlePx}px / 580px)
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <IconButton title="Undo" onClick={title.undo} disabled={!title.prev}>
                <RefreshCw className="h-4 w-4" />
                Undo
              </IconButton>
              <IconButton title="Copy Title" onClick={() => copy(title.value)}>
                <Copy className="h-4 w-4" />
                Copy
              </IconButton>
            </div>
          }
        />

        <input
          value={title.value}
          onChange={(e) => title.set(e.target.value)}
          className="mb-2 w-full rounded-lg border border-gray-200 bg-white p-3 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500"
          placeholder="How to Choose the Best Blogging Platform in 2025 — RankMath…"
        />
        <Bar value={titleChars} max={70} state={titleState} />

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200">
            <div className="flex items-center gap-4 border-b border-gray-100 px-3 py-2 text-gray-700">
              <span className="text-[12px] font-medium text-emerald-700">Check Correction</span>
            </div>
            <div className="p-3">
              {/** titleIssues */}
              {titleIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Looks great! No suggestions.
                </div>
              ) : (
                titleIssues.map((it) => (
                  <label key={it.id} className="mb-2 flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      onChange={(e) => e.target.checked && it.apply?.()}
                    />
                    <span className="text-[12px]">{it.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200">
            <div className="flex items-center gap-4 border-b border-gray-100 px-3 py-2 text-gray-700">
              <span className="text-[12px] font-medium">Generate AI title</span>
            </div>
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="text-[12px] text-gray-500">Create a fresh, keyword-rich title.</div>
              <div className="flex gap-2">
                <IconButton title="Improve current" onClick={improveTitle}>
                  <Wand2 className="h-4 w-4" />
                  Improve
                </IconButton>
                <IconButton title="Generate new" onClick={generateTitle}>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Permalink */}
      <div className="mb-6 rounded-xl border border-gray-200 p-4">
        <FieldHeader
          label="Permalink"
          meta={
            <span className="ml-2 text-gray-400">
              {slug.length} / 80 ({slugPx}px / 580px)
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <IconButton title="Undo" onClick={permalink.undo} disabled={!permalink.prev}>
                <RefreshCw className="h-4 w-4" />
                Undo
              </IconButton>
              <IconButton title="Copy URL" onClick={() => copy(`${domain}/${slug}`)}>
                <Link2 className="h-4 w-4" />
                Copy URL
              </IconButton>
            </div>
          }
        />

        <input
          value={permalink.value}
          onChange={(e) => permalink.set(e.target.value)}
          placeholder="Write a human-readable slug or leave blank to generate from title…"
          className="mb-2 w-full rounded-lg border border-gray-200 bg-white p-3 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500"
        />
        <div className="mb-2 text-[12px] text-gray-500">
          Preview: <span className="font-medium text-gray-800">{domain}/{slug}</span>
        </div>
        <Bar value={slug.length} max={80} state={slugState} />

        <div className="mt-3 flex flex-wrap gap-2">
          <IconButton title="Slugify from title" onClick={generateSlug}>
            <Wand2 className="h-4 w-4" />
            Generate slug
          </IconButton>
          <IconButton
            title="Append primary keyword"
            onClick={() => permalink.set(`${slug}-${slugify(primaryKeyword || "")}`)}
            disabled={!primaryKeyword}
          >
            <Hash className="h-4 w-4" />
            Add keyword
          </IconButton>
        </div>
      </div>

      {/* Description */}
      <div className="mb-2 rounded-xl border border-gray-200 p-4">
        <FieldHeader
          label="Description"
          meta={
            <span className="ml-2 text-gray-400">
              {descChars} / 160 ({descPx}px / 920px)
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <IconButton title="Undo" onClick={description.undo} disabled={!description.prev}>
                <RefreshCw className="h-4 w-4" />
                Undo
              </IconButton>
              <IconButton title="Copy Description" onClick={() => copy(description.value)}>
                <Copy className="h-4 w-4" />
                Copy
              </IconButton>
            </div>
          }
        />

        <textarea
          value={description.value}
          onChange={(e) => description.set(e.target.value)}
          rows={3}
          placeholder="Short, compelling summary that includes your main keyword…"
          className="mb-2 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500"
        />
        <Bar value={descChars} max={170} state={descState} />

        <div className="mt-3 flex flex-wrap gap-2">
          <IconButton
            title="Lightly improve description"
            onClick={() =>
              description.set(sentenceCase(description.value.replace(/\s+/g, " ").trim()))
            }
          >
            <Wand2 className="h-4 w-4" />
            Improve
          </IconButton>
          <IconButton title="Generate new description" onClick={generateDescription}>
            <Sparkles className="h-4 w-4" />
            Generate
          </IconButton>
        </div>

        {includePrimaryIn(description.value) && primaryKeyword && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
            <Circle className="h-3.5 w-3.5" />
            Consider including your primary keyword “{primaryKeyword}” in the description.
          </div>
        )}
      </div>
    </div>
  );
}
