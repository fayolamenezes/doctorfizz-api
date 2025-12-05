"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  MessageSquare,
  ChevronDown,
  Dot,
  Paintbrush,
} from "lucide-react";

export default function CEToolbar({
  mode = "desktop", // "desktop" | "mobile"
  editorRef,
}) {
  const isMobile = mode === "mobile";

  const [headOpen, setHeadOpen] = useState(false);
  const [insOpen, setInsOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  const [textPaletteOpen, setTextPaletteOpen] = useState(false);
  const [hilitePaletteOpen, setHilitePaletteOpen] = useState(false);

  const [customSize, setCustomSize] = useState("");

  const colorInputRef = useRef(null);
  const highlightInputRef = useRef(null);
  const popoverRef = useRef(null);

  const noFocus = (e) => e.preventDefault();

  // Stable exec wrapper
  const exec = useCallback(
    (cmd, val) => editorRef?.current?.exec?.(cmd, val),
    [editorRef]
  );

  // Make sure the editor has focus before running commands that depend on the native undo stack
  const ensureEditorFocus = useCallback(() => {
    const inst = editorRef?.current;
    if (!inst) return;

    // If your CECanvas exposes its own focus method, use it
    if (typeof inst.focusEditor === "function") {
      inst.focusEditor();
    } else if (inst.root && typeof inst.root.focus === "function") {
      // or focus the underlying contentEditable/root if you expose it
      inst.root.focus();
    }
  }, [editorRef]);

  // Close palettes on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target)) {
        setTextPaletteOpen(false);
        setHilitePaletteOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Wire native color inputs (commit on final change)
  const wireNativeColor = useCallback(
    (ref, command) => {
      const el = ref.current;
      if (!el) return () => {};
      let lastVal = null;
      const onInput = (e) => {
        lastVal = e.target.value;
      };
      const onChange = (e) => {
        exec("saveSelection");
        exec(command, lastVal || e.target.value);
        setTextPaletteOpen(false);
        setHilitePaletteOpen(false);
        lastVal = null;
      };
      el.addEventListener("input", onInput, { passive: true });
      el.addEventListener("change", onChange, { passive: true });
      return () => {
        el.removeEventListener("input", onInput);
        el.removeEventListener("change", onChange);
      };
    },
    [exec]
  );

  useEffect(() => wireNativeColor(colorInputRef, "foreColor"), [wireNativeColor]);
  useEffect(
    () => wireNativeColor(highlightInputRef, "hiliteColor"),
    [wireNativeColor]
  );

  const IconBtn = ({ title, children, onClick }) => (
    <button
      title={title}
      onMouseDown={noFocus}
      onClick={onClick}
      className={`${
        isMobile ? "h-10 w-10" : "h-7 w-7"
      } grid place-items-center rounded hover:bg-gray-100 text-gray-700 transition-colors shrink-0`}
    >
      {children}
    </button>
  );

  const TEXT_COLORS = [
    "#000000",
    "#434343",
    "#666666",
    "#999999",
    "#B7B7B7",
    "#CCCCCC",
    "#EFEFEF",
    "#FFFFFF",
    "#FF0000",
    "#FF6D00",
    "#FFAB00",
    "#FFD600",
    "#00C853",
    "#00B8D4",
    "#2979FF",
    "#6200EA",
  ];
  const HILITE_COLORS = [
    "#FFF59D",
    "#FFF176",
    "#FFEE58",
    "#FFEB3B",
    "#FFD54F",
    "#FFB74D",
    "#FF8A65",
    "#FF8A80",
    "#A5D6A7",
    "#80CBC4",
    "#81D4FA",
    "#90CAF9",
    "#CE93D8",
    "#F48FB1",
    "#E0E0E0",
    "#F5F5F5",
    "#8B0000",
  ];

  const Swatch = ({ color, onPick }) => (
    <button
      title={color}
      className="w-6 h-6 rounded border border-gray-300 hover:scale-[1.03] transition"
      style={{ backgroundColor: color }}
      onMouseDown={noFocus}
      onClick={() => onPick(color)}
    />
  );

  const Palette = ({ title, colors, onPick, onCustom }) => (
    <div
      ref={popoverRef}
      className="absolute z-50 mt-1 rounded-xl border border-[var(--border)] bg-white shadow-lg p-3 transition-colors"
      style={{ width: 224 }}
    >
      <div className="grid grid-cols-8 gap-2 mb-2">
        {colors.map((c) => (
          <Swatch key={c} color={c} onPick={onPick} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          className="text-[12px] px-3 py-[6px] border border-gray-300 rounded hover:bg-gray-100"
          onMouseDown={noFocus}
          onClick={onCustom}
        >
          Custom…
        </button>
        <span className="text-[11px] text-gray-500">{title}</span>
      </div>
    </div>
  );

  const openNativeColor = (ref) => {
    exec("saveSelection");
    setTimeout(() => {
      if (ref.current?.showPicker) ref.current.showPicker();
      else ref.current?.click();
    }, 0);
  };

  // Heading behavior (matches your editor)
  const HEADING_SIZES = { h1: 28, h2: 22, h3: 18 };
  const applyHeadingBlock = (block) => {
    exec("saveSelection");
    exec("formatBlock", block);
    if (HEADING_SIZES[block]) {
      exec("fontSizePx", HEADING_SIZES[block]);
      exec("bold");
    }
    setHeadOpen(false);
  };

  return (
    <div
      className={[
        "w-full bg-white transition-colors",
        isMobile ? "border-t border-gray-200 shadow-lg rounded-none" : "",
      ].join(" ")}
    >
      {/* Actions Row (mobile: horizontally scrollable) */}
      <div
        className={[
          "flex items-center gap-[2px] px-2 border-t border-[var(--border)] bg-white relative",
          isMobile
            ? "py-2 overflow-x-auto whitespace-nowrap touch-pan-x"
            : "py-[3px]",
        ].join(" ")}
      >
        <IconBtn
          title="Undo"
          onClick={() => {
            ensureEditorFocus();
            exec("undo");
          }}
        >
          <Undo2 size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn
          title="Redo"
          onClick={() => {
            ensureEditorFocus();
            exec("redo");
          }}
        >
          <Redo2 size={isMobile ? 18 : 14} />
        </IconBtn>

        <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

        {/* Heading */}
        <div className="relative inline-block shrink-0">
          <button
            className={`px-2 ${
              isMobile ? "h-10" : "h-7"
            } rounded border border-[var(--border)] text-[13px] hover:bg-gray-100 inline-flex items-center gap-1 transition-colors`}
            onMouseDown={noFocus}
            onClick={() => {
              exec("saveSelection");
              setHeadOpen((s) => !s);
            }}
          >
            Heading 3 <ChevronDown size={12} />
          </button>
          {headOpen && (
            <div className="absolute z-40 mt-1 min-w-[150px] rounded-md border border-[var(--border)] bg-white shadow-sm">
              {[
                { label: "Paragraph", block: "p" },
                { label: "Heading 1", block: "h1" },
                { label: "Heading 2", block: "h2" },
                { label: "Heading 3", block: "h3" },
              ].map((it) => (
                <button
                  key={it.block}
                  className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
                  onMouseDown={noFocus}
                  onClick={() => {
                    if (it.block === "p") {
                      exec("formatBlock", "p");
                      setHeadOpen(false);
                    } else {
                      applyHeadingBlock(it.block);
                    }
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

        {/* Inline formatting */}
        <IconBtn title="Bold" onClick={() => exec("bold")}>
          <Bold size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn title="Italic" onClick={() => exec("italic")}>
          <Italic size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn title="Underline" onClick={() => exec("underline")}>
          <Underline size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn title="Strikethrough" onClick={() => exec("strikeThrough")}>
          <Strikethrough size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn title="Inline code" onClick={() => exec("code")}>
          <Code2 size={isMobile ? 18 : 14} />
        </IconBtn>

        {/* Link */}
        <IconBtn
          title="Insert Link"
          onClick={() => {
            const url = prompt("Enter URL");
            if (url) exec("createLink", url);
          }}
        >
          <LinkIcon size={isMobile ? 18 : 14} />
        </IconBtn>

        {/* Alignment + List */}
        <IconBtn title="Align left" onClick={() => exec("justifyLeft")}>
          <AlignLeft size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn title="Align center" onClick={() => exec("justifyCenter")}>
          <AlignCenter size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn title="Align right" onClick={() => exec("justifyRight")}>
          <AlignRight size={isMobile ? 18 : 14} />
        </IconBtn>
        <IconBtn
          title="Bulleted List"
          onClick={() => exec("insertUnorderedList")}
        >
          <List size={isMobile ? 18 : 14} />
        </IconBtn>

        <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

        {/* Text color */}
        <div className="relative inline-block shrink-0">
          <IconBtn
            title="Text color"
            onClick={() => {
              exec("saveSelection");
              setTextPaletteOpen((s) => !s);
              setHilitePaletteOpen(false);
            }}
          >
            <Dot size={isMobile ? 18 : 14} />
          </IconBtn>
          {textPaletteOpen && (
            <Palette
              title="Text color"
              colors={TEXT_COLORS}
              onPick={(c) => {
                exec("foreColor", c);
                setTextPaletteOpen(false);
              }}
              onCustom={() => openNativeColor(colorInputRef)}
            />
          )}
        </div>
        <input ref={colorInputRef} type="color" className="hidden" />

        {/* Highlight */}
        <div className="relative inline-block shrink-0">
          <IconBtn
            title="Highlight color"
            onClick={() => {
              exec("saveSelection");
              setHilitePaletteOpen((s) => !s);
              setTextPaletteOpen(false);
            }}
          >
            <Paintbrush size={isMobile ? 18 : 14} />
          </IconBtn>
          {hilitePaletteOpen && (
            <Palette
              title="Highlight color"
              colors={HILITE_COLORS}
              onPick={(c) => {
                exec("hiliteColor", c);
                setHilitePaletteOpen(false);
              }}
              onCustom={() => openNativeColor(highlightInputRef)}
            />
          )}
        </div>
        <input ref={highlightInputRef} type="color" className="hidden" />

        <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

        {/* Insert */}
        <div className="relative inline-block shrink-0">
          <button
            className={`px-2 ${
              isMobile ? "h-10" : "h-7"
            } rounded border border-[var(--border)] text-[13px] hover:bg-gray-100 inline-flex items-center gap-1 transition-colors`}
            onMouseDown={noFocus}
            onClick={() => setInsOpen((s) => !s)}
          >
            Insert <ChevronDown size={12} />
          </button>
          {insOpen && (
            <div className="absolute z-40 mt-1 min-w=[160px] rounded-md border border-[var(--border)] bg-white shadow-sm">
              <button
                className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
                onMouseDown={noFocus}
                onClick={() => {
                  exec("insertHorizontalRule");
                  setInsOpen(false);
                }}
              >
                Horizontal Rule
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
                onMouseDown={noFocus}
                onClick={() => {
                  const url = prompt("Image URL");
                  if (url) exec("insertImage", url);
                  setInsOpen(false);
                }}
              >
                Image (URL)
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
                onMouseDown={noFocus}
                onClick={() => {
                  exec("formatBlock", "blockquote");
                  setInsOpen(false);
                }}
              >
                Quote
              </button>
            </div>
          )}
        </div>

        {/* Text size */}
        <div className="relative inline-block shrink-0">
          <button
            title="Text size"
            onMouseDown={noFocus}
            onClick={() => setSizeOpen((s) => !s)}
            className={`ml-1 ${
              isMobile ? "h-10" : "h-7"
            } px-1.5 rounded hover:bg-gray-100 text-gray-700 text-[12px] font-medium inline-flex items-center gap-1 transition-colors`}
          >
            T<span className="text-[10px] align-super">x</span>{" "}
            <ChevronDown size={12} />
          </button>
          {sizeOpen && (
            <div className="absolute z-40 mt-1 min-w-[130px] rounded-md border border-[var(--border)] bg-white shadow-sm p-1">
              {[12, 14, 16, 18, 20, 24].map((px) => (
                <button
                  key={px}
                  className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
                  onMouseDown={noFocus}
                  onClick={() => {
                    exec("fontSizePx", px);
                    setSizeOpen(false);
                  }}
                >
                  {px}px
                </button>
              ))}
              <div className="border-t border-gray-200 my-1" />
              <div className="flex items-center gap-1 px-2 pb-1">
                <input
                  type="number"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder="Custom"
                  className="w-[70px] border border-gray-200 rounded px-2 text-[12px]"
                />
                <button
                  onClick={() => {
                    if (customSize) {
                      exec("fontSizePx", Number(customSize));
                      setCustomSize("");
                      setSizeOpen(false);
                    }
                  }}
                  className="text-[12px] px-2 py-[6px] border border-gray-300 rounded hover:bg-gray-100"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        <IconBtn title="Comment">
          <MessageSquare size={isMobile ? 18 : 14} />
        </IconBtn>
      </div>
    </div>
  );
}
