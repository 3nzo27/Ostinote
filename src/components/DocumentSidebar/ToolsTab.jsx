import { useState } from "react";
import useTheme from "../../theme/useTheme.js";
import { generateFlashcardsFromDocument } from "../../utils/documentAi.js";
import DeckPickerModal from "./DeckPickerModal.jsx";

export default function ToolsTab({ doc, aiSettings, decks, onAddCardToDeck }) {
  const { T } = useTheme();
  const [batchCards, setBatchCards] = useState(null); // generated cards awaiting review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingDeck, setPendingDeck] = useState(false); // showing deck picker

  // Cloud key OR keyless claude-local both satisfy the gate.
  const hasApiKey = !!aiSettings?.apiKey || aiSettings?.provider === "claude-local";

  const handleGenerateBatch = async () => {
    if (!hasApiKey) return;
    setLoading(true);
    setError(null);
    try {
      const cards = await generateFlashcardsFromDocument({ aiSettings, doc, count: 10 });
      setBatchCards(cards.map((c, i) => ({ ...c, id: i, included: true })));
    } catch (err) {
      setError(err.message || "Couldn't generate flashcards");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBatch = (deckId) => {
    const toAdd = batchCards.filter(c => c.included);
    toAdd.forEach(c => onAddCardToDeck(deckId, {
      front: c.front, back: c.back, tags: c.tags || []
    }));
    setBatchCards(null);
    setPendingDeck(false);
  };

  // ----- Review screen for batch-generated cards -----
  if (batchCards) {
    const includedCount = batchCards.filter(c => c.included).length;
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", fontFamily: T.fontBody }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: T.textMid,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10
        }}>
          Review {batchCards.length} cards · {includedCount} selected
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {batchCards.map(c => (
            <div key={c.id} style={{
              padding: "10px 12px", borderRadius: 10,
              background: c.included ? T.cardAlt : T.bgSub,
              border: `1px solid ${T.border}`,
              opacity: c.included ? 1 : 0.55,
              fontSize: 12, color: T.text, lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Q: {c.front}</div>
              <div style={{ color: T.textMid }}>A: {c.back}</div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginTop: 8, fontSize: 10, color: T.textLight
              }}>
                {c.page != null && <span>p.{c.page}</span>}
                {(c.tags || []).slice(0, 3).map(t => (
                  <span key={t} style={{
                    padding: "1px 6px", borderRadius: 999,
                    background: T.bgSub, border: `1px solid ${T.border}`,
                    fontSize: 9, fontWeight: 600
                  }}>{t}</span>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={() => setBatchCards(prev => prev.map(x => x.id === c.id ? { ...x, included: !x.included } : x))} style={{
                  background: "none", border: "none", color: T.textMid,
                  fontSize: 10, fontWeight: 600, cursor: "pointer", padding: "2px 6px"
                }}>{c.included ? "Skip" : "Include"}</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          display: "flex", gap: 8, marginTop: 14,
          position: "sticky", bottom: 0, background: T.card, padding: "10px 0"
        }}>
          <button onClick={() => setBatchCards(null)} style={btnSecondary(T)}>Discard</button>
          <button
            onClick={() => setPendingDeck(true)}
            disabled={includedCount === 0}
            style={{ ...btnPrimary(T), opacity: includedCount === 0 ? 0.5 : 1 }}
          >Add {includedCount} to deck →</button>
        </div>
        {pendingDeck && (
          <DeckPickerModal
            cards={batchCards.filter(c => c.included)}
            decks={decks}
            onCancel={() => setPendingDeck(false)}
            onSave={(deckId) => handleSaveBatch(deckId)}
          />
        )}
      </div>
    );
  }

  // ----- Tool launcher grid -----
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px", fontFamily: T.fontBody }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: T.textMid,
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12
      }}>
        Generate from this document
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <ToolCard
          T={T} icon={<FlashcardIcon />} title="Flashcards"
          description="Auto-generate 10 spaced-repetition cards from the document"
          onClick={handleGenerateBatch} disabled={!hasApiKey || loading}
          loading={loading}
        />
        <ToolCard
          T={T} icon={<QuizIcon />} title="Quiz Me"
          description="Coming soon — generate a quiz from this document"
          disabled
        />
        <ToolCard
          T={T} icon={<SummaryIcon />} title="Summary"
          description="Coming soon — get a structured summary"
          disabled
        />
        <ToolCard
          T={T} icon={<MindMapIcon />} title="Mind Map"
          description="Coming soon — visual concept map"
          disabled
        />
      </div>

      {!hasApiKey && (
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: 8,
          background: `${T.hard || "#c47f2a"}10`, border: `1px solid ${T.hard || "#c47f2a"}30`,
          fontSize: 11, color: T.textMid, lineHeight: 1.5
        }}>
          Tools need a cloud AI provider configured in Settings.
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 8,
          background: T.dueBg, color: T.due, fontSize: 12, fontFamily: T.fontBody
        }}>{error}</div>
      )}
    </div>
  );
}

// ---- subcomponents ----

function ToolCard({ T, icon, title, description, onClick, disabled, loading }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        textAlign: "left", padding: "14px 12px",
        borderRadius: 12, border: `1px solid ${T.border}`,
        background: T.card, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "all 0.15s", fontFamily: T.fontBody,
        display: "flex", flexDirection: "column", gap: 8, minHeight: 110
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.boxShadow = T.shadow1; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: T.bgSub, color: T.textMid,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>
          {loading ? "Generating…" : title}
        </div>
        <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  );
}

const btnPrimary = (T) => ({
  flex: 1, padding: "9px 12px", borderRadius: 10, border: "none",
  background: T.text, color: T.card, fontWeight: 600, fontSize: 12,
  fontFamily: T.fontBody, cursor: "pointer"
});
const btnSecondary = (T) => ({
  padding: "9px 14px", borderRadius: 10, border: `1px solid ${T.border}`,
  background: T.card, color: T.textMid, fontWeight: 500, fontSize: 12,
  fontFamily: T.fontBody, cursor: "pointer"
});

const FlashcardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3H8l-2 4h12l-2-4z" />
  </svg>
);
const QuizIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const SummaryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="15" y2="18" />
  </svg>
);
const MindMapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" /><circle cx="6" cy="14" r="2" /><circle cx="18" cy="14" r="2" /><circle cx="9" cy="20" r="2" /><circle cx="15" cy="20" r="2" />
    <path d="M12 7v3M10 11.5L7 13M14 11.5L17 13M7 16l1.5 2.5M17 16l-1.5 2.5" />
  </svg>
);
