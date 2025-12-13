// src/lib/seo/snapshots.store.js

import { randomUUID } from "crypto";

const g = globalThis;

// Keep state across hot reloads in dev
if (!g.__drfizzStore) {
  g.__drfizzStore = {
    scansById: new Map(),
    opportunitiesByHost: new Map(), // hostname -> { updatedAt, scanId, status, diagnostics, blogs, pages }
  };
}

const store = g.__drfizzStore;

export function createScan({ kind, websiteUrl, hostname, allowSubdomains = false }) {
  const scanId = randomUUID();
  const scan = {
    scanId,
    kind,
    websiteUrl,
    hostname,
    allowSubdomains,
    status: "queued",
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
  scan.diagnostics = diagnostics || scan.diagnostics || null;
  scan.hostname = hostname || scan.hostname;
  store.scansById.set(scanId, scan);
  return scan;
}

export function failScan(scanId, { error } = {}) {
  const scan = store.scansById.get(scanId);
  if (!scan) return null;
  scan.status = "failed";
  scan.error = error || "failed";
  store.scansById.set(scanId, scan);
  return scan;
}

export function upsertOpportunitiesSnapshot(hostname, payload) {
  const prev = store.opportunitiesByHost.get(hostname);
  const updatedAt = Date.now();

  const next = {
    updatedAt,
    scanId: payload.scanId,
    status: payload.status || "complete",
    diagnostics: payload.diagnostics || null,
    blogs: Array.isArray(payload.blogs) ? payload.blogs : [],
    pages: Array.isArray(payload.pages) ? payload.pages : [],
  };

  // prefer latest write
  store.opportunitiesByHost.set(hostname, { ...(prev || {}), ...next });
}

export function getLatestOpportunities(hostname, { ttlMs = 24 * 60 * 60 * 1000 } = {}) {
  const snap = store.opportunitiesByHost.get(hostname);
  if (!snap) return null;

  const age = Date.now() - (snap.updatedAt || 0);
  if (age > ttlMs) return null;

  return {
    scan: {
      scanId: snap.scanId,
      status: snap.status,
      diagnostics: snap.diagnostics,
    },
    blogs: snap.blogs || [],
    pages: snap.pages || [],
  };
}
