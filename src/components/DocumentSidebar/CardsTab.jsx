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
import DeckItem from "../DeckItem/DeckItem.jsx";
import DeleteConfirmModal from "../DeleteConfirmModal/DeleteConfirmModal.jsx";
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
// selected. Mirrors the standalone-app DecksView: DeckItem cards in a
// single column, inline create form, dashed "+ New Deck" button at the
// bottom, and the original empty-state illustration.
function DeckBrowser({ T, decks, onSelectDeck, onCreateDeck, onDeleteDeck }) {
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const sorted = useMemo(() => {
    return [...(decks || [])].sort((a, b) => {
      const aDue = (a.cards || []).filter(c => c.nextReview <= Date.now()).length;
      const bDue = (b.cards || []).filter(c => c.nextReview <= Date.now()).length;
      return bDue - aDue;
    });
  }, [decks]);

  const submitNew = () => {
    const trimmed = newDeckName.trim();
    if (!trimmed) return;
    onCreateDeck?.(trimmed);
    setNewDeckName("");
    setShowNewDeck(false);
  };

  // Empty state — same illustration + "Create Your First Deck" CTA as
  // the original standalone DecksView.
  if (sorted.length === 0 && !showNewDeck) {
    return (
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 16px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.fontBody, marginBottom: 12 }}>All Decks</h2>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "32px 16px", textAlign: "center", animation: "fadeIn 0.4s ease",
        }}>
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16, opacity: 0.65 }}>
            <rect x="10" y="14" width="34" height="40" rx="4" stroke={T.textLight} strokeWidth="1.5" fill="none" />
            <rect x="20" y="8" width="34" height="40" rx="4" stroke={T.textLight} strokeWidth="1.5" fill={T.card} />
            <line x1="28" y1="20" x2="46" y2="20" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="28" y1="28" x2="42" y2="28" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <line x1="28" y1="36" x2="44" y2="36" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <circle cx="47" cy="43" r="10" fill={T.accent} opacity="0.15" />
            <line x1="43" y1="43" x2="51" y2="43" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
            <line x1="47" y1="39" x2="47" y2="47" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 6 }}>No decks yet</p>
          <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, marginBottom: 20, lineHeight: 1.5 }}>
            Create your first deck to start learning with spaced repetition
          </p>
          <button onClick={() => setShowNewDeck(true)} style={{
            padding: "10px 22px", borderRadius: T.radius, border: "none",
            background: T.accent, color: T.white, fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: T.fontBody,
            boxShadow: "0 2px 8px rgba(44,42,37,0.2)", transition: "all 0.15s",
          }}>Create Your First Deck</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 16px 24px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.fontBody, marginBottom: 12 }}>All Decks</h2>

      {/* Deck list — single column of DeckItem cards (the sidebar isn't
          wide enough for the DecksView grid). */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn 0.3s ease" }}>
        {sorted.map(deck => (
          <DeckItem
            key={deck.id}
            deck={deck}
            onSelect={() => onSelectDeck?.(deck.id)}
            onDelete={() => setConfirmDeleteId(deck.id)}
          />
        ))}
      </div>

      {/* Inline create form / "+ New Deck" dashed button — same as the
          original standalone DecksView (just scaled in for sidebar width). */}
      {showNewDeck ? (
        <div style={{
          marginTop: 12, padding: 16,
          background: T.card, borderRadius: T.radiusLg,
          border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2,
          animation: "fadeIn 0.3s ease",
        }}>
          <input
            value={newDeckName}
            onChange={e => setNewDeckName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitNew()}
            placeholder="Deck name..."
            autoFocus
            style={{
              width: "100%", padding: "9px 12px",
              border: `1.5px solid ${T.border}`, borderRadius: T.radius,
              fontSize: 14, outline: "none", marginBottom: 10,
              fontFamily: T.fontBody, color: T.text, background: T.inputBg,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setShowNewDeck(false); setNewDeckName(""); }}
              style={{
                padding: "7px 14px", borderRadius: T.radius,
                border: `1.5px solid ${T.border}`, background: T.white,
                cursor: "pointer", fontSize: 12, color: T.textMid, fontFamily: T.fontBody,
              }}
            >Cancel</button>
            <button
              onClick={submitNew}
              style={{
                padding: "7px 14px", borderRadius: T.radius, border: "none",
                background: T.accent, color: T.white,
                fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: T.fontBody,
                boxShadow: "0 2px 8px rgba(44,42,37,0.2)",
              }}
            >Create</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewDeck(true)}
          style={{
            marginTop: 12, width: "100%", padding: "14px",
            borderRadius: T.radiusLg,
            border: `2px dashed ${T.borderStrong}`,
            background: "transparent",
            color: T.textMid, fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "all 0.2s",
            fontFamily: T.fontBody,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.textMid; }}
        >+ New Deck</button>
      )}

      {confirmDeleteId && (
        <DeleteConfirmModal
          deckName={(decks || []).find(d => d.id === confirmDeleteId)?.name}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => { onDeleteDeck?.(confirmDeleteId); setConfirmDeleteId(null); }}
        />
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
