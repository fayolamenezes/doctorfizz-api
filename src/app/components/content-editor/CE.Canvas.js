// components/content-editor/CE.Canvas.js
"use client";

import React, {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useCallback,
} from "react";
import { FileText, Sparkles, ScrollText, Link2, Shapes } from "lucide-react";

const HL_ATTR = "data-ce-hl"; // marker attribute for our highlights

const CECanvas = forwardRef(function CECanvas(
  {
    docId, // 👈 unique per page/document (slug/id)
    title = "Untitled",
    content = "",
    setContent,
    onTyping,
    onFocusEditor,
    onBlurEditor,
  },
  ref
) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const seededRef = useRef(false);
  const autosaveTimer = useRef(null);

  // highlight rules sent from Optimize
  const highlightRulesRef = useRef([]);

  // RAF guard for highlights (prevents flicker / overlapping passes)
  const runHighlightsRafRef = useRef(null);

  // state guards
  const lastLocalHtmlRef = useRef("");
  const lastLocalEditAtRef = useRef(0);
  // Wider grace so external props don't clobber active typing
  const LOCAL_GRACE_MS = 300;

  const suppressInputRef = useRef(false);
  const AUTOSAVE_MS = 800;

  // 🔑 Scope autosave per document, falling back to title/global
  const AUTOSAVE_KEY = `ce:autosave:${docId || title || "untitled"}`;

  /** =========================
   * Utility
   * ========================= */
  function sanitizeToHtml(input) {
    const str = String(input || "");
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(str);
    if (looksLikeHtml) return str;
    const esc = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return str
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
      .join("");
  }

  const isTrulyEmptyHtml = useCallback((html) => {
    return (
      String(html || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim().length === 0
    );
  }, []);

  const isTrulyEmpty = useCallback(() => isTrulyEmptyHtml(content), [
    content,
    isTrulyEmptyHtml,
  ]);

  /** =========================
   * Selection helpers
   * ========================= */
  const saveSelectionSnapshot = useCallback(() => {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const container = editorRef.current;
    const anchor = sel.anchorNode;
    if (container && anchor && container.contains(anchor)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelectionSnapshot = useCallback(() => {
    const r = savedRangeRef.current;
    if (!r) return;
    const sel = window.getSelection?.();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(r);
  }, []);

  const setCaretToEnd = useCallback(
    (el) => {
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection?.();
      sel?.removeAllRanges();
      sel?.addRange(range);
      saveSelectionSnapshot();
    },
    [saveSelectionSnapshot]
  );

  /** =========================
   * Highlighter
   * ========================= */
  const runHighlights = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;

    const oldMarks = root.querySelectorAll(`[${HL_ATTR}]`);
    oldMarks.forEach((el) => {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });

    const rules = highlightRulesRef.current;
    if (!Array.isArray(rules) || rules.length === 0) return;

    const prepared = rules
      .filter((r) => r?.phrase)
      .map((r) => {
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const tokens = String(r.phrase)
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(esc);
        if (tokens.length === 0) return null;
        const rx = new RegExp(`\\b${tokens.join("[\\s\\-–—]+")}\\b`, "gi");
        return { ...r, rx };
      })
      .filter(Boolean);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const v = node.nodeValue || "";
        if (!v.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest(`[${HL_ATTR}]`)) return NodeFilter.FILTER_REJECT;
        if (p.closest("code, pre")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const textNode of textNodes) {
      let text = textNode.nodeValue;
      let currentNode = textNode;

      for (const rule of prepared) {
        rule.rx.lastIndex = 0;
        let match;
        const pieces = [];
        let lastIdx = 0;

        while ((match = rule.rx.exec(text))) {
          const [full] = match;
          const start = match.index;
          const end = start + full.length;

          if (start > lastIdx)
            pieces.push(document.createTextNode(text.slice(lastIdx, start)));

          const mark = document.createElement("mark");
          mark.setAttribute(HL_ATTR, "1");
          mark.setAttribute("data-status", rule.status || "");
          mark.className = `${rule.className} ${HL_ATTR} inline-block`;
          mark.textContent = text.slice(start, end);
          pieces.push(mark);

          lastIdx = end;
        }

        if (pieces.length) {
          if (lastIdx < text.length)
            pieces.push(document.createTextNode(text.slice(lastIdx)));
          const frag = document.createDocumentFragment();
          pieces.forEach((n) => frag.appendChild(n));
          const parent = currentNode.parentNode;
          parent.insertBefore(frag, currentNode);
          parent.removeChild(currentNode);
          const lastText = pieces
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .pop();
          currentNode = lastText || parent;
          text = lastText ? lastText.nodeValue : "";
        }
      }
    }
  }, []);

  // Debounced / guarded highlighter scheduling
  const scheduleHighlights = useCallback(() => {
    if (runHighlightsRafRef.current) {
      cancelAnimationFrame(runHighlightsRafRef.current);
    }
    runHighlightsRafRef.current = requestAnimationFrame(() => {
      runHighlights();
    });
  }, [runHighlights]);

  useEffect(() => {
    function onRules(e) {
      highlightRulesRef.current = Array.isArray(e.detail) ? e.detail : [];
      scheduleHighlights();
    }
    window.addEventListener("ce:highlightRules", onRules);
    return () => {
      window.removeEventListener("ce:highlightRules", onRules);
      if (runHighlightsRafRef.current) {
        cancelAnimationFrame(runHighlightsRafRef.current);
      }
    };
  }, [scheduleHighlights]);

  /** =========================
   * Autosave + bubble
   * ========================= */
  function scheduleAutosave(html) {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, html);
      } catch {}
    }, AUTOSAVE_MS);
  }

  function bubble({ pushHistory = true, notifyParent = true } = {}) {
    const el = editorRef.current;
    const html = el?.innerHTML || "";

    if (notifyParent && !suppressInputRef.current) {
      suppressInputRef.current = true;
      setContent?.(html);
      lastLocalHtmlRef.current = html;
      lastLocalEditAtRef.current = Date.now();
      queueMicrotask(() => {
        suppressInputRef.current = false;
      });
    }

    if (pushHistory) {
      const last = undoStack.current[undoStack.current.length - 1];
      if (last !== html) {
        undoStack.current.push(html);
        redoStack.current = [];
      }
    }

    scheduleAutosave(html);
    saveSelectionSnapshot();
    scheduleHighlights();
  }

  /** =========================
   * Mount hydration
   * ========================= */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    // 1) No initial content => try per-doc autosave
    if (!seededRef.current && isTrulyEmpty()) {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem(AUTOSAVE_KEY)
          : null;

      if (saved && !isTrulyEmptyHtml(saved)) {
        suppressInputRef.current = true;
        el.innerHTML = saved;

        // ✅ IMPORTANT:
        // Do NOT call setContent() during mount hydration.
        // Parent seeding/hydration is handled in CE.ContentArea / ContentEditor.
        lastLocalHtmlRef.current = saved;

        queueMicrotask(() => {
          suppressInputRef.current = false;
        });
      }
    }
    // 2) We *do* have incoming content -> seed from props
    else if (!seededRef.current) {
      const html = sanitizeToHtml(content);
      if (el.innerHTML !== html) {
        suppressInputRef.current = true;
        el.innerHTML = html;

        // ✅ IMPORTANT:
        // Do NOT call setContent() during mount hydration.
        lastLocalHtmlRef.current = html;

        queueMicrotask(() => {
          suppressInputRef.current = false;
        });
      } else {
        lastLocalHtmlRef.current = html;
      }
    }

    if (!seededRef.current) {
      undoStack.current = [el.innerHTML];
      redoStack.current = [];
      seededRef.current = true;
      scheduleHighlights();
    }
  }, [
    AUTOSAVE_KEY,
    isTrulyEmpty,
    isTrulyEmptyHtml,
    content,
    scheduleHighlights,
  ]);

  /** =========================
   * External sync
   * ========================= */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const htmlFromProp = sanitizeToHtml(content);
    const currentDom = el.innerHTML || "";

    // Before initial seeding, mount hydration handles it
    if (!seededRef.current) return;

    // No change, or matches what we already know locally
    if (htmlFromProp === currentDom) return;
    if (htmlFromProp === lastLocalHtmlRef.current) return;

    // If we *just* edited locally, don't let prop snap back and override typing
    const recentlyTyped =
      Date.now() - lastLocalEditAtRef.current < LOCAL_GRACE_MS;
    if (recentlyTyped || suppressInputRef.current) return;

    // ✅ IMPORTANT: if parent content has become non-empty, we MUST reflect it,
    // even if DOM currently has starter/noise; but we still avoid destroying richer DOM.
    const propIsEmpty = isTrulyEmptyHtml(htmlFromProp);
    const domIsEmpty = isTrulyEmptyHtml(currentDom);

    if (!propIsEmpty) {
      // The safest check is: only block overwrite if DOM is non-empty AND looks richer.
      if (!domIsEmpty && currentDom.length > htmlFromProp.length * 1.35) {
        // looks like user already edited more than the incoming prop; don't clobber
        return;
      }

      suppressInputRef.current = true;
      el.innerHTML = htmlFromProp;
      lastLocalHtmlRef.current = htmlFromProp;
      lastLocalEditAtRef.current = Date.now();

      queueMicrotask(() => {
        suppressInputRef.current = false;
      });

      undoStack.current.push(htmlFromProp);
      redoStack.current = [];

      scheduleHighlights();
      return;
    }

    // If prop is empty, never overwrite non-empty DOM
    if (!domIsEmpty) return;

    // Both empty -> no action
  }, [content, scheduleHighlights, isTrulyEmptyHtml]);

  /** =========================
   * execCommand
   * ========================= */
  function execCommand(cmd, value) {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    restoreSelectionSnapshot();

    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {}

    const sel = window.getSelection?.();
    const hasSel = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed;
    const wrapSelectionWith = (tag, style = "") => {
      if (!hasSel) return;
      const range = sel.getRangeAt(0);
      const frag = range.cloneContents();
      const wrapper = document.createElement(tag);
      if (style) wrapper.setAttribute("style", style);
      wrapper.appendChild(frag);
      range.deleteContents();
      range.insertNode(wrapper);
      range.setStartAfter(wrapper);
      range.setEndAfter(wrapper);
      sel.removeAllRanges();
      sel.addRange(range);
    };

    let moveCaretToEndAfter = false;

    switch (cmd) {
      case "saveSelection":
        saveSelectionSnapshot();
        return;

      case "fontSizePx":
        wrapSelectionWith("span", `font-size:${Number(value) || 16}px;`);
        break;

      case "code":
        wrapSelectionWith("code");
        break;

      case "undo": {
        if (undoStack.current.length > 1) {
          const current = undoStack.current.pop();
          redoStack.current.push(current);

          const prev = undoStack.current[undoStack.current.length - 1] ?? "";

          suppressInputRef.current = true;
          el.innerHTML = prev;
          lastLocalHtmlRef.current = prev;
          lastLocalEditAtRef.current = Date.now();

          setContent?.(prev);
          scheduleAutosave(prev);

          queueMicrotask(() => {
            suppressInputRef.current = false;
          });

          saveSelectionSnapshot();
          scheduleHighlights();
        }
        return;
      }

      case "redo": {
        if (redoStack.current.length > 0) {
          const next = redoStack.current.pop() ?? "";
          undoStack.current.push(next);

          suppressInputRef.current = true;
          el.innerHTML = next;
          lastLocalHtmlRef.current = next;
          lastLocalEditAtRef.current = Date.now();

          setContent?.(next);
          scheduleAutosave(next);

          queueMicrotask(() => {
            suppressInputRef.current = false;
          });

          saveSelectionSnapshot();
          scheduleHighlights();
        }
        return;
      }

      case "insertText": {
        document.execCommand("insertText", false, value);
        moveCaretToEndAfter = true;
        break;
      }

      default:
        document.execCommand(cmd, false, value);
        break;
    }

    if (moveCaretToEndAfter) {
      setCaretToEnd(el);
    }

    lastLocalHtmlRef.current = el.innerHTML;
    lastLocalEditAtRef.current = Date.now();
    bubble();
  }

  /** =========================
   * Imperative API (for toolbar)
   * ========================= */
  useImperativeHandle(ref, () => ({
    exec: (cmd, value) => execCommand(cmd, value),
    focusEditor: () => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      if (savedRangeRef.current) {
        restoreSelectionSnapshot();
      } else {
        setCaretToEnd(el);
      }
    },
    root: editorRef.current,
  }));

  // ✅ Starter should only show if BOTH:
  // - prop content is empty
  // - editor DOM is empty
  // This prevents the "Empty page" block from sticking around after SEO hydration.
  const showStarter =
    isTrulyEmpty() && isTrulyEmptyHtml(editorRef.current?.innerHTML);

  return (
    <section
      className="rounded-b-[12px] border border-t-0 border-[var(--border)] bg-white px-4 md:px-8 py-6 transition-colors"
      aria-label="Editor canvas"
    >
      <h2 className="text-[20px] md:text-[26px] font-bold text-[var(--text-primary)] mb-4">
        {title}
      </h2>

      {showStarter && (
        <div className="mb-6 text-[var(--text)]">
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-[14px] md:text-[15px]">
              <FileText size={18} className="opacity-70" />
              <span>Empty page</span>
            </li>
            <li className="flex items-center gap-3 text-[14px] md:text-[15px]">
              <Sparkles size={18} className="opacity-70" />
              <span>Start with AI...</span>
            </li>
            <li className="flex items-center gap-3 text-[14px] md:text-[15px]">
              <ScrollText size={18} className="opacity-70" />
              <span>Generate content brief</span>
            </li>
            <li className="flex items-center gap-3 text-[14px] md:text-[15px]">
              <Link2 size={18} className="opacity-70" />
              <span>Import content from URL</span>
            </li>
            <li className="flex items-center gap-3 text-[14px] md:text-[15px]">
              <Shapes size={18} className="opacity-70" />
              <span>Import template</span>
            </li>
          </ul>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[300px] md:min-h-[420px] rounded-md border border-[var(--border)] bg-white px-4 py-4 leading-7 text-sm md:text-[15px] text-[var(--text-primary)] focus:outline-none prose prose-p:my-3 prose-h1:text-xl md:prose-h1:text-2xl prose-h2:text-lg md:prose-h2:text-xl prose-ul:list-disc prose-ul:pl-6 transition-colors"
        onInput={() => {
          bubble({ pushHistory: true, notifyParent: true });
          onTyping?.();
        }}
        onFocus={() => {
          onFocusEditor?.();
        }}
        onBlur={() => {
          onBlurEditor?.();
        }}
        onKeyUp={saveSelectionSnapshot}
        onMouseUp={saveSelectionSnapshot}
      />
    </section>
  );
});

export default CECanvas;
