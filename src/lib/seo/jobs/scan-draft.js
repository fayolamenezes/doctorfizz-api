// src/lib/seo/jobs/scan-draft.js
import { renderDraft } from "@/lib/seo/providers";
import { extractSeoData } from "@/lib/seo/extraction";
import {
  createScan,
  completeScan,
  failScan,
  upsertOpportunitiesSnapshot,
} from "@/lib/seo/snapshots.store";

export function enqueueDraftScan({ hostname, provider, payload } = {}) {
  const h = String(hostname || "").trim();
  const p = String(provider || "").trim();
  if (!h) throw new Error("hostname is required");
  if (!p) throw new Error("provider is required");
  if (!payload) throw new Error("payload is required");

  const scan = createScan({
    kind: "opportunities",
    websiteUrl: payload?.siteUrl || payload?.shopDomain || "",
    hostname: h,
    mode: "draft",
    provider: p,
  });

  runDraftScan({ scanId: scan.scanId, hostname: h, provider: p, payload }).catch(() => {});
  return scan;
}

async function runDraftScan({ scanId, hostname, provider, payload }) {
  try {
    // 1) Internal render (non-public HTML)
    const rendered = await renderDraft({ provider, payload });

    // 2) Extract SEO basics from rendered HTML
    const seo = extractSeoData(rendered.html || "");

    const item = {
      url: rendered.url || "(draft)",
      title: rendered.title || seo.title || "",
      description: seo.description || "",
      wordCount: seo.wordCount || 0,
      isDraft: true,
    };

    // 3) Store as opportunities snapshot in "draft" mode
    upsertOpportunitiesSnapshot(hostname, {
      scanId,
      status: "complete",
      mode: "draft",
      diagnostics: { provider, source: "internal-render" },
      blogs: [item], // you can also decide page vs blog by payload later
      pages: [],
    });

    completeScan(scanId, {
      hostname,
      diagnostics: { provider, source: "internal-render" },
    });
  } catch (e) {
    failScan(scanId, {
      error: e?.message || "Draft scan failed",
      diagnostics: { provider, source: "internal-render" },
    });
  }
}
