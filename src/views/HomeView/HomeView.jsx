import useTheme from "../../theme/useTheme.js";
import NavBar from "../../components/NavBar/NavBar.jsx";
import DeleteConfirmModal from "../../components/DeleteConfirmModal/DeleteConfirmModal.jsx";
import OnboardingTooltip from "../../components/Onboarding/OnboardingTooltip.jsx";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function HomeView({ decks, calOffset, setCalOffset, confirmDeleteId, setConfirmDeleteId, deleteDeck, onNavigate, onSelectDeck, exportData, importData, onHelpOpen }) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  const totalDue = decks.reduce((sum, d) => sum + d.cards.filter(c => c.nextReview <= Date.now()).length, 0);

  const buildCalendar = (offset = 0) => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = target.getFullYear();
    const month = target.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = (offset === 0) ? now.getDate() : -1;
    const allCards = decks.flatMap(d => d.cards);
    const dueCounts = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = new Date(year, month, day).getTime();
      const dayEnd = new Date(year, month, day + 1).getTime();
      const dueCount = allCards.filter(c => c.nextReview >= dayStart && c.nextReview < dayEnd).length;
      if (dueCount > 0) dueCounts[day] = dueCount;
    }
    return { year, month, firstDay, daysInMonth, today, dueCounts };
  };

  const cal = buildCalendar(calOffset);

  const widgetBox = (children) => (
    <div style={{
      padding: "18px 20px", borderRadius: T.radiusLg,
      background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2
    }}>
      {children}
    </div>
  );

  return (
    <div style={containerStyle}>
      <NavBar view="home" onNavigate={onNavigate} onHelpOpen={onHelpOpen} />

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}
        </h1>
        {totalDue > 0 ? (
          <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody }}>
            You have {totalDue} card{totalDue !== 1 ? "s" : ""} due for review
          </p>
        ) : decks.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.doneBg, border: `1px solid ${T.done}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.done} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p style={{ fontSize: 14, color: T.done, fontFamily: T.fontBody, fontWeight: 500 }}>
              You're all caught up — nice work!
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody }}>
            Welcome to Ostinote
          </p>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <OnboardingTooltip hintKey="homeStudyTab">
          Ready to study? Tap <strong>Study</strong> in the navigation to begin a session across all your decks.
        </OnboardingTooltip>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.4s ease" }}>

        {/* Calendar */}
        {widgetBox(<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>
              {monthNames[cal.month]} {cal.year}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button aria-label="Previous month" onClick={() => setCalOffset(calOffset - 1)} style={{
                width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`,
                background: T.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: T.textMid, transition: "all 0.15s"
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button aria-label="Next month" onClick={() => setCalOffset(calOffset + 1)} style={{
                width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`,
                background: T.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: T.textMid, transition: "all 0.15s"
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
          <div role="grid" aria-label={`Review calendar for ${monthNames[cal.month]} ${cal.year}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 600, color: T.textLight, fontFamily: T.fontBody, padding: "4px 0" }}>{d}</div>
            ))}
            {Array.from({ length: cal.firstDay }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: cal.daysInMonth }, (_, i) => {
              const day = i + 1;
              const isToday = day === cal.today;
              const dueCount = cal.dueCounts[day] || 0;
              return (
                <div key={day} style={{
                  position: "relative", padding: "6px 0", borderRadius: 8,
                  background: isToday ? T.text : "transparent",
                  color: isToday ? T.card : T.text,
                  fontSize: 12, fontWeight: isToday ? 700 : 400,
                  fontFamily: T.fontBody, cursor: "default"
                }}>
                  {day}
                  {dueCount > 0 && (
                    <div style={{
                      position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)",
                      width: 4, height: 4, borderRadius: "50%",
                      background: isToday ? T.card : T.due
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </>)}

        {/* Recent Decks */}
        {widgetBox(<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>Recent Decks</span>
            <button onClick={() => onNavigate("decks")} style={{
              fontSize: 11, color: T.textLight, background: "none", border: "none", cursor: "pointer",
              fontFamily: T.fontBody, fontWeight: 500, transition: "color 0.15s"
            }}
              onMouseEnter={e => e.currentTarget.style.color = T.text}
              onMouseLeave={e => e.currentTarget.style.color = T.textLight}
            >View all &rarr;</button>
          </div>
          {[...decks].sort((a, b) => {
            const aDue = a.cards.filter(c => c.nextReview <= Date.now()).length;
            const bDue = b.cards.filter(c => c.nextReview <= Date.now()).length;
            return bDue - aDue;
          }).slice(0, 3).map(deck => {
            const deckDue = deck.cards.filter(c => c.nextReview <= Date.now()).length;
            return (
              <div key={deck.id} onClick={() => onSelectDeck(deck.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.paddingLeft = "4px"}
                onMouseLeave={e => e.currentTarget.style.paddingLeft = "0px"}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: T.fontBody }}>{deck.name}</div>
                  <div style={{ fontSize: 11, color: T.textLight, fontFamily: T.fontBody, marginTop: 2 }}>{deck.cards.length} cards</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: deckDue > 0 ? T.due : T.done, fontFamily: T.fontBody }}>
                  {deckDue > 0 ? `${deckDue} due` : "Clear"}
                </span>
              </div>
            );
          })}
          {decks.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 16px", textAlign: "center" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16, opacity: 0.7 }}>
                <rect x="8" y="10" width="26" height="32" rx="3" stroke={T.textLight} strokeWidth="1.5" fill="none" />
                <rect x="14" y="6" width="26" height="32" rx="3" stroke={T.textLight} strokeWidth="1.5" fill={T.card} />
                <line x1="20" y1="16" x2="34" y2="16" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20" y1="22" x2="30" y2="22" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                <line x1="20" y1="28" x2="32" y2="28" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: T.fontBody, marginBottom: 6 }}>No decks yet</p>
              <p style={{ fontSize: 13, color: T.textLight, fontFamily: T.fontBody, marginBottom: 16, lineHeight: 1.5 }}>Create your first deck to start learning</p>
              <button onClick={() => onNavigate("decks")} style={{
                padding: "10px 24px", borderRadius: T.radius, border: "none",
                background: T.accent, color: T.white, fontWeight: 600, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody,
                boxShadow: "0 2px 8px rgba(44,42,37,0.2)", transition: "all 0.15s"
              }}>Create Deck</button>
            </div>
          )}
        </>)}

        {/* Export / Import */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 4 }}>
          <button onClick={exportData} style={{
            padding: "8px 16px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.card, color: T.textMid, fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s"
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
          >Export Backup</button>
          <label style={{
            padding: "8px 16px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.card, color: T.textMid, fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s"
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
          >
            Import Backup
            <input type="file" accept=".json" style={{ display: "none" }}
              onChange={e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {confirmDeleteId && (
        <DeleteConfirmModal
          deckName={decks.find(d => d.id === confirmDeleteId)?.name}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => { deleteDeck(confirmDeleteId); setConfirmDeleteId(null); }}
        />
      )}
    </div>
  );
}
