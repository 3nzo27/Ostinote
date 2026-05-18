// Cards tab in the Tool Bar (right sidebar). Renders the currently-
// selected deck inside the sidebar with three internal modes:
//   "list"     — deck overview (cards + Study/Add buttons)
//   "addCard"  — inline CardEditor for a new card
//   "study"    — inline study session (StudyView in compact mode)
//
// Study, Add, Delete, and Rename all happen WITHOUT leaving the Tool
// Bar. Edit card is still a fullscreen handoff (the editor is heavy and
// often needs more room than the sidebar offers).

import { useState, useMemo, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";
import DeckView from "../../views/DeckView/DeckView.jsx";
import StudyView from "../../views/StudyView/StudyView.jsx";
import CardEditor from "../CardEditor/CardEditor.jsx";
import { gradeCardAnswer } from "../../utils/gradeCardAnswer.js";

export default function CardsTab({
  deck,
  decks,               // full deck list — drives the in-tab deck browser
  aiSettings,
  onRenameDeck,
  onAddCardToDeck,     // (deckIdOrSpec, { front, back, tags })
  onEditCard,          // (cardId) — fullscreen edit
  onDeleteCard,        // (cardId) — inline mutation
  onApplyRating,       // (cardId, quality) — SM2 grade applied inline
  onSelectDeck,        // (deckId | null) — switch / clear the active deck
  onCreateDeck,        // (name) — create + auto-select a new deck
  onDeleteDeck,        // (deckId) — delete from the browser
}) {
  const { T } = useTheme();
  const dueCards = useMemo(
    () => (deck?.cards || []).filter(c => c.nextReview <= Date.now()),
    [deck]
  );
  const [renamingDeck, setRenamingDeck] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [mode, setMode] = useState("list");

  // ---- Per-tab study session state ----
  // Snapshotted on Study click so the session pool doesn't shift mid-
  // review when SM2 mutations push due dates forward.
  const [studyCardIds, setStudyCardIds] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [guess, setGuess] = useState("");
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showFlipHint, setShowFlipHint] = useState(false);
  const [hideFlipHintForever, setHideFlipHintForever] = useState(false);

  const studyCards = useMemo(
    () => studyCardIds.map(id => (deck?.cards || []).find(c => c.id === id)).filter(Boolean),
    [studyCardIds, deck]
  );

  // If the user closes/changes deck while in addCard or study mode, bail
  // back to list so we don't render against the wrong deck.
  const lastDeckId = useRef(deck?.id);
  useEffect(() => {
    if (deck?.id !== lastDeckId.current) {
      lastDeckId.current = deck?.id;
      setMode("list");
      resetStudySession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck?.id]);

  const resetStudySession = () => {
    setStudyCardIds([]);
    setStudyIndex(0);
    setFlipped(false);
    setGuess("");
    setGuessSubmitted(false);
    setAiResult(null);
    setAiLoading(false);
  };

  // ---- Deck browser when no deck is selected ----
  if (!deck) {
    return (
      <DeckBrowser
        T={T}
        decks={decks || []}
        onSelectDeck={onSelectDeck}
        onCreateDeck={onCreateDeck}
        onDeleteDeck={onDeleteDeck}
      />
    );
  }

  const commitRename = () => {
    const next = renameValue.trim();
    if (next) onRenameDeck?.(deck.id, next);
    setRenamingDeck(false);
  };

  const adaptedOnNavigate = (target) => {
    if (target === "addCard") setMode("addCard");
  };

  const handleAddCardSave = (front, back, tags) => {
    onAddCardToDeck?.(deck.id, {
      front: front?.text ?? "",
      back: back?.text ?? "",
      tags,
    });
    setMode("list");
  };

  // ---- Inline study handlers ----
  const startStudy = () => {
    if (dueCards.length === 0) return;
    setStudyCardIds(dueCards.map(c => c.id));
    setStudyIndex(0);
    setFlipped(false);
    setGuess("");
    setGuessSubmitted(false);
    setAiResult(null);
    setAiLoading(false);
    setMode("study");
  };

  const exitStudy = () => {
    resetStudySession();
    setMode("list");
  };

  const handleFlip = () => setFlipped(f => !f);
  const skipGuess = () => { setFlipped(true); setGuessSubmitted(true); };
  const submitGuess = async () => {
    const card = studyCards[studyIndex];
    if (!card) return;
    setGuessSubmitted(true);
    setFlipped(true);
    setAiLoading(true);
    setAiResult(null);
    const result = await gradeCardAnswer({ card, guess, aiSettings });
    setAiResult(result);
    setAiLoading(false);
  };
  const handleRate = (quality) => {
    const card = studyCards[studyIndex];
    if (!card) return;
    onApplyRating?.(card.id, quality);
    if (studyIndex + 1 < studyCardIds.length) {
      setStudyIndex(i => i + 1);
      setFlipped(false);
      setGuess("");
      setGuessSubmitted(false);
      setAiResult(null);
      setAiLoading(false);
    } else {
      // Session complete — back to list
      exitStudy();
    }
  };

  // ---- Mode rendering ----

  if (mode === "addCard") {
    return (
      // Wrapper grows to fill the entire Tool Bar vertical space
      // (flex: 1 + minHeight: 0). Whatever empty area sits below the
      // card is scrollable runway — the flip animation's shadow can
      // extend into it all the way down to the bottom of the Tool Bar
      // without ever hitting a clip boundary.
      <div style={{
        flex: 1, minHeight: 0, overflow: "auto",
        padding: "12px 14px 24px",
      }}>
        <InlineEditorHeader T={T} title="New card" onBack={() => setMode("list")} />
        <CardEditor
          onSave={handleAddCardSave}
          onCancel={() => setMode("list")}
          saveLabel="Add Card"
        />
      </div>
    );
  }

  if (mode === "study") {
    return (
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ padding: "10px 14px 0" }}>
          <InlineEditorHeader T={T} title={`Studying · ${deck.name}`} onBack={exitStudy} />
        </div>
        <StudyView
          inWindow
          studyCards={studyCards}
          studyIndex={studyIndex}
          flipped={flipped}
          guess={guess}
          guessSubmitted={guessSubmitted}
          aiResult={aiResult}
          aiLoading={aiLoading}
          showFlipHint={showFlipHint}
          hideFlipHintForever={hideFlipHintForever}
          setGuess={setGuess}
          submitGuess={submitGuess}
          skipGuess={skipGuess}
          handleFlip={handleFlip}
          handleRate={handleRate}
          setShowFlipHint={setShowFlipHint}
          setHideFlipHintForever={setHideFlipHintForever}
          onNavigate={exitStudy}
        />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      {/* Back-to-decks affordance — stays consistent with the inline
          editor's header so users always have a visible escape hatch. */}
      <div style={{ padding: "10px 14px 0" }}>
        <DeckListBackLink T={T} onBack={() => onSelectDeck?.(null)} />
      </div>
      <DeckView
        inWindow
        activeDeck={deck}
        dueCards={dueCards}
        renamingDeck={renamingDeck}
        setRenamingDeck={setRenamingDeck}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        renameDeck={commitRename}
        startStudy={startStudy}
        deleteCard={(cardId) => onDeleteCard?.(cardId)}
        setEditCardId={(cardId) => onEditCard?.(cardId)}
        onNavigate={adaptedOnNavigate}
      />
    </div>
  );
}

// "← Decks" link rendered above the per-deck view so the user can return
// to the deck list without losing context.
function DeckListBackLink({ T, onBack }) {
  return (
    <button
      onClick={onBack}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px 3px 6px", borderRadius: 6,
        border: "none", background: "transparent",
        color: T.textMid, fontSize: 11, fontWeight: 600,
        fontFamily: T.fontBody, cursor: "pointer",
        transition: "color 0.15s, background 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMid; }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
      </svg>
      Decks
    </button>
  );
}

// Inline deck browser shown inside the Cards tab when no deck is
// selected. Reuses the exact LibrarySidebar idiom for section header,
// section-action button, and deck rows so the two sidebars feel like
// one design system.
function DeckBrowser({ T, decks, onSelectDeck, onCreateDeck, onDeleteDeck }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  const sorted = useMemo(() => {
    return [...(decks || [])].sort((a, b) => {
      const aDue = (a.cards || []).filter(c => c.nextReview <= Date.now()).length;
      const bDue = (b.cards || []).filter(c => c.nextReview <= Date.now()).length;
      return bDue - aDue;
    });
  }, [decks]);

  const submit = () => {
    const trimmed = newName.trim();
    if (!trimmed) { setCreating(false); setNewName(""); return; }
    onCreateDeck?.(trimmed);
    setNewName("");
    setCreating(false);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "8px 6px 14px" }}>
      {/* Section header — mirrors LibrarySidebar's SectionHeader spec:
          uppercase 11px caps label + inline action button on the right. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 8px",
        color: T.textLight, fontFamily: T.fontBody,
        fontSize: 11, fontWeight: 700,
        letterSpacing: 0.8, textTransform: "uppercase",
        userSelect: "none",
      }}>
        <span style={{ flex: 1 }}>Decks</span>
        <button
          onClick={() => setCreating(true)}
          title="New deck"
          aria-label="New deck"
          style={{
            width: 22, height: 22, borderRadius: 6,
            border: "none", background: "transparent",
            cursor: "pointer", color: T.textMid,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMid; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Inline create row — same row geometry as a deck row so it
          replaces the slot inline rather than introducing a new card. */}
      {creating && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 6,
          background: T.bgSub,
        }}>
          <span style={{ width: 10, flexShrink: 0 }} />
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="6" y="3" width="14" height="16" rx="2" />
            <path d="M4 7v12a2 2 0 0 0 2 2h12" />
          </svg>
          <input
            ref={inputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={submit}
            onKeyDown={e => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            placeholder="Deck name…"
            style={{
              flex: 1, minWidth: 0,
              padding: "2px 4px", fontSize: 13.5,
              border: "none", outline: "none",
              background: "transparent", color: T.text, fontFamily: T.fontBody,
            }}
          />
        </div>
      )}

      {/* Deck rows — same spec as LibrarySidebar's renderDeckInTree. */}
      {sorted.length === 0 && !creating ? (
        <div style={{
          padding: "8px 12px 4px",
          fontSize: 12.5, color: T.textLight, fontFamily: T.fontBody,
          lineHeight: 1.55,
        }}>
          No decks yet. Tap <strong style={{ color: T.textMid }}>+</strong> to create your first one.
        </div>
      ) : (
        sorted.map(d => {
          const dueCount = (d.cards || []).filter(c => c.nextReview <= Date.now()).length;
          return (
            <div
              key={d.id}
              onClick={() => onSelectDeck?.(d.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 6,
                cursor: "pointer", userSelect: "none",
                background: "transparent",
                color: T.textMid, fontFamily: T.fontBody,
                fontSize: 13.5, fontWeight: 400,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: 10, flexShrink: 0 }} />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="6" y="3" width="14" height="16" rx="2" />
                <path d="M4 7v12a2 2 0 0 0 2 2h12" />
              </svg>
              <span style={{
                flex: 1, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{d.name}</span>
              {dueCount > 0 && (
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 600, color: T.due,
                  padding: "0 5px",
                }}>{dueCount}</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// Small back-row header used at the top of an inline editor mode so the
// user always has a visible escape hatch.
function InlineEditorHeader({ T, title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <button
        onClick={onBack}
        title="Back to deck"
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 10px", borderRadius: 6,
          border: `1.5px solid ${T.border}`, background: T.card,
          color: T.textMid, fontSize: 11, fontWeight: 600,
          fontFamily: T.fontBody, cursor: "pointer",
          transition: "border-color 0.15s ease, color 0.15s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontBody,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{title}</span>
    </div>
  );
}
