import { useState } from "react";
import useTheme from "../../theme/useTheme.js";
import { deleteHighlight } from "../../utils/documentStore.js";
import { formatTimestamp } from "../../utils/youtubeTranscript.js";
import DeckPickerModal from "./DeckPickerModal.jsx";

export default function HighlightsTab({ doc, highlights, setHighlights, decks, onAddCardToDeck, onScrollToPage }) {
  const { T } = useTheme();
  const [pendingCard, setPendingCard] = useState(null);

  const handleDelete = async (id) => {
    await deleteHighlight(id);
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  const handleMakeFlashcard = (h) => {
    setPendingCard({
      front: `What's the significance of this? "${h.text.slice(0, 100)}${h.text.length > 100 ? "…" : ""}"`,
      back: h.text,
      tags: ["highlight"],
    });
  };

  if (highlights.length === 0) {
    return (
      <div style={{ padding: 22, color: T.textMid, fontSize: 12, fontFamily: T.fontBody, lineHeight: 1.6 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: T.bgSub, color: T.textMid,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
          No highlights yet
        </div>
        Select any text in the document on the left to save a highlight. Highlights show up here and can be turned into flashcards.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: T.textMid,
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10
      }}>
        {highlights.length} highlight{highlights.length === 1 ? "" : "s"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {highlights.map(h => (
          <div key={h.id} style={{
            padding: "10px 12px", borderRadius: 10,
            background: T.cardAlt, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${h.color || T.hard || "#c47f2a"}`,
            fontFamily: T.fontBody, transition: "all 0.15s"
          }}>
            <div style={{
              fontSize: 12, color: T.text, lineHeight: 1.5,
              marginBottom: 8, whiteSpace: "pre-wrap", wordBreak: "break-word"
            }}>
              {h.text.length > 220 ? h.text.slice(0, 220) + "…" : h.text}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 10, color: T.textLight
            }}>
              {h.page != null && (
                <button onClick={() => onScrollToPage(h.page)} style={chipBtn(T)}>
                  {doc?.type === "youtube" ? formatTimestamp(h.page) : `Page ${h.page}`}
                </button>
              )}
              <button onClick={() => handleMakeFlashcard(h)} style={chipBtn(T)}>
                + Flashcard
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={() => handleDelete(h.id)} aria-label="Delete highlight" style={{
                background: "none", border: "none", padding: 2,
                cursor: "pointer", color: T.textLight,
                display: "flex"
              }}
                onMouseEnter={e => e.currentTarget.style.color = T.due}
                onMouseLeave={e => e.currentTarget.style.color = T.textLight}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingCard && (
        <DeckPickerModal
          card={pendingCard} decks={decks}
          onCancel={() => setPendingCard(null)}
          onSave={(deckId, finalCard) => {
            onAddCardToDeck(deckId, finalCard);
            setPendingCard(null);
          }}
        />
      )}
    </div>
  );
}

const chipBtn = (T) => ({
  padding: "3px 8px", borderRadius: 999,
  border: `1px solid ${T.border}`, background: T.card,
  color: T.textMid, fontSize: 10, fontWeight: 600,
  fontFamily: T.fontBody, cursor: "pointer"
});
