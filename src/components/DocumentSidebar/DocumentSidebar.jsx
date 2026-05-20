// Right sidebar — "Studio". Behaves consistently with the left LibrarySidebar:
//   - Always rendered (not gated on whether a doc is open)
//   - Has a collapsed RAIL (48px) and a full layout (320px)
//   - Animated width transition with opacity crossfade between layers
//   - Persisted open/closed state controlled by the parent
//   - Header has a collapse toggle, content has tabs (Chat / Notes / Tools)
//   - When no document is selected, the tabs are replaced with a soft
//     empty state nudging the user to open one — the tabs themselves
//     assume `doc` is non-null, so we gate them at this level.

import { useState, useEffect, useRef } from "react";
import useTheme from "../../theme/useTheme.js";
import ChatTab from "./ChatTab.jsx";
import HighlightsTab from "./HighlightsTab.jsx";
import ToolsTab from "./ToolsTab.jsx";
import CardsTab from "./CardsTab.jsx";
import QuizTab from "./QuizTab.jsx";

// Resize bounds for the expanded sidebar. MIN keeps the tab strip
// readable; MAX prevents the toolbar from eating the whole canvas.
const MIN_W = 260;
const MAX_W = 640;
const DEFAULT_W = 320;
const WIDTH_KEY = "ostinote_toolbar_width";

const TABS = [
  { id: "chat", label: "Chat", icon: (c) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )},
  { id: "notes", label: "Notes", icon: (c) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  )},
  { id: "cards", label: "Cards", icon: (c) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="14" height="16" rx="2" />
      <path d="M4 7v12a2 2 0 0 0 2 2h12" />
    </svg>
  )},
  { id: "quiz", label: "Quiz", icon: (c) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )},
  { id: "tools", label: "Tools", icon: (c) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )},
];

export default function DocumentSidebar({
  doc, openDocs, aiSettings, decks,
  onAddCardToDeck, onScrollToPage, onHighlightAdded,
  highlights, setHighlights,
  open, onToggleOpen, onSelectTab,
  // Selected deck for the Cards tab (parent passes the full deck obj
  // when the user picks a deck in the Library; null otherwise).
  selectedDeck,
  // Deck-action handlers used inside the Cards tab.
  onRenameDeck, onStartStudyForDeck, onEditCardForDeck, onDeleteCardInDeck,
  onApplyRatingInDeck,
  // Cards-tab deck browser/creator wiring.
  onSelectDeck, onCreateDeck, onDeleteDeck,
}) {
  const { T } = useTheme();
  // Default to Cards when a deck is already loaded on mount (e.g. after
  // a reload that restored selectedDeckId); otherwise fall back to Chat.
  const [activeTab, setActiveTab] = useState(() => selectedDeck ? "cards" : "chat");

  // Auto-switch to Cards whenever the user picks a different deck in
  // the Library — clicking a deck implies "show me the deck", so the
  // sidebar should be on Cards. We initialize the ref to null so the
  // very first deck arrival (after mount) also triggers the swap.
  const lastDeckIdRef = useRef(null);
  useEffect(() => {
    const nextId = selectedDeck?.id || null;
    if (nextId && nextId !== lastDeckIdRef.current) {
      setActiveTab("cards");
    }
    lastDeckIdRef.current = nextId;
  }, [selectedDeck?.id]);

  // ---- Resizable width ----
  // Persisted so the user's chosen width survives reloads. Only used when
  // the sidebar is `open`; collapsed rail stays a constant 48px.
  const [expandedWidth, setExpandedWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(WIDTH_KEY), 10);
      if (Number.isFinite(v) && v >= MIN_W && v <= MAX_W) return v;
    } catch {}
    return DEFAULT_W;
  });
  useEffect(() => {
    localStorage.setItem(WIDTH_KEY, String(expandedWidth));
  }, [expandedWidth]);

  // Resize handle drag logic. The handle lives on the LEFT edge of the
  // sidebar (the sidebar is anchored to the right of the workspace), so
  // dragging LEFT widens the toolbar, RIGHT narrows it. We track the
  // start position + start width in a ref to avoid stale-closure bugs
  // when reading inside the move handler.
  const dragRef = useRef(null);
  const [resizing, setResizing] = useState(false);
  const beginResize = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: expandedWidth };
    setResizing(true);
    const onMove = (mv) => {
      if (!dragRef.current) return;
      const { startX, startWidth } = dragRef.current;
      const delta = startX - mv.clientX; // drag left → positive → widen
      const next = Math.max(MIN_W, Math.min(MAX_W, startWidth + delta));
      setExpandedWidth(next);
    };
    const onUp = () => {
      dragRef.current = null;
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // Lock cursor + suppress text selection during the drag so the page
    // doesn't flicker into "selecting" mode.
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  // Quick-jump from a rail icon: open the sidebar AND switch to the tab.
  const railClickTab = (id) => {
    setActiveTab(id);
    if (!open && onToggleOpen) onToggleOpen();
    if (onSelectTab) onSelectTab(id);
  };

  // Collapsed rail content — mirrors the left sidebar's rail. One shortcut
  // per tab on the right side gives a quick way to expand straight into
  // chat / notes / tools without an extra click.
  const railLayout = (
    <>
      <RailIconButton onClick={onToggleOpen} title="Show toolbar" T={T}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </RailIconButton>
      <div style={{ height: 8 }} />
      {TABS.map(tab => (
        <RailIconButton
          key={tab.id}
          onClick={() => railClickTab(tab.id)}
          title={tab.label}
          T={T}
          active={activeTab === tab.id && open}
        >
          {tab.icon(activeTab === tab.id && open ? T.text : T.textMid)}
        </RailIconButton>
      ))}
      <div style={{ flex: 1 }} />
    </>
  );

  return (
    <div style={{
      // Outer wrapper owns the width animation. Both inner layers are
      // always mounted; opacity crossfades while the wrapper resizes.
      // `expandedWidth` is user-resizable via the left-edge drag handle
      // (only when open — collapsed rail stays a constant 48px).
      width: open ? expandedWidth : 48,
      flexShrink: 0, height: "100%",
      borderLeft: `1px solid ${T.border}`,
      background: T.card,
      overflow: "hidden",
      position: "relative",
      // Skip the width transition during an active resize drag so the
      // sidebar tracks the cursor 1:1 instead of lagging behind it.
      transition: resizing
        ? "none"
        : "width 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      {/* Resize handle — a thin invisible strip on the left edge that the
          user can drag to widen/narrow the sidebar. A subtle visual
          accent appears on hover so the affordance is discoverable
          without cluttering the UI at rest. Only shown when the sidebar
          is open; collapsed rail can't be resized. */}
      {open && (
        <div
          onMouseDown={beginResize}
          title="Drag to resize"
          aria-label="Resize toolbar"
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: 6,
            cursor: "ew-resize",
            // Higher z so it sits above the rail/full layers even though
            // they have opacity 0 / pointer-events: none.
            zIndex: 10,
            background: resizing ? `${T.borderStrong}` : "transparent",
            transition: "background 0.12s",
          }}
          onMouseEnter={e => { if (!resizing) e.currentTarget.style.background = T.border; }}
          onMouseLeave={e => { if (!resizing) e.currentTarget.style.background = "transparent"; }}
        />
      )}

      {/* Drag-time overlay. Fixed full-viewport, transparent, sits above
          everything — including the YouTube iframe in the middle pane,
          which would otherwise capture mousemove and stutter the drag.
          Disappears the moment the user releases. */}
      {resizing && (
        <div
          style={{
            position: "fixed", inset: 0,
            zIndex: 99999, cursor: "ew-resize",
            // Background is transparent but `background` is still needed
            // so the div has a hit area on every browser.
            background: "transparent",
          }}
        />
      )}

      {/* RAIL LAYER */}
      <div style={{
        position: "absolute", inset: 0,
        width: 48,
        display: "flex", flexDirection: "column",
        alignItems: "center", paddingTop: 10, gap: 6,
        opacity: open ? 0 : 1,
        pointerEvents: open ? "none" : "auto",
        transition: "opacity 0.18s ease",
      }}>
        {railLayout}
      </div>

      {/* FULL LAYER */}
      <div style={{
        position: "absolute", inset: 0,
        // Match the outer width so the inner layer scales with the user's
        // resize. inset:0 alone would let the layer hang past the wrapper
        // when shrinking from a larger size during the transition.
        width: expandedWidth,
        display: "flex", flexDirection: "column",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.18s ease",
        fontFamily: T.fontBody,
      }}>
        {/* Header: "Tool Bar" label + collapse toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px 6px", flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: T.textLight,
            letterSpacing: 0.8, textTransform: "uppercase",
          }}>Tool Bar</span>
          <RailIconButton onClick={onToggleOpen} title="Hide toolbar" T={T}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </RailIconButton>
        </div>

        {/* Tab strip. Shares its visual spec with the PDF tab strip in
            the reader pane: outlined pill when active, soft fill on hover,
            no bottom underline. */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "8px 12px", gap: 6,
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
          overflowX: "auto", overflowY: "hidden",
        }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: active ? `1.5px solid ${T.borderStrong}` : "1.5px solid transparent",
                  background: active ? T.bgSub : "transparent",
                  color: active ? T.text : T.textLight,
                  fontSize: 12, fontWeight: 600,
                  fontFamily: T.fontBody,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = T.bgSub;
                    e.currentTarget.style.color = T.textMid;
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = T.textLight;
                  }
                }}
              >
                {tab.icon(active ? T.text : T.textLight)}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content. Chat / Notes / Tools each need an active doc and
            fall back to a shared empty state when there isn't one. The
            Cards tab is independent — it works against a selected deck,
            so it has its own empty state baked in. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {activeTab === "chat" && (doc ? (
            <ChatTab
              doc={doc}
              openDocs={openDocs}
              aiSettings={aiSettings}
              decks={decks}
              onAddCardToDeck={onAddCardToDeck}
              onScrollToPage={onScrollToPage}
            />
          ) : <NoDocEmptyState T={T} activeTab="chat" />)}
          {activeTab === "notes" && (doc ? (
            <HighlightsTab
              doc={doc}
              highlights={highlights}
              setHighlights={setHighlights}
              decks={decks}
              onAddCardToDeck={onAddCardToDeck}
              onScrollToPage={onScrollToPage}
            />
          ) : <NoDocEmptyState T={T} activeTab="notes" />)}
          {activeTab === "cards" && (
            <CardsTab
              deck={selectedDeck}
              decks={decks}
              aiSettings={aiSettings}
              onRenameDeck={onRenameDeck}
              onAddCardToDeck={onAddCardToDeck}
              onEditCard={(cardId) => selectedDeck && onEditCardForDeck?.(selectedDeck.id, cardId)}
              onDeleteCard={(cardId) => selectedDeck && onDeleteCardInDeck?.(selectedDeck.id, cardId)}
              onApplyRating={(cardId, quality) =>
                selectedDeck && onApplyRatingInDeck?.(selectedDeck.id, cardId, quality)
              }
              onSelectDeck={onSelectDeck}
              onCreateDeck={onCreateDeck}
              onDeleteDeck={onDeleteDeck}
            />
          )}
          {activeTab === "quiz" && (doc ? (
            <QuizTab
              doc={doc}
              aiSettings={aiSettings}
              decks={decks}
              onAddCardToDeck={onAddCardToDeck}
            />
          ) : <NoDocEmptyState T={T} activeTab="quiz" />)}
          {activeTab === "tools" && (doc ? (
            <ToolsTab
              doc={doc}
              aiSettings={aiSettings}
              decks={decks}
              onAddCardToDeck={onAddCardToDeck}
            />
          ) : <NoDocEmptyState T={T} activeTab="tools" />)}
        </div>
      </div>
    </div>
  );
}

// Tab-specific empty state. Keeps the studio feeling alive even before a
// document is open: each tab explains what it'll do once one is.
function NoDocEmptyState({ T, activeTab }) {
  const copy = {
    chat:  { title: "Chat with a document", body: "Open a PDF from the Library to ask questions and get cited answers." },
    notes: { title: "Highlights & notes",   body: "Open a PDF from the Library, then select text to start highlighting." },
    quiz:  { title: "Quiz yourself",         body: "Open a PDF from the Library to generate a quiz and turn it into cards." },
    tools: { title: "Study tools",          body: "Open a PDF from the Library to auto-generate flashcards and summaries." },
  };
  const c = copy[activeTab] || copy.chat;
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: T.fontBody, textAlign: "center",
    }}>
      <div style={{ maxWidth: 240 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: T.bgSub, margin: "0 auto 14px",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: T.textLight, border: `1.5px dashed ${T.border}`,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
          {c.title}
        </div>
        <p style={{ fontSize: 12.5, color: T.textMid, lineHeight: 1.55, margin: 0 }}>
          {c.body}
        </p>
      </div>
    </div>
  );
}

// Small icon-only button used inside the rail. Same visual spec as
// LibrarySidebar.IconButton so the two rails look identical.
function RailIconButton({ onClick, title, children, T, active = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        width: 32, height: 32, borderRadius: 6,
        border: "none",
        background: active ? T.bgSub : "transparent",
        cursor: "pointer", color: active ? T.text : T.textMid,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0,
        transition: "background 0.15s ease, color 0.15s ease",
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = T.bgSub;
          e.currentTarget.style.color = T.text;
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = T.textMid;
        }
      }}
    >{children}</button>
  );
}
