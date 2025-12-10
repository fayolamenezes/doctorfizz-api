// src/app/api/keywords/suggest/route.js
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

const GENERIC_STOPWORDS = new Set([
  "keyword",
  "keywords",
  "keyward",
  "keywards",
  "seo",
  "sem",
  "search",
  "engine",
  "marketing",
  "digital",
  "online",
  "website",
  "websites",
  "site",
  "sites",
  "trend",
  "trending",
  "strategy",
  "strategies",
  "tips",
  "ideas",
  "guide",
  "agency",
  "agencies",
  "company",
  "companies",
  "services",
  "service",
  "best",
  "top",
  "list",
  "tool",
  "tools",
]);

function cleanPhrase(str) {
  if (!str) return "";
  // keep letters, numbers, spaces
  return str
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req) {
  try {
    const { domain } = await req.json();

    if (!domain) {
      return NextResponse.json(
        { error: "Domain is required", keywords: [] },
        { status: 400 }
      );
    }

    const serperKey = process.env.SERPER_API_KEY;
    if (!serperKey) {
      return NextResponse.json(
        { error: "SERPER_API_KEY is missing", keywords: [] },
        { status: 500 }
      );
    }

    const host = normalizeHost(domain);
    const rootHost = getRootHost(host);
    const brandToken = (rootHost || "").split(".")[0]; // e.g. "flipkart" from "flipkart.com"

    // 🔍 1) Ask Serper for results about THIS brand/domain
    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: rootHost || domain,
        gl: "in",
        hl: "en",
      }),
    });

    if (!serperRes.ok) {
      const txt = await serperRes.text();
      console.error("Serper keyword error:", serperRes.status, txt);
      return NextResponse.json(
        { error: "Failed to fetch keywords from Serper", keywords: [] },
        { status: 502 }
      );
    }

    const data = await serperRes.json();

    const candidates = [];

    // 2) relatedSearches → already nice phrases
    if (Array.isArray(data.relatedSearches)) {
      for (const r of data.relatedSearches) {
        if (r?.query) candidates.push(r.query);
      }
    }

    // 3) peopleAlsoAsk → questions → phrases
    if (Array.isArray(data.peopleAlsoAsk)) {
      for (const p of data.peopleAlsoAsk) {
        if (p?.question) candidates.push(p.question);
      }
    }

    // 4) organic titles + snippets → extract informative phrases
    if (Array.isArray(data.organic)) {
      for (const item of data.organic) {
        if (item?.title) candidates.push(item.title);
        if (item?.snippet) candidates.push(item.snippet);
      }
    }

    // 5) Clean, remove brand + generic words, dedupe, keep up to 8
    const seen = new Set();
    const finalKeywords = [];

    for (let raw of candidates) {
      let phrase = cleanPhrase(raw);
      if (!phrase) continue;

      // remove brand / root words
      const lowerBrand = (brandToken || "").toLowerCase();
      const lowerRoot = (rootHost || "").toLowerCase();
      phrase = phrase
        .split(" ")
        .filter((w) => {
          const lw = w.toLowerCase();
          if (!lw) return false;
          if (lw === lowerBrand || lw === lowerRoot) return false;
          if (GENERIC_STOPWORDS.has(lw)) return false;
          return true;
        })
        .join(" ");

      if (!phrase) continue;
      if (phrase.length < 3 || phrase.length > 60) continue; // avoid too short/too long

      const key = phrase.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      finalKeywords.push(phrase);

      if (finalKeywords.length >= 8) break;
    }

    return NextResponse.json({ keywords: finalKeywords });
  } catch (err) {
    console.error("keywords/suggest error:", err);
    return NextResponse.json(
      { error: "Server error fetching keywords", keywords: [] },
      { status: 500 }
    );
  }
}
