"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Search as SearchIcon,
  X,
  Copy as CopyIcon,
} from "lucide-react";

function IconHintButton({
  onClick,
  label = "Paste to editor",
  size = 18,
  className = "",
}) {
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(e);
    }
  };

  return (
    <div
      className={[
        "relative",
        "opacity-0 pointer-events-none transition-opacity duration-150",
        "group-hover:opacity-100 group-hover:pointer-events-auto",
        className,
      ].join(" ")}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-label={label}
        className="p-0 m-0 inline-flex items-center justify-center leading-none align-middle focus:outline-none h-8 w-8"
      >
        <CopyIcon
          size={size}
          strokeWidth={1.25}
          className="text-gray-500 opacity-90 hover:text-gray-600 transition-colors"
        />
      </div>
      <span
        className="pointer-events-none absolute -top-7 right-0 rounded-md border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm opacity-0 transition-opacity duration-75 whitespace-nowrap
                   group-hover:opacity-100 group-focus-within:opacity-100
                   dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)]"
      >
        {label}
      </span>
    </div>
  );
}

function BadgeScore({ score }) {
  const tone =
    score >= 15
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-700/60"
      : score >= 10
      ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700"
      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-700/60";

  return (
    <span
      className={`inline-flex h-8 min-w-[34px] items-center justify-center rounded-md border px-1.5 text-[12px] font-semibold ${tone}`}
    >
      {score}
    </span>
  );
}

/**
 * Safely derive a hostname for favicon lookup.
 * Accepts "https://domain.com/...", "domain.com", etc.
 */
function getFaviconHostname(domainOrUrl) {
  if (!domainOrUrl) return "";
  try {
    const hasProtocol = /^https?:\/\//i.test(domainOrUrl);
    const url = new URL(hasProtocol ? domainOrUrl : `https://${domainOrUrl}`);
    return url.hostname;
  } catch {
    return domainOrUrl.split("/")[0];
  }
}

// Custom loader so next/image doesn't enforce domains for favicons
const faviconLoader = ({ src }) => src;

function LinkRow({ rankScore, domain, sources, onPaste }) {
  const hostname = getFaviconHostname(domain);
  const faviconUrl = hostname
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        hostname
      )}&sz=64`
    : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-whiteshadow-sm dark:bg-[var(--bg-panel)]">
      <button
        type="button"
        className="group w-full px-4 py-3 flex items-center justify-between gap-3 text-left rounded-2xl hover:bg-gray-50 dark:hover:bg-[var(--bg-hover)]"
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* Favicon instead of numeric badge */}
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-neutral-800 overflow-hidden">
            {faviconUrl ? (
              <Image
                loader={faviconLoader}
                src={faviconUrl}
                alt={hostname || domain || "site icon"}
                width={18}
                height={18}
                className="rounded-sm"
                unoptimized
              />
            ) : (
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                {domain?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
              {domain}
            </div>
            <div className="text-[11.5px] text-gray-500 dark:text-[var(--muted)]">
              Links : {sources}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <IconHintButton
            onClick={(e) => {
              e.stopPropagation();
              onPaste?.(domain);
            }}
          />
          <ChevronRight
            size={18}
            className="text-gray-400 dark:text-[var(--muted)]"
          />
        </div>
      </button>
    </div>
  );
}

function DrawerHeader({ title, onClose, countText }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[13px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
          {title}
        </div>
        {countText ? (
          <div className="text-[11px] text-gray-500 dark:text-[var(--muted)] mt-0.5">
            {countText}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 dark:text-[var(--muted)] dark:hover:text-[var(--text-primary)]"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* ===========================
   Helper: derive links from seoData (DataForSEO)
   =========================== */

function deriveLinksFromSeoData(seoData) {
  const result = {
    externalRows: [],
    internalRows: [],
    externalTotal: 0,
    totalDomains: 0,
  };

  if (!seoData || !seoData.dataForSeo) return result;

  const dfs = seoData.dataForSeo;

  const candidates = [];

  // Try several likely shapes from DataForSEO-style data
  if (Array.isArray(dfs.backlinkDomains)) candidates.push(...dfs.backlinkDomains);
  if (Array.isArray(dfs.backlinksDomains)) candidates.push(...dfs.backlinksDomains);
  if (Array.isArray(dfs.topBacklinksDomains)) candidates.push(...dfs.topBacklinksDomains);
  if (Array.isArray(dfs.backlinks)) candidates.push(...dfs.backlinks);
  if (Array.isArray(dfs.externalLinks)) candidates.push(...dfs.externalLinks);

  const seen = new Set();
  let totalLinks = 0;

  const rows = [];

  for (const row of candidates) {
    const domain =
      row.domain ||
      row.target ||
      row.target_url ||
      row.targetUrl ||
      row.referring_domain ||
      row.url ||
      row.host ||
      "";

    const key = String(domain || "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const sources =
      row.backlinks_count ??
      row.backlinks ??
      row.links ??
      row.external_links ??
      row.total ??
      row.count ??
      row.referring_pages ??
      0;

    const rankScore =
      row.rankScore ??
      row.score ??
      row.domain_rank ??
      row.page_rank ??
      row.rating ??
      0;

    totalLinks += Number(sources) || 0;

    rows.push({
      domain,
      sources: Number(sources) || 0,
      rankScore: Number(rankScore) || 0,
    });
  }

  result.externalRows = rows;
  result.externalTotal =
    typeof dfs.externalTotal === "number"
      ? dfs.externalTotal
      : totalLinks || rows.length;

  result.totalDomains =
    typeof dfs.totalDomains === "number"
      ? dfs.totalDomains
      : rows.length;

  // Internal links are usually page-level; if you later add them to /api/seo,
  // you can map them here.
  result.internalRows = Array.isArray(dfs.internalLinks)
    ? dfs.internalLinks.map((r) => ({
        domain: r.url || r.path || "",
        sources: r.count ?? r.links ?? 0,
        rankScore: r.rankScore ?? 0,
      }))
    : [];

  return result;
}

/* ===========================
   Main component
   =========================== */

export default function SeoAdvancedLinks({
  onPasteToEditor,
  // unified SEO pipeline from /api/seo
  seoData,
  seoLoading,
  seoError,
}) {
  const [kwFilter, setKwFilter] = useState("");
  const [linkTab, setLinkTab] = useState("external");

  // Only care about SEO API now
  const loading = !!seoLoading;
  const error = seoError || "";

  // Derive links from /api/seo (DataForSEO) once
  const apiLinks = useMemo(
    () => deriveLinksFromSeoData(seoData || {}),
    [seoData]
  );

  // External vs internal rows from API only
  const externalRowsRaw = apiLinks.externalRows || [];
  const internalRowsRaw = apiLinks.internalRows || [];

  // Totals (external card)
  const externalTotal =
    (apiLinks.externalTotal && apiLinks.externalTotal > 0
      ? apiLinks.externalTotal
      : externalRowsRaw.length) || 0;

  const totalDomains =
    (apiLinks.totalDomains && apiLinks.totalDomains > 0
      ? apiLinks.totalDomains
      : new Set(
          externalRowsRaw
            .map((r) => r.domain || r.url || r.targetUrl || "")
            .filter(Boolean)
        ).size || externalRowsRaw.length) || 0;

  const rowsRaw = linkTab === "external" ? externalRowsRaw : internalRowsRaw;

  // Normalize to the shape LinkRow expects
  const rows = rowsRaw.map((r) => ({
    rankScore:
      r.rankScore ??
      r.value ??
      r.rank ??
      r.score ??
      r.domain_rank ??
      r.page_rank ??
      0,
    domain: r.domain ?? r.url ?? r.targetUrl ?? r.path ?? "",
    sources:
      r.links ??
      r.linkCount ??
      r.count ??
      r.total ??
      r.sources ??
      r.source ??
      r.backlinks_count ??
      r.backlinks ??
      r.external_links ??
      r.referring_pages ??
      0,
  }));

  const filtered = rows.filter((r) =>
    (r.domain || "").toLowerCase().includes(kwFilter.trim().toLowerCase())
  );

  return (
    <div className="mt-1 rounded-2xl border border-[var(--border)] bg-white p-4 dark:bg-[var(--bg-panel)]">
      <div className="flex items-center gap-6 border-b border-[var(--border)] px-1">
        <button
          type="button"
          onClick={() => setLinkTab("external")}
          className={`relative px-1 pb-2 text-[13px] font-semibold transition-colors ${
            linkTab === "external"
              ? "text-gray-900 dark:text-[var(--text-primary)]"
              : "text-gray-500 dark:text-[var(--muted)]"
          }`}
        >
          External Link
          {linkTab === "external" && (
            <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] rounded-full bg-amber-400" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setLinkTab("internal")}
          className={`relative px-1 pb-2 text-[13px] font-semibold transition-colors ${
            linkTab === "internal"
              ? "text-gray-900 dark:text-[var(--text-primary)]"
              : "text-gray-500 dark:text-[var(--muted)]"
          }`}
        >
          Internal link
          {linkTab === "internal" && (
            <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] rounded-full bg-amber-400" />
          )}
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-gray-100/80 px-4 py-3 text-gray-800 shadow-inner dark:bg-[var(--bg-hover)] dark:text-[var(--text-primary)]">
        <div className="text-[28px] leading-7 font-extrabold">
          {externalTotal}
        </div>
        <div className="text-[12px] mt-0.5 text-gray-600 dark:text-[var(--muted)]">
          Number of External Links
        </div>
        <div className="text-[12px] mt-1 text-gray-600 dark:text-[var(--muted)]">
          Top search results link to pages from{" "}
          <span className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">
            {totalDomains} domains
          </span>
        </div>
      </div>

      <div className="relative mt-3">
        <input
          className="w-full h-10 rounded-xl border border-[var(--border)] bg-white px-9 text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-amber-400 dark:bg-[var(--bg-panel)] dark:text-[var(--text-primary)] dark:placeholder-[var(--muted)]"
          placeholder="Filter by keywords"
          value={kwFilter}
          onChange={(e) => setKwFilter(e.target.value)}
        />
        <SearchIcon
          size={14}
          className="absolute left-3 top-[11px] text-gray-400 dark:text-[var(--muted)]"
        />
      </div>

      <div className="mt-3 space-y-3">
        {loading && (
          <div className="text-[12px] text-gray-500 dark:text-[var(--muted)]">
            Loading link data…
          </div>
        )}
        {!loading && error && (
          <div className="text-[12px] text-rose-600">
            Failed to load: {error}
          </div>
        )}
        {!loading &&
          !error &&
          filtered.map((r, idx) => (
            <LinkRow
              key={idx}
              {...r}
              onPaste={(text) => onPasteToEditor?.(text)}
            />
          ))}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-[12px] text-gray-500 dark:text-[var(--muted)] px-1 py-2">
            No links match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
