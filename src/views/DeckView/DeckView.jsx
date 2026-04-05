import useTheme from "../../theme/useTheme.js";
import OnboardingTooltip from "../../components/Onboarding/OnboardingTooltip.jsx";

export default function DeckView({ activeDeck, dueCards, renamingDeck, setRenamingDeck, renameValue, setRenameValue, renameDeck, startStudy, deleteCard, setEditCardId, onNavigate }) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  return (
    <div style={containerStyle}>
      <button onClick={() => onNavigate("decks")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: T.textMid, fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 24, padding: 0, fontFamily: T.fontBody }}>&larr; All Decks</button>

      {renamingDeck ? (
        <div style={{ marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
          <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") renameDeck(); if (e.key === "Escape") setRenamingDeck(false); }}
            autoFocus
            style={{
              width: "100%", padding: "10px 14px", border: `1.5px solid ${T.borderStrong}`, borderRadius: T.radius,
              fontSize: 20, fontWeight: 700, outline: "none", fontFamily: T.font, color: T.text, background: T.inputBg,
              marginBottom: 10, boxSizing: "border-box"
            }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setRenamingDeck(false)} style={{
              padding: "7px 16px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
              background: T.white, cursor: "pointer", fontSize: 12, color: T.textMid, fontFamily: T.fontBody
            }}>Cancel</button>
            <button onClick={renameDeck} style={{
              padding: "7px 16px", borderRadius: T.radius, border: "none",
              background: T.done, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer",
              fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(58,125,92,0.25)"
            }}>Save</button>
          </div>
        </div>
      ) : (
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, cursor: "default" }}
          onMouseEnter={e => { const btn = e.currentTarget.querySelector('[data-rename]'); if (btn) btn.style.opacity = "1"; }}
          onMouseLeave={e => { const btn = e.currentTarget.querySelector('[data-rename]'); if (btn) btn.style.opacity = "0"; }}
        >
          <h2 style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: T.font }}>{activeDeck.name}</h2>
          <button data-rename onClick={() => { setRenameValue(activeDeck.name); setRenamingDeck(true); }} style={{
            padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${T.border}`,
            background: T.white, fontSize: 11, cursor: "pointer", color: T.textLight,
            fontFamily: T.fontBody, fontWeight: 500, transition: "all 0.15s",
            opacity: 0
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.textMid; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textLight; }}
          >Rename</button>
        </div>
      )}
      <p style={{ color: T.textMid, fontSize: 13, marginBottom: 24, fontFamily: T.fontBody }}>
        {activeDeck.cards.length} cards &middot; <span style={{ color: dueCards.length > 0 ? T.due : T.done, fontWeight: 600 }}>{dueCards.length} due for review</span>
      </p>
      {dueCards.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <OnboardingTooltip hintKey="deckStudyNow">
            Cards are due! Tap <strong>Study Now</strong> to review them with spaced repetition.
          </OnboardingTooltip>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <button onClick={startStudy} disabled={dueCards.length === 0} style={{
          flex: 1, padding: "14px", borderRadius: T.radius, border: "none",
          background: dueCards.length > 0 ? T.due : T.bgSub, color: dueCards.length > 0 ? "#fff" : T.textLight,
          fontWeight: 600, fontSize: 14, cursor: dueCards.length > 0 ? "pointer" : "default",
          boxShadow: dueCards.length > 0 ? "0 3px 12px rgba(196,67,42,0.3)" : "none",
          transition: "all 0.15s", fontFamily: T.fontBody
        }}>Study Now ({dueCards.length})</button>
        <button onClick={() => onNavigate("addCard")} style={{
          padding: "14px 22px", borderRadius: T.radius, border: `1.5px solid ${T.borderStrong}`,
          background: T.card, color: T.text, fontWeight: 600, fontSize: 14, cursor: "pointer",
          fontFamily: T.fontBody, boxShadow: T.shadow1
        }}>+ Add</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeIn 0.4s ease" }}>
        {activeDeck.cards.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "44px 24px", textAlign: "center"
          }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ marginBottom: 18, opacity: 0.6 }}>
              <rect x="8" y="16" width="32" height="24" rx="3" stroke={T.textLight} strokeWidth="1.5" fill="none" transform="rotate(-4 24 28)" />
              <rect x="14" y="12" width="32" height="24" rx="3" stroke={T.textLight} strokeWidth="1.5" fill={T.card} />
              <line x1="20" y1="20" x2="40" y2="20" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="26" x2="34" y2="26" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
              <line x1="20" y1="32" x2="28" y2="32" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 6 }}>This deck is empty</p>
            <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, marginBottom: 20, lineHeight: 1.5, maxWidth: 260 }}>
              Add your first card to start building this deck
            </p>
            <button onClick={() => onNavigate("addCard")} style={{
              padding: "11px 26px", borderRadius: T.radius, border: "none",
              background: T.accent, color: T.white, fontWeight: 600, fontSize: 13,
              cursor: "pointer", fontFamily: T.fontBody,
              boxShadow: "0 2px 8px rgba(44,42,37,0.2)", transition: "all 0.15s"
            }}>Add Your First Card</button>
          </div>
        ) : activeDeck.cards.map((card, i) => {
          const isDue = card.nextReview <= Date.now();
          return (
            <div key={card.id} style={{
              padding: "14px 18px", borderRadius: T.radius, background: T.card,
              border: `1px solid ${T.border}`, boxShadow: T.shadow1,
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: T.fontBody }}>
                  {card.front.text || (card.front.drawing ? "Drawing card" : card.front.audio ? "Audio card" : "Card " + (i + 1))}
                </div>
                <div style={{ fontSize: 11, color: isDue ? T.due : T.done, fontWeight: 600, marginTop: 3, fontFamily: T.fontBody }}>
                  {isDue ? "Due now" : `Next: ${new Date(card.nextReview).toLocaleDateString()}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setEditCardId(card.id); onNavigate("editCard"); }} style={{ padding: "6px 12px", borderRadius: 6, border: `1.5px solid ${T.border}`, background: T.white, fontSize: 12, cursor: "pointer", color: T.textMid, fontFamily: T.fontBody, fontWeight: 500 }}>Edit</button>
                <button onClick={() => deleteCard(card.id)} style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${T.border}`, background: T.white, fontSize: 12, cursor: "pointer", color: T.textLight }}>&times;</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
