// src/app/api/seo/scan/status/route.js
import { NextResponse } from "next/server";
import { getScan } from "@/lib/seo/snapshots.store";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get("scanId");

  if (!scanId) {
    return NextResponse.json({ error: "scanId is required" }, { status: 400 });
  }

  const scan = getScan(scanId);
  if (!scan) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }

  return NextResponse.json({
    scanId: scan.scanId,
    status: scan.status,
    hostname: scan.hostname,
    createdAt: scan.createdAt,
    diagnostics: scan.diagnostics || {},
  });
}
