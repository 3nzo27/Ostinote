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
  aiSettings,
  onRenameDeck,
  onAddCardToDeck,     // (deckIdOrSpec, { front, back, tags })
  onEditCard,          // (cardId) — fullscreen edit
  onDeleteCard,        // (cardId) — inline mutation
  onApplyRating,       // (cardId, quality) — SM2 grade applied inline
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

  // ---- Empty state when no deck selected ----
  if (!deck) {
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
              <rect x="6" y="3" width="14" height="16" rx="2" />
              <path d="M4 7v12a2 2 0 0 0 2 2h12" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
            Flashcards
          </div>
          <p style={{ fontSize: 12.5, color: T.textMid, lineHeight: 1.55, margin: 0 }}>
            Click a deck in the Library to study and edit its cards here.
          </p>
        </div>
      </div>
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
