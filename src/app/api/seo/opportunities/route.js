// src/app/api/seo/opportunities/route.js
import { NextResponse } from "next/server";
import { normalizeToHttps, getHostname } from "@/lib/seo/discovery";
import { getLatestOpportunities } from "@/lib/seo/snapshots.store";
import { enqueueOpportunitiesScan } from "@/lib/seo/jobs/scan-opportunities";

export const runtime = "nodejs";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const websiteUrl = normalizeToHttps(body?.websiteUrl);
    const allowSubdomains = Boolean(body?.allowSubdomains);

    if (!websiteUrl) {
      return NextResponse.json({ error: "websiteUrl is required" }, { status: 400 });
    }

    const hostname = getHostname(websiteUrl);
    if (!hostname) {
      return NextResponse.json({ error: "Invalid websiteUrl" }, { status: 400 });
    }

    // 1) SnapshotStore first
    const cached = getLatestOpportunities(hostname, { ttlMs: TTL_MS });
    if (cached) {
      return NextResponse.json({
        websiteUrl,
        hostname,
        blogs: cached.blogs.map(({ url, title, description, wordCount }) => ({
          url,
          title,
          description,
          wordCount,
        })),
        pages: cached.pages.map(({ url, title, description, wordCount }) => ({
          url,
          title,
          description,
          wordCount,
        })),
        source: {
          scanId: cached.scan.scanId,
          status: cached.scan.status,
          diagnostics: cached.scan.diagnostics || {},
          fromCache: true,
        },
      });
    }

    // 2) Need scan → enqueue + return 202
    const scan = enqueueOpportunitiesScan({ websiteUrl, allowSubdomains });

    return NextResponse.json(
      {
        websiteUrl,
        hostname,
        blogs: [],
        pages: [],
        source: {
          scanId: scan.scanId,
          status: scan.status, // queued
          fromCache: false,
          allowSubdomains,
        },
      },
      { status: 202 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Failed to build opportunities" },
      { status: 500 }
    );
  }
}
