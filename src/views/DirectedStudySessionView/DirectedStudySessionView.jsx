import { useState, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";
import FlipCard from "../../components/FlipCard/FlipCard.jsx";
import AiChatResult from "../../components/AiChatResult/AiChatResult.jsx";

export default function DirectedStudySessionView({
  dsCards, dsIndex, dsConfig, dsTimer, flipped, guess, guessSubmitted,
  aiResult, aiLoading,
  setGuess, submitGuess, setFlipped, setGuessSubmitted, setShowRating, setAiResult,
  dsHandleRate, onExit, onSkip
}) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  const [cardPhase, setCardPhase] = useState("idle");
  const phaseTimer = useRef(null);
  const prevIndex = useRef(dsIndex);
  const guessInputRef = useRef(null);

  useEffect(() => {
    const el = guessInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [guess, flipped, guessSubmitted, dsIndex]);

  useEffect(() => {
    if (dsIndex !== prevIndex.current) {
      prevIndex.current = dsIndex;
      setCardPhase("enter");
      clearTimeout(phaseTimer.current);
      phaseTimer.current = setTimeout(() => setCardPhase("idle"), 350);
    }
  }, [dsIndex]);

  const wrappedRate = (quality) => {
    setCardPhase("dismiss");
    clearTimeout(phaseTimer.current);
    phaseTimer.current = setTimeout(() => {
      dsHandleRate(quality);
    }, 350);
  };

  const currentDsCard = dsCards[dsIndex];
  if (!currentDsCard) return null;

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
      <div style={{
        transition: cardPhase === "dismiss" ? "opacity 0.2s ease" : "none",
        opacity: cardPhase === "dismiss" ? 0 : 1,
        animation: cardPhase === "enter" ? "cardEnter 0.25s ease both" : "none",
      }}>
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
      </div>

      {/* FlipCard with swipe-off dismiss */}
      <div style={{
        transition: cardPhase === "dismiss" ? "transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease" : "none",
        transform: cardPhase === "dismiss" ? "translateX(-120%) translateY(40px) rotate(-8deg)" : "none",
        opacity: cardPhase === "dismiss" ? 0 : 1,
        animation: cardPhase === "enter" ? "cardEnter 0.3s ease both" : "none",
      }}>
        <FlipCard card={currentDsCard} flipped={flipped} onFlip={() => { if (guessSubmitted) setFlipped(!flipped); }} />
      </div>

      {/* UI below card — fades out on dismiss */}
      <div style={{
        transition: cardPhase === "dismiss" ? "opacity 0.2s ease" : "none",
        opacity: cardPhase === "dismiss" ? 0 : 1,
        animation: cardPhase === "enter" ? "cardEnter 0.25s ease both" : "none",
      }}>
        {/* Guess input */}
        {!flipped && !guessSubmitted && (
          <div style={{ marginTop: 28, animation: "fadeIn 0.3s ease", maxWidth: 580, margin: "28px auto 0 auto", width: "100%" }}>
            <textarea
              ref={guessInputRef}
              value={guess}
              onChange={e => setGuess(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && guess.trim()) { e.preventDefault(); submitGuess(); } }}
              placeholder="Type your answer..."
              rows={1}
              style={{
                width: "100%", padding: "10px 16px", borderRadius: 20,
                border: `1.5px solid ${T.border}`, fontSize: 15, lineHeight: 1.5,
                fontFamily: T.fontBody, color: T.text, background: T.inputBg,
                outline: "none", resize: "none", boxSizing: "border-box",
                transition: "border-color 0.2s",
                display: "block", overflow: "hidden"
              }}
              onFocus={e => e.target.style.borderColor = T.borderStrong}
              onBlur={e => e.target.style.borderColor = T.border}
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

        {/* AI Chat Result (loading + result + rating) */}
        <AiChatResult
          guess={guess}
          guessSubmitted={guessSubmitted}
          aiLoading={aiLoading}
          aiResult={aiResult}
          onRate={wrappedRate}
        />

        {/* Hint text */}
        {!flipped && !guessSubmitted && !guess && (
          <p style={{ textAlign: "center", color: T.textLight, fontSize: 12, marginTop: 16, fontFamily: T.fontBody }}>
            Type your answer above, or tap the card to self-rate
          </p>
        )}
      </div>
    </div>
  );
}
