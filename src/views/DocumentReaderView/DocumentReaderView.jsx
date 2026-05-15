import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import useTheme from "../../theme/useTheme.js";
import Markdown from "../../components/Markdown/Markdown.jsx";
import DocumentSidebar from "../../components/DocumentSidebar/DocumentSidebar.jsx";
import {
  getDocument, listHighlights, saveHighlight, generateId
} from "../../utils/documentStore.js";

export default function DocumentReaderView({ documentId, aiSettings, decks, onAddCardToDeck, onBack }) {
  const { T } = useTheme();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [highlights, setHighlights] = useState([]);
  const [selectionPopover, setSelectionPopover] = useState(null);
  const readerRef = useRef(null);

  // Load document + highlights
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getDocument(documentId);
      if (cancelled) return;
      setDoc(d);
      const hs = await listHighlights(documentId);
      if (cancelled) return;
      setHighlights(hs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [documentId]);

  // Scroll progress bar
  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(el.scrollTop / max, 1) : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [doc, sidebarOpen]);

  // Text selection → floating "Highlight" button
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 4) {
      setSelectionPopover(null);
      return;
    }
    if (!readerRef.current?.contains(sel.anchorNode)) {
      setSelectionPopover(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopover({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text,
      page: findPageForNode(sel.anchorNode),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // Dismiss on scroll
  useEffect(() => {
    if (!selectionPopover) return;
    const el = readerRef.current;
    const onScrollDismiss = () => setSelectionPopover(null);
    el?.addEventListener("scroll", onScrollDismiss, { passive: true });
    return () => el?.removeEventListener("scroll", onScrollDismiss);
  }, [selectionPopover]);

  const handleSaveHighlight = async () => {
    if (!selectionPopover) return;
    const h = {
      id: generateId(),
      docId: doc.id,
      text: selectionPopover.text,
      page: selectionPopover.page,
      color: T.hard || "#c47f2a",
      note: null,
      createdAt: Date.now(),
      source: "user",
    };
    await saveHighlight(h);
    setHighlights(prev => [...prev, h].sort((a, b) => (a.page ?? 0) - (b.page ?? 0)));
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  };

  // Programmatic scrolling — used by citation clicks + highlight clicks
  const scrollToPage = useCallback((n) => {
    const target = document.getElementById(`page-${n}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Subtle flash to draw the eye
    const orig = target.style.background;
    target.style.transition = "background 0.5s ease";
    target.style.background = `${T.easy}15`;
    setTimeout(() => { if (target) target.style.background = orig || "transparent"; }, 1200);
  }, [T.easy]);

  const readingTime = useMemo(() => {
    if (!doc?.markdown) return 0;
    const words = doc.markdown.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  }, [doc]);

  // Markdown with highlights applied via simple text-replace.
  const markdownWithHighlights = useMemo(() => {
    if (!doc?.markdown) return "";
    let md = doc.markdown;
    for (const h of highlights) {
      const safe = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${safe})`, "");
      md = md.replace(re, `<mark>$1</mark>`);
    }
    return md;
  }, [doc?.markdown, highlights]);

  if (loading) {
    return (
      <div style={fullPage(T)}>
        <div style={{ color: T.textMid, fontFamily: T.fontBody, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={fullPage(T)}>
        <div style={{ textAlign: "center", color: T.textMid, fontFamily: T.fontBody }}>
          <div style={{ fontSize: 16, color: T.text, marginBottom: 8 }}>Document not found</div>
          <button onClick={onBack} style={backBtn(T)}>← Back to library</button>
        </div>
      </div>
    );
  }

  const SIDEBAR_W = 380;

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      background: T.bg, fontFamily: T.fontBody,
      display: "flex", flexDirection: "column"
    }}>
      {/* Top bar */}
      <div style={{
        height: "calc(48px + var(--sat))", paddingTop: "var(--sat)",
        borderBottom: `1px solid ${T.border}`,
        background: T.card, flexShrink: 0,
        display: "flex", alignItems: "center", padding: "0 16px",
        gap: 12, position: "relative"
      }}>
        <button onClick={onBack} style={backBtn(T)} aria-label="Back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Library
        </button>
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 13, fontWeight: 600, color: T.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>{doc.title}</div>
        <div style={{ fontSize: 11, color: T.textLight, flexShrink: 0 }}>
          {readingTime} min · {doc.pageCount} pages
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={sidebarOpen ? "Hide sidebar" : "Show AI sidebar"}
          style={{
            ...iconBtn(T),
            background: sidebarOpen ? T.bgSub : T.card,
            borderColor: sidebarOpen ? T.borderStrong : T.border,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 2
        }}>
          <div style={{
            width: `${progress * 100}%`, height: "100%",
            background: T.good, transition: "width 0.1s ease"
          }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div ref={readerRef} style={{
          flex: 1, overflowY: "auto",
          padding: "32px 24px 80px"
        }}>
          <article style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
            <h1 style={{
              fontSize: 32, fontWeight: 700, color: T.text, fontFamily: T.font,
              marginBottom: 24, letterSpacing: -0.4, lineHeight: 1.2
            }}>{doc.title}</h1>
            <Markdown markdown={markdownWithHighlights} />
          </article>
        </div>

        <div style={{
          width: sidebarOpen ? SIDEBAR_W : 0,
          flexShrink: 0,
          borderLeft: sidebarOpen ? `1px solid ${T.border}` : "none",
          transition: "width 0.2s ease",
          overflow: "hidden"
        }}>
          {sidebarOpen && (
            <div style={{ width: SIDEBAR_W, height: "100%" }}>
              <DocumentSidebar
                doc={doc}
                aiSettings={aiSettings}
                decks={decks}
                onAddCardToDeck={onAddCardToDeck}
                onScrollToPage={scrollToPage}
                highlights={highlights}
                setHighlights={setHighlights}
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating "Highlight" button on text selection */}
      {selectionPopover && (
        <div data-selection-popover style={{
          position: "fixed",
          left: selectionPopover.x, top: selectionPopover.y,
          transform: "translate(-50%, -100%)",
          zIndex: 50, animation: "fadeIn 0.12s ease"
        }}>
          <button onClick={handleSaveHighlight} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            border: "none", background: T.text, color: T.card,
            fontSize: 12, fontWeight: 600, fontFamily: T.fontBody,
            cursor: "pointer", boxShadow: T.shadow2
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Highlight
          </button>
        </div>
      )}
    </div>
  );
}

function findPageForNode(node) {
  let el = node?.nodeType === 3 ? node.parentElement : node;
  while (el) {
    if (el.id && el.id.startsWith("page-")) return parseInt(el.id.slice(5), 10);
    el = el.parentElement;
  }
  return null;
}

const fullPage = (T) => ({
  minHeight: "100vh", background: T.bg, fontFamily: T.fontBody,
  display: "flex", alignItems: "center", justifyContent: "center"
});
const backBtn = (T) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 10px", borderRadius: 8,
  border: `1px solid ${T.border}`, background: T.card,
  color: T.text, fontSize: 12, fontWeight: 500, fontFamily: T.fontBody,
  cursor: "pointer", flexShrink: 0
});
const iconBtn = (T) => ({
  width: 32, height: 32, borderRadius: 8,
  border: `1px solid ${T.border}`, background: T.card,
  color: T.text, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.15s", flexShrink: 0
});
