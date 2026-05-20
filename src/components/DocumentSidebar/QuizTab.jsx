// Quiz tab in the Tool Bar. Generates questions from the active doc,
// quizzes the user in the exact same flashcard format as a study
// session (FlipCard + typed answer + AI grading + self-rate), then
// drops them into an editable review screen where the user can tweak
// each question/answer before adding the batch to a deck.
//
// Three modes:
//   "intro"     — pick a question count + generate
//   "quizzing"  — StudyView (inWindow) over the generated cards
//   "review"    — per-card inline editor + score recap + add-to-deck
//
// Quiz cards are held in the {front:{text}, back:{text}, tags} shape
// that StudyView/FlipCard/gradeCardAnswer expect. They're flattened
// back to string front/back when handed to onAddCardToDeck (which
// re-wraps them — see FlashcardApp.addCardToDeck).

import { useState } from "react";
import useTheme from "../../theme/useTheme.js";
import StudyView from "../../views/StudyView/StudyView.jsx";
import DeckPickerModal from "./DeckPickerModal.jsx";
import { generateFlashcardsFromDocument } from "../../utils/documentAi.js";
import { gradeCardAnswer } from "../../utils/gradeCardAnswer.js";

const RATING_META = {
  0: { label: "Forgot", colorKey: "forgot", bgKey: "dueBg" },
  2: { label: "Hard", colorKey: "hard", bgKey: "hardBg" },
  3: { label: "Good", colorKey: "good", bgKey: "goodBg" },
  4: { label: "Easy", colorKey: "easy", bgKey: "easyBg" },
  5: { label: "Perfect", colorKey: "perfect", bgKey: "perfectBg" },
};
const COUNT_OPTIONS = [5, 10, 15, 20];

export default function QuizTab({ doc, aiSettings, decks, onAddCardToDeck }) {
  const { T } = useTheme();
  const [mode, setMode] = useState("intro");      // intro | quizzing | review
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // The generated quiz cards (in StudyView's {text} shape).
  const [cards, setCards] = useState([]);
  // Per-card quiz result keyed by card id → rating number.
  const [results, setResults] = useState({});
  const [pendingDeck, setPendingDeck] = useState(false);

  // ---- Study session state (mirrors CardsTab) ----
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [guess, setGuess] = useState("");
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showFlipHint, setShowFlipHint] = useState(false);
  const [hideFlipHintForever, setHideFlipHintForever] = useState(false);

  const hasApiKey = !!aiSettings?.apiKey || aiSettings?.provider === "claude-local";

  const resetCardState = () => {
    setFlipped(false);
    setGuess("");
    setGuessSubmitted(false);
    setAiResult(null);
    setAiLoading(false);
  };

  const handleGenerate = async () => {
    if (!hasApiKey) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await generateFlashcardsFromDocument({ aiSettings, doc, count });
      if (!raw.length) throw new Error("No questions came back — try again.");
      const formatted = raw.map((c, i) => ({
        id: `quiz-${Date.now()}-${i}`,
        front: { text: c.front || "" },
        back: { text: c.back || "" },
        tags: c.tags || [],
        page: c.page,
      }));
      setCards(formatted);
      setResults({});
      setStudyIndex(0);
      resetCardState();
      setMode("quizzing");
    } catch (err) {
      setError(err.message || "Couldn't generate a quiz");
    } finally {
      setLoading(false);
    }
  };

  // ---- Study handlers ----
  const handleFlip = () => setFlipped(f => !f);
  const skipGuess = () => { setFlipped(true); setGuessSubmitted(true); };
  const submitGuess = async () => {
    const card = cards[studyIndex];
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
    const card = cards[studyIndex];
    if (!card) return;
    setResults(prev => ({ ...prev, [card.id]: quality }));
    if (studyIndex + 1 < cards.length) {
      setStudyIndex(i => i + 1);
      resetCardState();
    } else {
      // Quiz complete → editable review screen.
      setMode("review");
    }
  };
  const exitQuiz = () => {
    // Bail out of the quiz early — keep whatever was generated and jump
    // to review so the user doesn't lose the questions.
    setMode("review");
  };

  // ---- Review-screen helpers ----
  const updateCardField = (id, side, value) => {
    setCards(prev => prev.map(c => c.id === id
      ? { ...c, [side]: { ...c[side], text: value } }
      : c));
  };
  const updateCardTags = (id, value) => {
    const tags = value.split(",").map(t => t.trim()).filter(Boolean);
    setCards(prev => prev.map(c => c.id === id ? { ...c, tags } : c));
  };
  const removeCard = (id) => {
    setCards(prev => prev.filter(c => c.id !== id));
    setResults(prev => { const n = { ...prev }; delete n[id]; return n; });
  };
  const handleSaveToDeck = (deckId) => {
    cards.forEach(c => onAddCardToDeck(deckId, {
      front: c.front.text,
      back: c.back.text,
      tags: c.tags || [],
    }));
    setPendingDeck(false);
    // Reset back to intro for a fresh run.
    setCards([]);
    setResults({});
    setMode("intro");
  };

  // ============ RENDER ============

  if (mode === "quizzing") {
    return (
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ padding: "10px 14px 0" }}>
          <QuizHeader T={T} title={`Quiz · ${studyIndex + 1}/${cards.length}`} onBack={exitQuiz} backLabel="End quiz" />
        </div>
        <StudyView
          inWindow
          studyCards={cards}
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
          onNavigate={exitQuiz}
        />
      </div>
    );
  }

  if (mode === "review") {
    return (
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "12px 14px 24px", fontFamily: T.fontBody }}>
        <QuizHeader T={T} title="Review & edit" onBack={() => { setCards([]); setResults({}); setMode("intro"); }} backLabel="Discard" />
        <ScoreRecap T={T} cards={cards} results={results} />
        {cards.length === 0 ? (
          <div style={{ padding: "20px 4px", fontSize: 12.5, color: T.textLight, lineHeight: 1.5 }}>
            No cards left. Discard to start over.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {cards.map(c => (
              <ReviewCard
                key={c.id} T={T} card={c} rating={results[c.id]}
                onChangeFront={(v) => updateCardField(c.id, "front", v)}
                onChangeBack={(v) => updateCardField(c.id, "back", v)}
                onChangeTags={(v) => updateCardTags(c.id, v)}
                onRemove={() => removeCard(c.id)}
              />
            ))}
          </div>
        )}
        {cards.length > 0 && (
          <div style={{
            display: "flex", gap: 8, marginTop: 14,
            position: "sticky", bottom: 0, background: T.card, padding: "10px 0",
          }}>
            <button onClick={() => { setCards([]); setResults({}); setMode("intro"); }} style={btnSecondary(T)}>Discard</button>
            <button onClick={() => setPendingDeck(true)} style={btnPrimary(T)}>
              Add {cards.length} to deck →
            </button>
          </div>
        )}
        {pendingDeck && (
          <DeckPickerModal
            cards={cards.map(c => ({ front: c.front.text, back: c.back.text, tags: c.tags }))}
            decks={decks}
            onCancel={() => setPendingDeck(false)}
            onSave={(deckId) => handleSaveToDeck(deckId)}
          />
        )}
      </div>
    );
  }

  // intro
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px", fontFamily: T.fontBody }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: T.textMid,
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
      }}>
        Quiz yourself on this document
      </div>

      <p style={{ fontSize: 12.5, color: T.textMid, lineHeight: 1.55, marginBottom: 16 }}>
        Generates questions from the document and quizzes you just like a study
        session — type your answer, get graded, self-rate. Afterward you can edit
        the questions before saving them to a deck.
      </p>

      <div style={{ fontSize: 11, fontWeight: 600, color: T.textMid, marginBottom: 8 }}>
        Number of questions
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {COUNT_OPTIONS.map(n => {
          const active = count === n;
          return (
            <button
              key={n}
              onClick={() => setCount(n)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                border: active ? `1.5px solid ${T.borderStrong}` : `1.5px solid ${T.border}`,
                background: active ? T.bgSub : T.card,
                color: active ? T.text : T.textMid,
                fontSize: 13, fontWeight: 600, fontFamily: T.fontBody, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >{n}</button>
          );
        })}
      </div>

      <button
        onClick={handleGenerate}
        disabled={!hasApiKey || loading}
        style={{
          width: "100%", padding: "11px", borderRadius: 10, border: "none",
          background: (!hasApiKey || loading) ? T.bgSub : T.text,
          color: (!hasApiKey || loading) ? T.textLight : T.card,
          fontSize: 13, fontWeight: 600, fontFamily: T.fontBody,
          cursor: (!hasApiKey || loading) ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {loading ? "Generating quiz…" : `Start ${count}-question quiz`}
      </button>

      {!hasApiKey && (
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: 8,
          background: `${T.hard || "#c47f2a"}10`, border: `1px solid ${T.hard || "#c47f2a"}30`,
          fontSize: 11, color: T.textMid, lineHeight: 1.5,
        }}>
          Quizzes need a cloud AI provider configured in Settings.
        </div>
      )}
      {error && (
        <div style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 8,
          background: T.dueBg, color: T.due, fontSize: 12, fontFamily: T.fontBody,
        }}>{error}</div>
      )}
    </div>
  );
}

// ---- subcomponents ----

function QuizHeader({ T, title, onBack, backLabel = "Back" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.fontBody }}>{title}</div>
      <button
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 10px", borderRadius: 6,
          border: `1px solid ${T.border}`, background: T.card,
          color: T.textMid, fontSize: 11, fontWeight: 600,
          fontFamily: T.fontBody, cursor: "pointer",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
      >{backLabel}</button>
    </div>
  );
}

function ScoreRecap({ T, cards, results }) {
  const rated = cards.filter(c => results[c.id] != null);
  if (rated.length === 0) return null;
  // Tally by rating.
  const tally = {};
  for (const c of rated) {
    const r = results[c.id];
    tally[r] = (tally[r] || 0) + 1;
  }
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6,
      padding: "10px 12px", borderRadius: 10,
      background: T.bgSub, border: `1px solid ${T.border}`,
    }}>
      <div style={{ width: "100%", fontSize: 11, fontWeight: 600, color: T.textMid, marginBottom: 2 }}>
        You scored
      </div>
      {Object.keys(RATING_META).map(k => {
        const n = tally[k];
        if (!n) return null;
        const meta = RATING_META[k];
        return (
          <span key={k} style={{
            padding: "2px 8px", borderRadius: 999,
            background: T[meta.bgKey] || T.bgSub,
            color: T[meta.colorKey] || T.textMid,
            fontSize: 11, fontWeight: 700, fontFamily: T.fontBody,
          }}>{n} {meta.label}</span>
        );
      })}
    </div>
  );
}

function ReviewCard({ T, card, rating, onChangeFront, onChangeBack, onChangeTags, onRemove }) {
  const meta = rating != null ? RATING_META[rating] : null;
  return (
    <div style={{
      padding: "12px", borderRadius: 10,
      background: T.cardAlt, border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {meta && (
          <span style={{
            padding: "2px 8px", borderRadius: 999,
            background: T[meta.bgKey] || T.bgSub,
            color: T[meta.colorKey] || T.textMid,
            fontSize: 10, fontWeight: 700, fontFamily: T.fontBody,
          }}>{meta.label}</span>
        )}
        {card.page != null && (
          <span style={{ fontSize: 10, color: T.textLight }}>p.{card.page}</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onRemove}
          aria-label="Remove card"
          style={{
            background: "none", border: "none", padding: 2, cursor: "pointer",
            color: T.textLight, display: "flex",
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.due}
          onMouseLeave={e => e.currentTarget.style.color = T.textLight}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      <FieldLabel T={T}>Question</FieldLabel>
      <AutoTextarea T={T} value={card.front.text} onChange={onChangeFront} placeholder="Question…" />

      <FieldLabel T={T} style={{ marginTop: 8 }}>Answer</FieldLabel>
      <AutoTextarea T={T} value={card.back.text} onChange={onChangeBack} placeholder="Answer…" />

      <FieldLabel T={T} style={{ marginTop: 8 }}>Tags (comma-separated)</FieldLabel>
      <input
        value={(card.tags || []).join(", ")}
        onChange={e => onChangeTags(e.target.value)}
        placeholder="tag1, tag2"
        style={{
          width: "100%", padding: "6px 8px", fontSize: 12,
          borderRadius: 6, border: `1.5px solid ${T.border}`,
          background: T.inputBg, color: T.text, fontFamily: T.fontBody,
          outline: "none", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function FieldLabel({ T, children, style }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: T.textLight, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, ...style }}>
      {children}
    </div>
  );
}

function AutoTextarea({ T, value, onChange, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      style={{
        width: "100%", padding: "7px 9px", fontSize: 12.5, lineHeight: 1.5,
        borderRadius: 6, border: `1.5px solid ${T.border}`,
        background: T.inputBg, color: T.text, fontFamily: T.fontBody,
        outline: "none", resize: "vertical", boxSizing: "border-box",
      }}
      onFocus={e => e.target.style.borderColor = T.borderStrong}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  );
}

const btnPrimary = (T) => ({
  flex: 1, padding: "9px 12px", borderRadius: 10, border: "none",
  background: T.text, color: T.card, fontWeight: 600, fontSize: 12,
  fontFamily: T.fontBody, cursor: "pointer",
});
const btnSecondary = (T) => ({
  padding: "9px 14px", borderRadius: 10, border: `1px solid ${T.border}`,
  background: T.card, color: T.textMid, fontWeight: 500, fontSize: 12,
  fontFamily: T.fontBody, cursor: "pointer",
});
