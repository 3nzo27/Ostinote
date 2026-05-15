import { useState } from "react";
import useTheme from "../../theme/useTheme.js";

// Modal for picking a deck (or creating a new one) when saving generated
// flashcards. Handles single-card (with edit fields) and batch-save flows.

export default function DeckPickerModal({ card, cards, decks, onCancel, onSave }) {
  const { T } = useTheme();
  const isBatch = !!cards;
  const [selectedDeckId, setSelectedDeckId] = useState(decks?.[0]?.id || "");
  const [newDeckName, setNewDeckName] = useState("");
  const [creatingNew, setCreatingNew] = useState(decks?.length === 0);
  const [front, setFront] = useState(card?.front || "");
  const [back, setBack] = useState(card?.back || "");

  const canSave = isBatch
    ? (creatingNew ? !!newDeckName.trim() : !!selectedDeckId)
    : !!front.trim() && !!back.trim() && (creatingNew ? !!newDeckName.trim() : !!selectedDeckId);

  const handleSave = () => {
    const targetDeckId = creatingNew ? `new:${newDeckName.trim()}` : selectedDeckId;
    if (isBatch) {
      onSave(targetDeckId);
    } else {
      onSave(targetDeckId, { ...card, front: front.trim(), back: back.trim() });
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: T.modalOverlay, backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, animation: "fadeIn 0.15s ease",
      fontFamily: T.fontBody
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: T.radiusLg,
        border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow3,
        padding: "22px 22px", maxWidth: 420, width: "100%"
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
          {isBatch ? `Add ${cards.length} flashcards` : "Save flashcard"}
        </div>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 16 }}>
          {isBatch ? "Pick which deck to add these to." : "Edit the card if you want, then pick a deck."}
        </div>

        {!isBatch && (
          <>
            <label style={labelStyle(T)}>Front</label>
            <textarea
              value={front} onChange={e => setFront(e.target.value)}
              rows={2} style={textareaStyle(T)}
            />
            <label style={labelStyle(T)}>Back</label>
            <textarea
              value={back} onChange={e => setBack(e.target.value)}
              rows={3} style={textareaStyle(T)}
            />
          </>
        )}

        <label style={labelStyle(T)}>Deck</label>
        {!creatingNew && decks.length > 0 ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8, maxHeight: 180, overflowY: "auto" }}>
              {decks.map(d => (
                <button key={d.id} onClick={() => setSelectedDeckId(d.id)} style={{
                  textAlign: "left", padding: "9px 12px", borderRadius: 8,
                  border: `1.5px solid ${selectedDeckId === d.id ? T.good : T.border}`,
                  background: selectedDeckId === d.id ? T.goodBg : T.card,
                  color: selectedDeckId === d.id ? T.good : T.text,
                  fontSize: 13, fontWeight: 600, fontFamily: T.fontBody, cursor: "pointer"
                }}>{d.name} · {d.cards.length} cards</button>
              ))}
            </div>
            <button onClick={() => setCreatingNew(true)} style={{
              background: "none", border: "none", padding: "6px 0",
              fontSize: 12, color: T.easy, cursor: "pointer", fontFamily: T.fontBody,
              textDecoration: "underline"
            }}>+ Create new deck instead</button>
          </>
        ) : (
          <>
            <input
              value={newDeckName} onChange={e => setNewDeckName(e.target.value)}
              placeholder="New deck name…" autoFocus
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: `1.5px solid ${T.border}`, fontSize: 13,
                fontFamily: T.fontBody, color: T.text, background: T.inputBg,
                outline: "none", boxSizing: "border-box", marginBottom: 6
              }}
            />
            {decks.length > 0 && (
              <button onClick={() => setCreatingNew(false)} style={{
                background: "none", border: "none", padding: "6px 0",
                fontSize: 12, color: T.easy, cursor: "pointer", fontFamily: T.fontBody,
                textDecoration: "underline"
              }}>← Use existing deck</button>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onCancel} style={{
            padding: "9px 18px", borderRadius: 8,
            border: `1.5px solid ${T.border}`, background: T.card,
            color: T.textMid, fontSize: 13, fontWeight: 500, cursor: "pointer",
            fontFamily: T.fontBody
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave} style={{
            padding: "9px 20px", borderRadius: 8, border: "none",
            background: canSave ? T.good : T.bgSub,
            color: canSave ? "#fff" : T.textLight,
            fontSize: 13, fontWeight: 600, fontFamily: T.fontBody,
            cursor: canSave ? "pointer" : "default",
            boxShadow: canSave ? "0 2px 8px rgba(58,125,92,0.3)" : "none"
          }}>{isBatch ? "Add to deck" : "Save card"}</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = (T) => ({
  display: "block", fontSize: 11, fontWeight: 600, color: T.textMid,
  fontFamily: T.fontBody, marginBottom: 6, marginTop: 10,
  textTransform: "uppercase", letterSpacing: 0.5
});

const textareaStyle = (T) => ({
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${T.border}`, fontSize: 13, lineHeight: 1.5,
  fontFamily: T.fontBody, color: T.text, background: T.inputBg,
  outline: "none", boxSizing: "border-box", resize: "vertical"
});
