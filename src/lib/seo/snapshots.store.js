// src/lib/seo/snapshots.store.js
import { randomUUID } from "crypto";

const g = globalThis;

// Keep state across hot reloads in dev
if (!g.__drfizzStore) {
  g.__drfizzStore = {
    scansById: new Map(),
    opportunitiesByHost: new Map(),
    // key: `${hostname}::${mode}::sub=0|1` -> { updatedAt, scanId, status, diagnostics, blogs, pages, allowSubdomains }
  };
}

const store = g.__drfizzStore;

function normHost(hostname = "") {
  return String(hostname).replace(/^www\./, "").toLowerCase().trim();
}

function normMode(mode = "published") {
  return mode === "draft" ? "draft" : "published";
}

function hostKey(hostname, { mode = "published", allowSubdomains = false } = {}) {
  const h = normHost(hostname);
  const m = normMode(mode);
  const sub = allowSubdomains ? 1 : 0;
  return `${h}::${m}::sub=${sub}`;
}

export function createScan({
  kind,
  websiteUrl,
  hostname,
  allowSubdomains = false,
  mode = "published", // "published" | "draft"
  provider = null, // optional: wordpress/shopify/webflow
} = {}) {
  const scanId = randomUUID();

  const scan = {
    scanId,
    kind: kind || "opportunities",
    websiteUrl: websiteUrl || "",
    hostname: normHost(hostname),
    allowSubdomains: Boolean(allowSubdomains),
    mode: normMode(mode),
    provider: provider || null,

    status: "queued", // queued | running | complete | failed
    createdAt: new Date().toISOString(),
    diagnostics: null,
    error: null,
  };

  store.scansById.set(scanId, scan);
  return scan;
}

export function getScan(scanId) {
  return store.scansById.get(scanId) || null;
}

export function completeScan(scanId, { hostname, diagnostics } = {}) {
  const scan = store.scansById.get(scanId);
  if (!scan) return null;

  scan.status = "complete";
  if (hostname) scan.hostname = normHost(hostname);
  scan.diagnostics = diagnostics ?? scan.diagnostics ?? null;

  store.scansById.set(scanId, scan);
  return scan;
}

export function failScan(scanId, { error, diagnostics } = {}) {
  const scan = store.scansById.get(scanId);
  if (!scan) return null;

  scan.status = "failed";
  scan.error = error || "failed";
  if (diagnostics) scan.diagnostics = diagnostics;

  store.scansById.set(scanId, scan);
  return scan;
}

export function upsertOpportunitiesSnapshot(hostname, payload = {}) {
  const h = normHost(hostname);
  const mode = normMode(payload.mode);
  const allowSubdomains = Boolean(payload.allowSubdomains);

  const key = hostKey(h, { mode, allowSubdomains });

  const prev = store.opportunitiesByHost.get(key);
  const updatedAt = Date.now();

  const normItems = (arr, isDraft) =>
    (Array.isArray(arr) ? arr : []).map((x) => ({
      // ✅ spread first, then normalize so normalized fields WIN
      ...(x || {}),
      url: x?.url || "",
      title: x?.title || "",
      description: x?.description || "",
      wordCount: Number(x?.wordCount) || 0,
      isDraft: Boolean(isDraft),
    }));

  const next = {
    updatedAt,
    scanId: payload.scanId || prev?.scanId || null,
    status: payload.status || prev?.status || "complete",
    diagnostics: payload.diagnostics ?? prev?.diagnostics ?? null,
    mode,
    allowSubdomains,

    blogs: normItems(payload.blogs, mode === "draft"),
    pages: normItems(payload.pages, mode === "draft"),
  };

  store.opportunitiesByHost.set(key, { ...(prev || {}), ...next });
}

export function getLatestOpportunities(
  hostname,
  {
    ttlMs = 24 * 60 * 60 * 1000,
    mode = "published",
    allowSubdomains = false,
  } = {}
) {
  const key = hostKey(hostname, { mode, allowSubdomains });
  const snap = store.opportunitiesByHost.get(key);
  if (!snap) return null;

  const age = Date.now() - (snap.updatedAt || 0);
  if (age > ttlMs) return null;

  const scan = snap.scanId ? getScan(snap.scanId) : null;

  return {
    scan: scan
      ? {
          scanId: scan.scanId,
          status: scan.status,
          diagnostics: scan.diagnostics,
          mode: scan.mode,
          provider: scan.provider || null,
          allowSubdomains: scan.allowSubdomains,
        }
      : {
          scanId: snap.scanId || null,
          status: snap.status || "complete",
          diagnostics: snap.diagnostics || null,
          mode: snap.mode || normMode(mode),
          provider: null,
          allowSubdomains: Boolean(snap.allowSubdomains),
        },
    blogs: Array.isArray(snap.blogs) ? snap.blogs : [],
    pages: Array.isArray(snap.pages) ? snap.pages : [],
  };
}
