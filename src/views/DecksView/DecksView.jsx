import useTheme from "../../theme/useTheme.js";
import TopBar from "../../components/TopBar/TopBar.jsx";
import DeckItem from "../../components/DeckItem/DeckItem.jsx";
import DeleteConfirmModal from "../../components/DeleteConfirmModal/DeleteConfirmModal.jsx";

export default function DecksView({
  decks, newDeckName, setNewDeckName, showNewDeck, setShowNewDeck, addDeck,
  confirmDeleteId, setConfirmDeleteId, deleteDeck, onSelectDeck, onNavigate, onHelpOpen,
}) {
  const { T } = useTheme();
  // Wider page (1080px) so the deck list fills meaningful space rather
  // than living in a narrow column. Generous side padding so content
  // doesn't kiss the viewport edges on smaller screens.
  const containerStyle = { maxWidth: 1080, margin: "0 auto", padding: "calc(28px + var(--sat)) calc(32px + var(--sar)) calc(40px + var(--sab)) calc(32px + var(--sal))", fontFamily: T.fontBody, background: T.bg, width: "100%", boxSizing: "border-box" };

  const isEmpty = decks.length === 0 && !showNewDeck;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      <TopBar view="decks" onNavigate={onNavigate} />
      <div style={containerStyle}>

        {/* Page header — "All Decks" on the left, Focus Study CTA on
            the right. Focus Study moves out of the in-page tab and
            becomes a single header action that navigates to the
            dedicated config route. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 16, flexWrap: "wrap",
        }}>
          <h2 style={{
            flex: 1, fontSize: 22, fontWeight: 700,
            color: T.text, fontFamily: T.fontBody, margin: 0,
          }}>All Decks</h2>
          {decks.length > 0 && (
            <button
              onClick={() => onNavigate("directed")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: T.radius,
                border: `1.5px solid ${T.border}`, background: T.card,
                color: T.textMid, fontSize: 13, fontWeight: 600,
                fontFamily: T.fontBody, cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Focus Study
            </button>
          )}
        </div>

        {isEmpty ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "48px 24px", textAlign: "center", animation: "fadeIn 0.4s ease",
          }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 20, opacity: 0.65 }}>
              <rect x="10" y="14" width="34" height="40" rx="4" stroke={T.textLight} strokeWidth="1.5" fill="none" />
              <rect x="20" y="8" width="34" height="40" rx="4" stroke={T.textLight} strokeWidth="1.5" fill={T.card} />
              <line x1="28" y1="20" x2="46" y2="20" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="28" y1="28" x2="42" y2="28" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <line x1="28" y1="36" x2="44" y2="36" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <circle cx="47" cy="43" r="10" fill={T.accent} opacity="0.15" />
              <line x1="43" y1="43" x2="51" y2="43" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
              <line x1="47" y1="39" x2="47" y2="47" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 6 }}>No decks yet</p>
            <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody, marginBottom: 24, lineHeight: 1.5, maxWidth: 280 }}>
              Create your first deck to start learning with spaced repetition
            </p>
            <button onClick={() => setShowNewDeck(true)} style={{
              padding: "12px 28px", borderRadius: T.radius, border: "none",
              background: T.accent, color: T.white, fontWeight: 600, fontSize: 14,
              cursor: "pointer", fontFamily: T.fontBody,
              boxShadow: "0 2px 8px rgba(44,42,37,0.2)", transition: "all 0.15s",
            }}>Create Your First Deck</button>
          </div>
        ) : (
          <>
            {/* Responsive deck grid — 2–3 columns on wide screens, 1 column
                below ~620px. min 300px per card keeps deck names readable. */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 12,
              animation: "fadeIn 0.4s ease",
            }}>
              {[...decks].sort((a, b) => {
                const aDue = a.cards.filter(c => c.nextReview <= Date.now()).length;
                const bDue = b.cards.filter(c => c.nextReview <= Date.now()).length;
                return bDue - aDue;
              }).map(deck => (
                <DeckItem key={deck.id} deck={deck}
                  onSelect={() => onSelectDeck(deck.id)}
                  onDelete={() => setConfirmDeleteId(deck.id)} />
              ))}
            </div>
            {showNewDeck ? (
              <div style={{ marginTop: 16, padding: 20, background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2, animation: "fadeIn 0.3s ease" }}>
                <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)} onKeyDown={e => e.key === "Enter" && addDeck()}
                  placeholder="Deck name..." autoFocus
                  style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radius, fontSize: 15, outline: "none", marginBottom: 12, fontFamily: T.fontBody, color: T.text, background: T.inputBg }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowNewDeck(false)} style={{ padding: "8px 18px", borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.white, cursor: "pointer", fontSize: 13, color: T.textMid, fontFamily: T.fontBody }}>Cancel</button>
                  <button onClick={addDeck} style={{ padding: "8px 18px", borderRadius: T.radius, border: "none", background: T.accent, color: T.white, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(44,42,37,0.2)" }}>Create</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNewDeck(true)} style={{
                marginTop: 16, width: "100%", padding: "16px", borderRadius: T.radiusLg,
                border: `2px dashed ${T.borderStrong}`, background: "transparent",
                color: T.textMid, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", fontFamily: T.fontBody,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.textMid; }}
              >+ New Deck</button>
            )}
          </>
        )}

        {confirmDeleteId && (
          <DeleteConfirmModal
            deckName={decks.find(d => d.id === confirmDeleteId)?.name}
            onCancel={() => setConfirmDeleteId(null)}
            onConfirm={() => { deleteDeck(confirmDeleteId); setConfirmDeleteId(null); }}
          />
        )}
      </div>{/* /containerStyle */}
    </div>
  );
}
