// src/app/api/seo/draft-scan/route.js
import { NextResponse } from "next/server";
import { enqueueDraftScan } from "@/lib/seo/jobs/scan-draft";
import { getLatestOpportunities } from "@/lib/seo/snapshots.store";

export const runtime = "nodejs";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * POST body examples:
 *
 * WordPress:
 * {
 *   "hostname": "aviaenterprises.net",
 *   "provider": "wordpress",
 *   "payload": {
 *     "siteUrl": "https://aviaenterprises.net",
 *     "postId": 6195,
 *     "authBasic": "<base64(username:app_password)>"
 *   }
 * }
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const hostname = String(body?.hostname || "").trim();
    const provider = String(body?.provider || "").trim();
    const payload = body?.payload || null;

    if (!hostname) return NextResponse.json({ error: "hostname is required" }, { status: 400 });
    if (!provider) return NextResponse.json({ error: "provider is required" }, { status: 400 });
    if (!payload) return NextResponse.json({ error: "payload is required" }, { status: 400 });

    // If we already have a fresh draft snapshot, return it (200)
    const cached = getLatestOpportunities(hostname, { ttlMs: TTL_MS, mode: "draft" });
    if (cached) {
      return NextResponse.json({
        hostname,
        blogs: (cached.blogs || []).map(({ url, title, description, wordCount, isDraft }) => ({
          url,
          title,
          description,
          wordCount,
          isDraft: Boolean(isDraft),
        })),
        pages: (cached.pages || []).map(({ url, title, description, wordCount, isDraft }) => ({
          url,
          title,
          description,
          wordCount,
          isDraft: Boolean(isDraft),
        })),
        source: {
          scanId: cached.scan?.scanId,
          status: cached.scan?.status,
          mode: "draft",
          provider: cached.scan?.provider || provider,
          diagnostics: cached.scan?.diagnostics || {},
          fromCache: true,
        },
      });
    }

    // Else enqueue scan (202)
    const scan = enqueueDraftScan({ hostname, provider, payload });

    return NextResponse.json(
      {
        hostname,
        blogs: [],
        pages: [],
        source: {
          scanId: scan.scanId,
          status: scan.status, // queued
          mode: "draft",
          provider,
          fromCache: false,
        },
      },
      { status: 202 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Failed to enqueue draft scan" },
      { status: 500 }
    );
  }
}
