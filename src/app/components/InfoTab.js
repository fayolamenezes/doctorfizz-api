"use client";
import React from "react";

export default function InfoTab({ languageLocationData, keywordData, competitorData }) {
  return (
    <div className="fixed top-0 right-0 w-[380px] h-screen bg-white shadow-xl border-l border-gray-200 p-6 overflow-y-auto z-50">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Info Tab</h2>

      {/* Languages & Locations */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Languages & Locations</h3>
        {languageLocationData?.selections?.length ? (
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            {languageLocationData.selections.map((s) => (
              <li key={s.id}>
                {s.language} — {s.location}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No selections yet.</p>
        )}
      </div>

      {/* Keywords */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Keywords</h3>
        {keywordData?.keywords?.length ? (
          <div className="flex flex-wrap gap-2">
            {keywordData.keywords.map((k, idx) => (
              <span
                key={`${k}-${idx}`}
                className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-sm"
              >
                {k}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No keywords yet.</p>
        )}
      </div>

      {/* Competitors */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Competitors</h3>
        {competitorData?.totalCompetitors?.length ? (
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            {competitorData.totalCompetitors.map((c, idx) => (
              <li key={`${c}-${idx}`}>{c}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No competitors yet.</p>
        )}
      </div>
    </div>
  );
}
