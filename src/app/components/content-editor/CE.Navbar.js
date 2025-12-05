"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Edit3, Sparkles, Plus, Menu } from "lucide-react";

export default function CENavbar({
  title,
  onBack,
  onTitleChange,
  searchVolume,
  keywordDifficulty,
}) {
  // Coerce incoming values (numbers OR strings) into usable numbers
  const svNum =
    searchVolume === undefined || searchVolume === null
      ? null
      : Number(searchVolume);

  const kdNum =
    keywordDifficulty === undefined || keywordDifficulty === null
      ? null
      : Number(keywordDifficulty);

  // Show "-----" when value is missing, 0, or not a valid number
  const sv =
    typeof svNum === "number" && !Number.isNaN(svNum) && svNum > 0
      ? svNum.toLocaleString()
      : "-----";

  const kd =
    typeof kdNum === "number" && !Number.isNaN(kdNum) && kdNum > 0
      ? kdNum.toString()
      : "-----";

  const [editing, setEditing] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!editing && nameRef.current) {
      nameRef.current.innerText = title || "Untitled";
    }
  }, [title, editing]);

  const handleNewDoc = () => {
    window.dispatchEvent(
      new CustomEvent("content-editor:open", {
        detail: { title: "Untitled", content: " " },
      })
    );
  };

  const startEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = nameRef.current;
      if (!el) return;
      el.innerText = title || "Untitled";
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    });
  };

  const commitTitle = () => {
    const el = nameRef.current;
    if (!el) return;
    const next =
      (el.innerText || "").replace(/\s+/g, " ").trim() || "Untitled";
    setEditing(false);
    if (next !== title) onTitleChange?.(next);
  };

  const cancelTitle = () => {
    setEditing(false);
    if (nameRef.current) nameRef.current.innerText = title || "Untitled";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitle();
    }
  };

  return (
    /* Pull up a bit on mobile, desktop gets normal spacing */
    <header className="mb-2 md:mb-4 pr-3 md:pr-20 -mt-2 md:mt-0">
      {/* ===================== MOBILE (exactly as you had it) ===================== */}
      <div className="md:hidden">
        {/* Row 1 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onBack?.()}
            className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--input)]"
            aria-label="Menu"
            title="Menu"
          >
            <Menu size={13} />
          </button>

          <button
            className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-lg text-white shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, #FF8C2A 0%, #F1761F 45%, #E06416 100%)",
            }}
            aria-label="Actions"
            title="Actions"
          >
            <Sparkles size={13} />
          </button>
        </div>

        {/* Row 2 */}
        <div className="mt-0.5 text-[15px] font-bold leading-[1.1] text-[var(--text)]">
          Blog Editor :
        </div>

        {/* Title + label */}
        <div className="mt-[2px] flex flex-col">
          {/* Title row */}
          <div className="flex items-center gap-1.5">
            <h1 className="m-0 text-[15px] font-bold leading-tight text-[var(--text)]">
              <span
                ref={nameRef}
                role="textbox"
                aria-label="Document title"
                aria-multiline={false}
                contentEditable={editing}
                suppressContentEditableWarning
                onBlur={commitTitle}
                onKeyDown={handleKeyDown}
                className={[
                  "inline-block max-w-[72vw] truncate align-baseline px-0.5",
                  editing
                    ? "outline-none ring-2 ring-orange-300 bg-white"
                    : "outline-none",
                ].join(" ")}
                style={{ cursor: editing ? "text" : "default" }}
                title={title || "Untitled"}
              >
                {title || "Untitled"}
              </span>
            </h1>

            <button
              title={editing ? "Save (Enter) / Cancel (Esc)" : "Rename"}
              onClick={editing ? commitTitle : startEditing}
              className="p-0.5 rounded text-[var(--muted)] hover:bg-[var(--input)] align-baseline"
              aria-label="Rename"
            >
              <Edit3 size={12} />
            </button>
          </div>

          {/* Subtitle label */}
          <span className="mt-[1px] text-[10.5px] font-medium text-[#9CA3AF]">
            Suggested Keyword topic
          </span>
        </div>
      </div>

      {/* ===================== DESKTOP (your original layout) ===================== */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] items-center gap-x-4">
          {/* TOP-LEFT: back link */}
          <div className="col-start-1 row-start-1">
            <button
              onClick={() => onBack?.()}
              className="inline-flex items-center gap-2 px-0 py-0 text-[12px] text-[var(--muted)] hover:opacity-70 transition"
            >
              <ArrowLeft size={16} />
              <span className="font-medium">Back to DASHBOARD</span>
            </button>
          </div>

          {/* BOTTOM-LEFT: title (no truncation, wraps) + pencil */}
          <div className="col-start-1 row-start-2 flex items-baseline gap-1 min-w-0">
            <h1
              className="
                flex-1 text-[16px] md:text-[18px]
                font-semibold leading-tight
                overflow-visible whitespace-normal break-words
              "
            >
              Content Editor :{" "}
              <span
                ref={nameRef}
                role="textbox"
                aria-label="Document title"
                aria-multiline={false}
                contentEditable={editing}
                suppressContentEditableWarning
                onBlur={commitTitle}
                onKeyDown={handleKeyDown}
                className={[
                  "inline-block whitespace-normal break-words px-1",
                  editing
                    ? "outline-none ring-2 ring-orange-300 bg-white"
                    : "outline-none",
                ].join(" ")}
                style={{ cursor: editing ? "text" : "default" }}
              >
                {title || "Untitled"}
              </span>
            </h1>

            <button
              title={editing ? "Save (Enter) / Cancel (Esc)" : "Rename"}
              onClick={editing ? commitTitle : startEditing}
              className="p-1 rounded text-[var(--muted)] hover:bg-[var(--input)]"
            >
              <Edit3 size={16} />
            </button>
          </div>

          {/* BOTTOM-CENTER: inline stats */}
          <div className="col-start-2 row-start-2 hidden md:flex items-center justify-center">
            <div className="flex items-center gap-12 text-[12px] text-[var(--muted)]">
              <span>
                Search Volume : <span className="opacity-60">{sv}</span>
              </span>
              <span>
                Keyword difficulty : <span className="opacity-60">{kd}</span>
              </span>
            </div>
          </div>

          {/* TOP-RIGHT: New document + Chat with AI */}
          <div className="col-start-3 row-start-1 flex items-center gap-3 mr-6 xl:mr-8">
            <button
              onClick={handleNewDoc}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
            >
              <Plus size={16} />
              <span>New document</span>
            </button>

            <button className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow-sm bg-[image:var(--infoHighlight-gradient)] hover:opacity-90 transition">
              <span>Chat with AI</span>
              <Sparkles size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
