import useTheme from "../../theme/useTheme.js";
import TopBar from "../../components/TopBar/TopBar.jsx";
import DeckItem from "../../components/DeckItem/DeckItem.jsx";
import DeleteConfirmModal from "../../components/DeleteConfirmModal/DeleteConfirmModal.jsx";

export default function DecksView({
  decks, newDeckName, setNewDeckName, showNewDeck, setShowNewDeck, addDeck,
  confirmDeleteId, setConfirmDeleteId, deleteDeck, onSelectDeck, onNavigate, onHelpOpen,
  startShuffleStudy,
}) {
  const { T } = useTheme();
  // Wider page (1080px) so the deck list fills meaningful space rather
  // than living in a narrow column. Generous side padding so content
  // doesn't kiss the viewport edges on smaller screens.
  const containerStyle = { maxWidth: 1080, margin: "0 auto", padding: "calc(28px + var(--sat)) calc(32px + var(--sar)) calc(40px + var(--sab)) calc(32px + var(--sal))", fontFamily: T.fontBody, background: T.bg, width: "100%", boxSizing: "border-box" };

  const isEmpty = decks.length === 0 && !showNewDeck;

  // Cross-deck due totals drive the "Today" hero.
  const now = Date.now();
  const totalDue = decks.reduce((s, d) => s + d.cards.filter(c => c.nextReview <= now).length, 0);
  const decksWithDue = decks.filter(d => d.cards.some(c => c.nextReview <= now)).length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      <TopBar view="decks" onNavigate={onNavigate} />
      <div style={containerStyle}>

        {/* "Today" hero — leads with what to study right now across all
            decks. Primary action runs a shuffled all-due session; Focus
            Study sits beside it as the secondary path. Hidden until the
            user has at least one deck. */}
        {decks.length > 0 && (
          <TodayHero
            T={T}
            totalDue={totalDue}
            decksWithDue={decksWithDue}
            onStudyAll={() => startShuffleStudy?.()}
            onFocusStudy={() => onNavigate("directed")}
          />
        )}

        <h2 style={{
          fontSize: 22, fontWeight: 700,
          color: T.text, fontFamily: T.fontBody, margin: "0 0 16px",
        }}>All Decks</h2>

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

// "Today" hero — the daily-driver focal point of the Flashcards page.
// When cards are due it leads with the count + a one-tap shuffled
// all-due session; when caught up it switches to a calm done state.
// Focus Study is the secondary action in both states.
function TodayHero({ T, totalDue, decksWithDue, onStudyAll, onFocusStudy }) {
  const caughtUp = totalDue === 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
      padding: "22px 24px", marginBottom: 24,
      borderRadius: T.radiusLg,
      background: caughtUp ? T.card : T.cardAlt,
      border: `1px solid ${caughtUp ? T.border : T.borderStrong}`,
      boxShadow: T.shadow1,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: caughtUp ? T.doneBg : T.dueBg,
        color: caughtUp ? T.done : T.due,
      }}>
        {caughtUp ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.font, lineHeight: 1.2 }}>
          {caughtUp
            ? "You're all caught up"
            : `${totalDue} card${totalDue === 1 ? "" : "s"} due`}
        </div>
        <div style={{ fontSize: 13.5, color: T.textMid, marginTop: 4 }}>
          {caughtUp
            ? "Nothing due right now — come back later, or run a focused session."
            : `across ${decksWithDue} deck${decksWithDue === 1 ? "" : "s"}`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        {!caughtUp && (
          <button
            onClick={onStudyAll}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 20px", borderRadius: T.radius, border: "none",
              background: T.accent, color: T.white,
              fontSize: 14, fontWeight: 600, fontFamily: T.fontBody, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(44,42,37,0.2)", transition: "transform 0.12s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = ""}
          >
            Study all due
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
        <button
          onClick={onFocusStudy}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 18px", borderRadius: T.radius,
            border: `1.5px solid ${T.border}`, background: T.card,
            color: T.textMid, fontSize: 14, fontWeight: 600,
            fontFamily: T.fontBody, cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Focus Study
        </button>
      </div>
    </div>
  );
}
