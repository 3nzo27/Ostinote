import useTheme from "../../theme/useTheme.js";
import RatingButtons from "../RatingButtons/RatingButtons.jsx";

export default function AiChatResult({ guess, aiResult, aiLoading, guessSubmitted, onRate }) {
  const { T } = useTheme();

  const ratingColors = { 0: T.forgot, 2: T.hard, 3: T.good, 4: T.easy, 5: T.perfect };
  const ratingBgs = { 0: T.dueBg, 2: T.hardBg, 3: T.goodBg, 4: T.easyBg, 5: T.perfectBg };

  // Phase: AI loading
  if (guessSubmitted && aiLoading) {
    return (
      <div aria-live="polite" aria-busy="true" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
        {guess.trim() && (
          <div style={{ display: "flex", justifyContent: "flex-start", animation: "slideInLeft 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{
              padding: "12px 16px", borderRadius: "16px 16px 16px 4px", maxWidth: "80%",
              background: T.card, color: T.text,
              border: `1px solid ${T.border}`,
              fontSize: 14, lineHeight: 1.5, fontFamily: T.fontBody,
              boxShadow: T.shadow1
            }}>
              {guess}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", animation: "slideInRight 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both" }}>
          <div style={{
            padding: "12px 18px", borderRadius: "16px 16px 4px 16px", maxWidth: "75%",
            background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow1,
            fontSize: 13, color: T.textMid, fontFamily: T.fontBody
          }}>
            <span style={{ animation: "pulse 1s infinite" }}>Evaluating your answer...</span>
          </div>
        </div>
      </div>
    );
  }

  // Phase: AI result with rating buttons
  if (guessSubmitted && aiResult && !aiLoading) {
    const fg = T.ratingFg;
    return (
      <div aria-live="polite" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
        {guess.trim() && (
          <div style={{ display: "flex", justifyContent: "flex-start", animation: "slideInLeft 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{
              padding: "12px 16px", borderRadius: "16px 16px 16px 4px", maxWidth: "80%",
              background: ratingColors[aiResult.rating] || T.done, color: "#fff",
              fontSize: 14, lineHeight: 1.5, fontFamily: T.fontBody,
              boxShadow: `0 2px 8px ${ratingColors[aiResult.rating] || T.done}40`,
              transition: "background 0.4s ease, box-shadow 0.4s ease"
            }}>
              {guess}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", animation: "slideInRight 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.25s both" }}>
          <div style={{
            padding: "14px 18px", borderRadius: "16px 16px 4px 16px", maxWidth: "85%",
            background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow1
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                padding: "3px 10px", borderRadius: 6,
                background: ratingBgs[aiResult.rating] || T.bgSub,
                color: ratingColors[aiResult.rating] || T.text,
                fontSize: 12, fontWeight: 700, fontFamily: T.fontBody,
                animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.5s both"
              }}>
                {aiResult.label}
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: T.text, fontFamily: T.fontBody, margin: 0 }}>
              {aiResult.explanation}
            </p>
          </div>
        </div>

        <div style={{ animation: "ratingSlideUp 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.5s both" }}>
          <p style={{ textAlign: "center", fontSize: 12, color: T.textLight, marginTop: 6, marginBottom: 12, fontFamily: T.fontBody }}>
            Accept or adjust the rating
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
            {[
              { q: 0, label: "Forgot", color: T.forgot, bg: T.dueBg },
              { q: 2, label: "Hard", color: T.hard, bg: T.hardBg },
              { q: 3, label: "Good", color: T.good, bg: T.goodBg },
              { q: 4, label: "Easy", color: T.easy, bg: T.easyBg },
              { q: 5, label: "Perfect", color: T.perfect, bg: T.perfectBg },
            ].map((r, i) => {
              const isSuggested = r.q === aiResult.rating;
              const textColor = fg || r.color;
              const borderColor = fg ? `${fg}40` : `${r.color}30`;
              return (
                <button key={r.q} onClick={() => onRate(r.q)} style={{
                  padding: "10px 16px", borderRadius: T.radius,
                  border: isSuggested ? `2px solid ${r.color}` : `1.5px solid ${borderColor}`,
                  background: isSuggested ? r.color : r.bg,
                  color: isSuggested ? "#fff" : textColor,
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  transition: "all 0.15s", minWidth: 74, fontFamily: T.fontBody,
                  boxShadow: isSuggested ? T.shadow2 : T.shadow1,
                  transform: isSuggested ? "translateY(-2px)" : "none",
                  animation: `popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.55 + i * 0.07}s both`
                }}
                  onMouseEnter={e => { if (!isSuggested) { e.currentTarget.style.background = r.color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                  onMouseLeave={e => { if (!isSuggested) { e.currentTarget.style.background = r.bg; e.currentTarget.style.color = textColor; e.currentTarget.style.transform = "none"; } }}
                >{r.label}</button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Phase: Manual rating (skipped guess)
  if (guessSubmitted && !aiResult && !aiLoading) {
    return (
      <div style={{ animation: "fadeIn 0.3s ease", marginTop: 12 }}>
        <p style={{ textAlign: "center", fontSize: 12, color: T.textLight, marginBottom: 4, fontFamily: T.fontBody }}>How well did you know this?</p>
        <RatingButtons onRate={onRate} />
      </div>
    );
  }

  return null;
}
