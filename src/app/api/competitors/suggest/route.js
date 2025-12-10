// src/app/api/competitors/suggest/route.js
import { NextResponse } from "next/server";

function normalizeHost(input) {
  if (!input || typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  try {
    if (!/^https?:\/\//.test(s)) s = `https://${s}`;
    const u = new URL(s);
    s = u.hostname || s;
  } catch {
    s = s.replace(/^https?:\/\//, "").split("/")[0];
  }
  return s.replace(/^www\./, "");
}

function getRootHost(host) {
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  return parts.slice(parts.length - 2).join(".");
}

export async function POST(req) {
  try {
    const { domain } = await req.json();

    if (!domain) {
      return NextResponse.json(
        { error: "Domain is required" },
        { status: 400 }
      );
    }

    const serperKey = process.env.SERPER_API_KEY;
    if (!serperKey) {
      return NextResponse.json(
        { error: "SERPER_API_KEY is missing" },
        { status: 500 }
      );
    }

    const host = normalizeHost(domain);
    const rootHost = getRootHost(host);

    // Use a competitors-style query
    const query = `${rootHost} competitors`;

    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "in",
        hl: "en",
      }),
    });

    if (!serperRes.ok) {
      const txt = await serperRes.text();
      console.error("Serper error:", serperRes.status, txt);
      return NextResponse.json(
        { error: "Failed to fetch competitors from Serper" },
        { status: 502 }
      );
    }

    const serperData = await serperRes.json();
    const organic = Array.isArray(serperData.organic) ? serperData.organic : [];

    // Collect unique competitor domains from organic results
    const domainSet = new Set();
    const allCompetitors = [];

    for (const item of organic) {
      const link = item?.link;
      if (!link) continue;

      let compHost;
      try {
        compHost = normalizeHost(link);
      } catch {
        continue;
      }
      if (!compHost) continue;

      const compRoot = getRootHost(compHost);

      // skip our own root domain
      if (compRoot === rootHost) continue;

      if (!domainSet.has(compRoot)) {
        domainSet.add(compRoot);
        allCompetitors.push(compRoot);
      }

      // hard cap to avoid over-collecting
      if (allCompetitors.length >= 8) break;
    }

    let businessCompetitors = [];
    let searchCompetitors = [];

    if (allCompetitors.length <= 4) {
      // Use the same real competitors in both sections
      businessCompetitors = allCompetitors.slice(0, 4);
      searchCompetitors = allCompetitors.slice(0, 4);
    } else {
      // First 4 → business, next 4 → search
      businessCompetitors = allCompetitors.slice(0, 4);
      searchCompetitors = allCompetitors.slice(4, 8);

      // If somehow search ends up empty, reuse business
      if (searchCompetitors.length === 0) {
        searchCompetitors = businessCompetitors.slice(0, 4);
      }
    }

    return NextResponse.json({
      businessCompetitors,
      searchCompetitors,
    });
  } catch (err) {
    console.error("competitors/suggest error:", err);
    return NextResponse.json(
      { error: "Server error fetching competitors" },
      { status: 500 }
    );
  }
}
