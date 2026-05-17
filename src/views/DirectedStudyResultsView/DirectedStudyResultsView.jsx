import useTheme from "../../theme/useTheme.js";
import TopBar from "../../components/TopBar/TopBar.jsx";

export default function DirectedStudyResultsView({ dsResults, onNavigate, onHelpOpen }) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", fontFamily: T.fontBody, width: "100%", boxSizing: "border-box" };

  const totalTime = dsResults.reduce((s, r) => s + r.timeSpent, 0);
  const avgTime = dsResults.length > 0 ? Math.round(totalTime / dsResults.length) : 0;
  const ratingCounts = { 0: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dsResults.forEach(r => { ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1; });
  const maxScore = dsResults.length * 5;
  const actualScore = dsResults.reduce((s, r) => s + r.rating, 0);
  const pct = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;
  const timedOutCount = dsResults.filter(r => r.timedOut).length;

  const ratingLabels = { 0: "Forgot", 2: "Hard", 3: "Good", 4: "Easy", 5: "Perfect" };
  const ratingColorMap = { 0: T.forgot, 2: T.hard, 3: T.good, 4: T.easy, 5: T.perfect };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      <TopBar view="decks" onNavigate={onNavigate} />
      <div style={containerStyle}>

      <div style={{ textAlign: "center", marginBottom: 28, animation: "fadeIn 0.4s ease" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>
          {pct >= 80 ? "Great session" : pct >= 50 ? "Getting there" : "Keep practicing"}
        </h2>
        <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody }}>
          {dsResults.length} cards &middot; {Math.floor(totalTime / 60)}m {totalTime % 60}s total &middot; {avgTime}s avg per card
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.4s ease" }}>

        {/* Rating distribution */}
        <div style={{ padding: "18px 20px", borderRadius: T.radiusLg, background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 14 }}>Rating Distribution</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[5, 4, 3, 2, 0].map(q => {
              const count = ratingCounts[q] || 0;
              const barPct = dsResults.length > 0 ? (count / dsResults.length) * 100 : 0;
              return (
                <div key={q} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: ratingColorMap[q], width: 52, fontFamily: T.fontBody }}>{ratingLabels[q]}</span>
                  <div role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={dsResults.length} aria-label={`${ratingLabels[q]}: ${count} of ${dsResults.length} cards`} style={{ flex: 1, height: 8, borderRadius: 4, background: T.bgSub, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, background: ratingColorMap[q], width: `${barPct}%`, transition: "width 0.4s ease", minWidth: count > 0 ? 4 : 0 }} />
                  </div>
                  <span style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, width: 20, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>
          {timedOutCount > 0 && (
            <p style={{ fontSize: 11, color: T.due, fontFamily: T.fontBody, marginTop: 10 }}>
              {timedOutCount} card{timedOutCount !== 1 ? "s" : ""} timed out
            </p>
          )}
        </div>

        {/* Card-by-card breakdown */}
        <div style={{ padding: "18px 20px", borderRadius: T.radiusLg, background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 14 }}>Card Breakdown</div>
          {dsResults.map((r, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < dsResults.length - 1 ? `1px solid ${T.border}` : "none"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text, fontFamily: T.fontBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.cardFront}
                </div>
                <div style={{ fontSize: 11, color: T.textLight, fontFamily: T.fontBody, marginTop: 2 }}>
                  {r.timeSpent}s{r.timedOut ? " (timed out)" : ""}
                </div>
              </div>
              <span style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: ratingColorMap[r.rating] + "18", color: ratingColorMap[r.rating],
                fontFamily: T.fontBody, flexShrink: 0, marginLeft: 10
              }}>{r.label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", paddingBottom: 16 }}>
          <button onClick={() => onNavigate("directed")} style={{
            padding: "12px 24px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.white, color: T.textMid, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: T.fontBody
          }}>New Session</button>
          <button onClick={() => onNavigate("home")} style={{
            padding: "12px 24px", borderRadius: T.radius, border: "none",
            background: T.accent, color: T.white, fontWeight: 600, fontSize: 14, cursor: "pointer",
            fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(44,42,37,0.2)"
          }}>Done</button>
        </div>
      </div>
      </div>
    </div>
  );
}
