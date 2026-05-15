import useTheme from "../../theme/useTheme.js";
import OnboardingTooltip from "../../components/Onboarding/OnboardingTooltip.jsx";

export default function DeckView({ activeDeck, dueCards, renamingDeck, setRenamingDeck, renameValue, setRenameValue, renameDeck, startStudy, deleteCard, setEditCardId, onNavigate, inWindow = false }) {
  const { T } = useTheme();
  // Per-window compact scale: smaller typography + tighter padding so the
  // whole deck overview fits at MIN_W/MIN_H without losing readability.
  // In inWindow mode we use a transparent background so the deck blends
  // into whatever surface hosts it (e.g. the Tool Bar's T.card). The
  // fullscreen page keeps its own T.bg surface.
  const containerStyle = inWindow
    // Generous bottom padding so the last card's shadow has room to
    // render without getting clipped by the surrounding scroll viewport.
    ? { padding: "12px 14px 24px", minHeight: 0, fontFamily: T.fontBody, background: "transparent" }
    : { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  const sz = inWindow
    ? { h1: 16, body: 12, btn: 12, btnPad: "9px 12px", listGap: 6, listPad: "9px 11px", cardFront: 12.5, cardMeta: 10.5, headerMargin: 4, descMargin: 12, actionMargin: 14 }
    : { h1: 26, body: 13, btn: 14, btnPad: "14px",     listGap: 8, listPad: "14px 18px", cardFront: 14,   cardMeta: 11,   headerMargin: 6, descMargin: 24, actionMargin: 28 };

  return (
    <div style={containerStyle}>
      {/* The "All Decks" back link only makes sense in the fullscreen page —
          inside a window, you close via the title bar's × button. */}
      {!inWindow && (
        <button onClick={() => onNavigate("decks")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: T.textMid, fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 24, padding: 0, fontFamily: T.fontBody }}>&larr; All Decks</button>
      )}


      {renamingDeck ? (
        <div style={{ marginBottom: inWindow ? 10 : 20, animation: "fadeIn 0.2s ease" }}>
          <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") renameDeck(); if (e.key === "Escape") setRenamingDeck(false); }}
            autoFocus
            style={{
              width: "100%", padding: inWindow ? "6px 10px" : "10px 14px", border: `1.5px solid ${T.borderStrong}`, borderRadius: T.radius,
              fontSize: inWindow ? 14 : 20, fontWeight: 700, outline: "none", fontFamily: T.font, color: T.text, background: T.inputBg,
              marginBottom: 8, boxSizing: "border-box"
            }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setRenamingDeck(false)} style={{
              padding: inWindow ? "5px 12px" : "7px 16px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
              background: T.white, cursor: "pointer", fontSize: 11, color: T.textMid, fontFamily: T.fontBody
            }}>Cancel</button>
            <button onClick={renameDeck} style={{
              padding: inWindow ? "5px 12px" : "7px 16px", borderRadius: T.radius, border: "none",
              background: T.done, color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer",
              fontFamily: T.fontBody
            }}>Save</button>
          </div>
        </div>
      ) : (
        // Deck name heading. Visible in BOTH fullscreen and window modes —
        // in the workspace deck tab the tab label shows the title too, but
        // we keep the in-pane heading so the rename trigger has a home.
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: sz.headerMargin, cursor: "default" }}
          onMouseEnter={e => { const btn = e.currentTarget.querySelector('[data-rename]'); if (btn) btn.style.opacity = "1"; }}
          onMouseLeave={e => { const btn = e.currentTarget.querySelector('[data-rename]'); if (btn) btn.style.opacity = "0"; }}
        >
          <h2 style={{ fontSize: sz.h1, fontWeight: 700, color: T.text, fontFamily: T.font }}>{activeDeck.name}</h2>
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
      <p style={{ color: T.textMid, fontSize: sz.body, marginBottom: sz.descMargin, fontFamily: T.fontBody }}>
        {activeDeck.cards.length} cards &middot; <span style={{ color: dueCards.length > 0 ? T.due : T.done, fontWeight: 600 }}>{dueCards.length} due</span>
      </p>
      {!inWindow && dueCards.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <OnboardingTooltip hintKey="deckStudyNow">
            Cards are due! Tap <strong>Study Now</strong> to review them with spaced repetition.
          </OnboardingTooltip>
        </div>
      )}

      <div style={{ display: "flex", gap: inWindow ? 6 : 10, marginBottom: sz.actionMargin }}>
        <button onClick={startStudy} disabled={dueCards.length === 0} style={{
          flex: 1, padding: sz.btnPad, borderRadius: T.radius, border: "none",
          background: dueCards.length > 0 ? T.due : T.bgSub, color: dueCards.length > 0 ? "#fff" : T.textLight,
          fontWeight: 600, fontSize: sz.btn, cursor: dueCards.length > 0 ? "pointer" : "default",
          transition: "all 0.15s", fontFamily: T.fontBody
        }}>Study{dueCards.length > 0 ? ` (${dueCards.length})` : ""}</button>
        <button onClick={() => onNavigate("addCard")} style={{
          padding: inWindow ? "9px 14px" : "14px 22px", borderRadius: T.radius, border: `1.5px solid ${T.borderStrong}`,
          background: T.card, color: T.text, fontWeight: 600, fontSize: sz.btn, cursor: "pointer",
          fontFamily: T.fontBody
        }}>+ Add</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: sz.listGap, animation: "fadeIn 0.4s ease" }}>
        {activeDeck.cards.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: inWindow ? "22px 18px" : "44px 24px", textAlign: "center"
          }}>
            <svg width={inWindow ? 40 : 56} height={inWindow ? 40 : 56} viewBox="0 0 56 56" fill="none" style={{ marginBottom: inWindow ? 12 : 18, opacity: 0.6 }}>
              <rect x="8" y="16" width="32" height="24" rx="3" stroke={T.textLight} strokeWidth="1.5" fill="none" transform="rotate(-4 24 28)" />
              <rect x="14" y="12" width="32" height="24" rx="3" stroke={T.textLight} strokeWidth="1.5" fill={T.card} />
              <line x1="20" y1="20" x2="40" y2="20" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="26" x2="34" y2="26" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
              <line x1="20" y1="32" x2="28" y2="32" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            </svg>
            <p style={{ fontSize: inWindow ? 13 : 15, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 6 }}>This deck is empty</p>
            <p style={{ fontSize: inWindow ? 11.5 : 13, color: T.textMid, fontFamily: T.fontBody, marginBottom: inWindow ? 14 : 20, lineHeight: 1.5, maxWidth: 260 }}>
              Add your first card to start building this deck
            </p>
            <button onClick={() => onNavigate("addCard")} style={{
              padding: inWindow ? "8px 18px" : "11px 26px", borderRadius: T.radius, border: "none",
              background: T.accent, color: T.white, fontWeight: 600, fontSize: inWindow ? 12 : 13,
              cursor: "pointer", fontFamily: T.fontBody,
              transition: "all 0.15s"
            }}>Add Your First Card</button>
          </div>
        ) : activeDeck.cards.map((card, i) => {
          const isDue = card.nextReview <= Date.now();
          return (
            <div key={card.id} style={{
              padding: sz.listPad, borderRadius: T.radius,
              // Cards keep their "lifted" treatment in BOTH modes — the
              // same T.card bg as the page/sidebar with a soft shadow
              // for separation. Previously the in-window variant used a
              // T.bgSub bg-swap, but that created an abrupt color seam
              // at the bottom of the list where the cards ended and the
              // surrounding T.card resumed. Shadow is a cleaner cue.
              background: T.card,
              border: `1px solid ${T.border}`,
              boxShadow: T.shadow1,
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: sz.cardFront, color: T.text, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: T.fontBody }}>
                  {card.front.text || (card.front.drawing ? "Drawing card" : card.front.audio ? "Audio card" : "Card " + (i + 1))}
                </div>
                <div style={{ fontSize: sz.cardMeta, color: isDue ? T.due : T.done, fontWeight: 600, marginTop: 2, fontFamily: T.fontBody }}>
                  {isDue ? "Due now" : `Next: ${new Date(card.nextReview).toLocaleDateString()}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: inWindow ? 4 : 6, flexShrink: 0 }}>
                <button onClick={() => { setEditCardId(card.id); onNavigate("editCard"); }} style={{ padding: inWindow ? "4px 9px" : "6px 12px", borderRadius: 6, border: `1.5px solid ${T.border}`, background: T.white, fontSize: 11, cursor: "pointer", color: T.textMid, fontFamily: T.fontBody, fontWeight: 500 }}>Edit</button>
                <button onClick={() => deleteCard(card.id)} style={{ padding: inWindow ? "4px 8px" : "6px 10px", borderRadius: 6, border: `1.5px solid ${T.border}`, background: T.white, fontSize: 11, cursor: "pointer", color: T.textLight }}>&times;</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
