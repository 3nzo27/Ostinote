import useTheme from "../../theme/useTheme.js";
import FlipCard from "../../components/FlipCard/FlipCard.jsx";
import RatingButtons from "../../components/RatingButtons/RatingButtons.jsx";
import AiChatResult from "../../components/AiChatResult/AiChatResult.jsx";

export default function DirectedStudySessionView({
  dsCards, dsIndex, dsConfig, dsTimer, flipped, guess, guessSubmitted,
  aiResult, aiLoading,
  setGuess, submitGuess, setFlipped, setGuessSubmitted, setShowRating, setAiResult,
  dsHandleRate, onExit, onSkip
}) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  const currentDsCard = dsCards[dsIndex];
  if (!currentDsCard) return null;

  const ratingColors = { 0: T.forgot, 2: T.hard, 3: T.good, 4: T.easy, 5: T.perfect };
  const ratingBgs = { 0: T.dueBg, 2: T.hardBg, 3: T.bgSub, 4: T.doneBg, 5: T.perfectBg };
  const timerPct = dsConfig.timeLimit > 0 ? (dsTimer / dsConfig.timeLimit) * 100 : 100;
  const timerUrgent = dsConfig.timeLimit > 0 && dsTimer <= 5 && dsTimer > 0;

  return (
    <div style={{ ...containerStyle, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={onExit} style={{
          background: "none", border: "none", color: T.textMid, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, fontFamily: T.fontBody
        }}>&larr; Exit</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {dsConfig.timeLimit > 0 && (
            <div aria-live="polite" aria-label={`Time remaining: ${Math.floor(dsTimer / 60)} minutes ${dsTimer % 60} seconds`} style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700,
              fontFamily: T.fontBody,
              background: timerUrgent ? T.dueBg : T.card,
              color: timerUrgent ? T.due : T.textMid,
              border: `1px solid ${timerUrgent ? T.due + "40" : T.border}`,
              animation: timerUrgent ? "pulse 0.8s infinite" : "none"
            }}>
              {Math.floor(dsTimer / 60)}:{String(dsTimer % 60).padStart(2, "0")}
            </div>
          )}
          <div style={{
            padding: "5px 14px", borderRadius: 20, background: T.card,
            border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, color: T.textMid,
            fontFamily: T.fontBody, boxShadow: T.shadow1
          }}>
            {dsIndex + 1} / {dsCards.length}
          </div>
        </div>
      </div>

      {/* Timer bar */}
      {dsConfig.timeLimit > 0 && (
        <div role="progressbar" aria-valuenow={dsTimer} aria-valuemin={0} aria-valuemax={dsConfig.timeLimit} aria-label="Timer progress" style={{ height: 3, borderRadius: 2, background: T.bgSub, marginBottom: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2, transition: "width 1s linear",
            background: timerUrgent ? T.due : T.text,
            width: `${timerPct}%`
          }} />
        </div>
      )}

      {/* Progress bar */}
      <div role="progressbar" aria-valuenow={dsIndex} aria-valuemin={0} aria-valuemax={dsCards.length} aria-label="Study progress" style={{ height: 3, borderRadius: 2, background: T.bgSub, marginBottom: 28, border: `1px solid ${T.border}` }}>
        <div style={{
          height: "100%", borderRadius: 2, transition: "width 0.4s ease",
          background: T.text, width: `${((dsIndex) / dsCards.length) * 100}%`
        }} />
      </div>

      {/* Tags */}
      {(currentDsCard.tags || []).length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, maxWidth: 580, margin: "0 auto 16px auto", width: "100%" }}>
          {currentDsCard.tags.map(tag => (
            <span key={tag} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: T.card, color: T.textMid, border: `1px solid ${T.borderStrong}`,
              fontFamily: T.fontBody, letterSpacing: 0.5, textTransform: "lowercase", boxShadow: T.shadow1
            }}>{tag}</span>
          ))}
        </div>
      )}

      <FlipCard card={currentDsCard} flipped={flipped} onFlip={() => { if (guessSubmitted) setFlipped(!flipped); }} />

      {/* Guess input */}
      {!flipped && !guessSubmitted && (
        <div style={{ marginTop: 28, animation: "fadeIn 0.3s ease" }}>
          <textarea value={guess} onChange={e => setGuess(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && guess.trim()) { e.preventDefault(); submitGuess(); } }}
            placeholder="Type your answer..."
            style={{
              width: "100%", minHeight: 80, padding: "12px 16px", borderRadius: T.radius,
              border: `1.5px solid ${T.border}`, fontSize: 15, lineHeight: 1.6,
              fontFamily: T.fontBody, color: T.text, background: T.inputBg,
              outline: "none", resize: "vertical", boxSizing: "border-box"
            }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
            <button onClick={onSkip} style={{
              padding: "9px 18px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
              background: T.white, color: T.textMid, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: T.fontBody
            }}>Skip &amp; Self-Rate</button>
            <button onClick={submitGuess} disabled={!guess.trim()} style={{
              padding: "9px 20px", borderRadius: T.radius, border: "none",
              background: guess.trim() ? T.done : T.bgSub, color: guess.trim() ? "#fff" : T.textLight,
              fontSize: 13, fontWeight: 600, cursor: guess.trim() ? "pointer" : "default", fontFamily: T.fontBody
            }}>Check Answer</button>
          </div>
        </div>
      )}

      {/* AI loading */}
      {guessSubmitted && aiLoading && (
        <div aria-live="polite" aria-busy="true" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          {guess.trim() && (
            <div style={{ display: "flex", justifyContent: "flex-start", animation: "slideInLeft 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", maxWidth: "80%", background: T.card, color: T.text, border: `1px solid ${T.border}`, fontSize: 14, lineHeight: 1.5, fontFamily: T.fontBody, boxShadow: T.shadow1 }}>{guess}</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", animation: "slideInRight 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both" }}>
            <div style={{ padding: "12px 18px", borderRadius: "16px 16px 4px 16px", background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow1, fontSize: 13, color: T.textMid, fontFamily: T.fontBody }}>
              <span style={{ animation: "pulse 1s infinite" }}>Evaluating...</span>
            </div>
          </div>
        </div>
      )}

      {/* AI result */}
      {guessSubmitted && aiResult && !aiLoading && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          {guess.trim() && (
            <div style={{ display: "flex", justifyContent: "flex-start", animation: "slideInLeft 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", maxWidth: "80%", background: ratingColors[aiResult.rating] || T.done, color: "#fff", fontSize: 14, lineHeight: 1.5, fontFamily: T.fontBody, boxShadow: `0 2px 8px ${ratingColors[aiResult.rating] || T.done}40` }}>{guess}</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", animation: "slideInRight 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.25s both" }}>
            <div style={{ padding: "14px 18px", borderRadius: "16px 16px 4px 16px", maxWidth: "85%", background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ padding: "3px 10px", borderRadius: 6, background: ratingBgs[aiResult.rating] || T.bgSub, color: ratingColors[aiResult.rating] || T.text, fontSize: 12, fontWeight: 700, fontFamily: T.fontBody, animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.5s both" }}>{aiResult.label}</div>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: T.text, fontFamily: T.fontBody, margin: 0 }}>{aiResult.explanation}</p>
            </div>
          </div>

          <div style={{ animation: "ratingSlideUp 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.5s both" }}>
            <p style={{ textAlign: "center", fontSize: 12, color: T.textLight, marginTop: 6, marginBottom: 12, fontFamily: T.fontBody }}>Accept or adjust</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { q: 0, label: "Forgot", color: T.forgot, bg: T.dueBg },
                { q: 2, label: "Hard", color: T.hard, bg: T.hardBg },
                { q: 3, label: "Good", color: T.good, bg: T.bgSub },
                { q: 4, label: "Easy", color: T.easy, bg: T.doneBg },
                { q: 5, label: "Perfect", color: T.perfect, bg: T.perfectBg },
              ].map((r, i) => {
                const isSuggested = r.q === aiResult.rating;
                return (
                  <button key={r.q} onClick={() => dsHandleRate(r.q)} style={{
                    padding: "10px 16px", borderRadius: T.radius, border: isSuggested ? `2px solid ${r.color}` : `1.5px solid ${r.color}30`,
                    background: isSuggested ? r.color : r.bg, color: isSuggested ? "#fff" : r.color,
                    fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s", minWidth: 74,
                    fontFamily: T.fontBody, boxShadow: isSuggested ? T.shadow2 : T.shadow1,
                    transform: isSuggested ? "translateY(-2px)" : "none",
                    animation: `popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.55 + i * 0.07}s both`
                  }}
                    onMouseEnter={e => { if (!isSuggested) { e.currentTarget.style.background = r.color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                    onMouseLeave={e => { if (!isSuggested) { e.currentTarget.style.background = r.bg; e.currentTarget.style.color = r.color; e.currentTarget.style.transform = "none"; } }}
                  >{r.label}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual rating (skipped guess) */}
      {guessSubmitted && !aiResult && !aiLoading && (
        <div style={{ animation: "fadeIn 0.3s ease", marginTop: 28 }}>
          <p style={{ textAlign: "center", fontSize: 12, color: T.textLight, marginBottom: 12, fontFamily: T.fontBody }}>How well did you know this?</p>
          <RatingButtons onRate={dsHandleRate} />
        </div>
      )}
    </div>
  );
}
