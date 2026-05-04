import { useState, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";
import FlipCard from "../../components/FlipCard/FlipCard.jsx";
import AiChatResult from "../../components/AiChatResult/AiChatResult.jsx";

export default function StudyView({
  studyCards, studyIndex, flipped, guess, guessSubmitted, aiResult, aiLoading,
  showFlipHint, hideFlipHintForever,
  setGuess, submitGuess, skipGuess, handleFlip, handleRate,
  setShowFlipHint, setHideFlipHintForever, onNavigate
}) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  const guessInputRef = useRef(null);
  useEffect(() => {
    const el = guessInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [guess, flipped, guessSubmitted]);

  const ratingColors = { 0: T.forgot, 2: T.hard, 3: T.good, 4: T.easy, 5: T.perfect };
  const ratingBgs = { 0: T.dueBg, 2: T.hardBg, 3: T.goodBg, 4: T.easyBg, 5: T.perfectBg };

  const [cardPhase, setCardPhase] = useState("idle");
  const phaseTimer = useRef(null);
  const prevIndex = useRef(studyIndex);

  useEffect(() => {
    if (studyIndex !== prevIndex.current) {
      prevIndex.current = studyIndex;
      setCardPhase("enter");
      clearTimeout(phaseTimer.current);
      phaseTimer.current = setTimeout(() => setCardPhase("idle"), 350);
    }
  }, [studyIndex]);

  const wrappedRate = (quality) => {
    setCardPhase("dismiss");
    clearTimeout(phaseTimer.current);
    phaseTimer.current = setTimeout(() => {
      handleRate(quality);
    }, 350);
  };

  // Completion screen
  if (studyCards.length === 0) {
    return (
      <div style={{ ...containerStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 88, height: 88, marginBottom: 24 }}>
          <div style={{ position: "absolute", width: 6, height: 6, borderRadius: "50%", background: T.easy, top: 2, left: 14, opacity: 0.6 }} />
          <div style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: T.good, top: 8, right: 10, opacity: 0.5 }} />
          <div style={{ position: "absolute", width: 5, height: 5, borderRadius: "50%", background: T.perfect, top: 0, right: 28, opacity: 0.7 }} />
          <div style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: T.hard, bottom: 6, left: 8, opacity: 0.5 }} />
          <div style={{ position: "absolute", width: 5, height: 5, borderRadius: "50%", background: T.easy, bottom: 2, right: 12, opacity: 0.6 }} />
          <div style={{ position: "absolute", width: 3, height: 3, borderRadius: "50%", background: T.done, top: 16, left: 4, opacity: 0.4 }} />
          <div style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: T.good, bottom: 14, right: 2, opacity: 0.5 }} />
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 64, height: 64, borderRadius: "50%",
            background: T.doneBg, border: `1.5px solid ${T.done}30`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.done} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 6 }}>You crushed it!</h2>
        <p style={{ color: T.textMid, marginTop: 4, marginBottom: 28, fontFamily: T.fontBody, fontSize: 14, textAlign: "center", lineHeight: 1.5, maxWidth: 260 }}>
          No cards due right now. Come back later for your next review.
        </p>
        <button onClick={() => onNavigate("deck")} style={{ padding: "12px 28px", borderRadius: T.radius, border: "none", background: T.accent, color: T.white, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(44,42,37,0.2)", transition: "all 0.15s" }}>Back to Deck</button>
      </div>
    );
  }

  const currentCard = studyCards[studyIndex];
  if (!currentCard) { onNavigate("deck"); return null; }

  const onFlip = () => {
    if (guessSubmitted) {
      handleFlip();
    } else {
      if (hideFlipHintForever) {
        skipGuess();
      } else {
        setShowFlipHint(true);
      }
    }
  };

  return (
    <div style={{ ...containerStyle, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <button onClick={() => onNavigate("deck")} style={{ background: "none", border: "none", color: T.textMid, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, fontFamily: T.fontBody }}>&larr; Exit</button>
        <div aria-live="polite" style={{ padding: "5px 14px", borderRadius: 20, background: T.card, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, color: T.textMid, fontFamily: T.fontBody, boxShadow: T.shadow1 }}>
          {studyIndex + 1} / {studyCards.length}
        </div>
      </div>
      <div role="progressbar" aria-valuenow={studyIndex} aria-valuemin={0} aria-valuemax={studyCards.length} aria-label="Study progress" style={{ height: 3, borderRadius: 2, background: T.bgSub, marginBottom: 28, border: `1px solid ${T.border}` }}>
        <div style={{ height: "100%", borderRadius: 2, transition: "width 0.4s ease", background: T.text, width: `${((studyIndex) / studyCards.length) * 100}%` }} />
      </div>

      {/* Tags */}
      <div style={{
        transition: cardPhase === "dismiss" ? "opacity 0.2s ease" : "none",
        opacity: cardPhase === "dismiss" ? 0 : 1,
        animation: cardPhase === "enter" ? "cardEnter 0.25s ease both" : "none",
      }}>
        {(currentCard.tags || []).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, maxWidth: 580, margin: "0 auto 16px auto", width: "100%" }}>
            {currentCard.tags.map(tag => (
              <span key={tag} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: T.card, color: T.textMid, border: `1px solid ${T.borderStrong}`,
                fontFamily: T.fontBody, letterSpacing: 0.5, textTransform: "lowercase",
                boxShadow: T.shadow1
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
        <FlipCard card={currentCard} flipped={flipped} onFlip={onFlip} />
      </div>

      {/* UI below card — fades out on dismiss */}
      <div style={{
        transition: cardPhase === "dismiss" ? "opacity 0.2s ease" : "none",
        opacity: cardPhase === "dismiss" ? 0 : 1,
        animation: cardPhase === "enter" ? "cardEnter 0.25s ease both" : "none",
      }}>
        {/* Guess input (before flip) */}
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
              <button onClick={skipGuess} style={{
                padding: "9px 18px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                background: T.white, color: T.textMid, fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: T.fontBody
              }}>Skip &amp; Self-Rate</button>
              <button onClick={submitGuess} disabled={!guess.trim()} style={{
                padding: "9px 20px", borderRadius: T.radius, border: "none",
                background: guess.trim() ? T.done : T.bgSub,
                color: guess.trim() ? "#fff" : T.textLight,
                fontSize: 13, fontWeight: 600, cursor: guess.trim() ? "pointer" : "default",
                fontFamily: T.fontBody, boxShadow: guess.trim() ? "0 2px 8px rgba(58,125,92,0.25)" : "none"
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
          ratingColors={ratingColors}
          ratingBgs={ratingBgs}
          onRate={wrappedRate}
        />

        {/* Hint text */}
        {!flipped && !guessSubmitted && !guess && (
          <p style={{ textAlign: "center", color: T.textLight, fontSize: 12, marginTop: 16, fontFamily: T.fontBody }}>
            Type your answer above, or tap the card to self-rate
          </p>
        )}
      </div>

      {/* Flip hint popup */}
      {showFlipHint && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: T.modalOverlay, backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, animation: "fadeIn 0.15s ease"
        }} onClick={() => setShowFlipHint(false)}>
          <div role="dialog" aria-modal="true" aria-label="Flip and self-rate confirmation" onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.borderStrong}`,
            boxShadow: T.shadow3, padding: "28px 24px", maxWidth: 380, width: "100%"
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 8 }}>
              Flip and self-rate?
            </div>
            <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.6, marginBottom: 18 }}>
              You can tap the card to flip it and rate yourself manually, skipping the AI evaluation. This is useful for drawing or audio cards, or when you just want to move quickly.
            </p>
            <label style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
              fontSize: 12, color: T.textMid, fontFamily: T.fontBody, cursor: "pointer",
              userSelect: "none"
            }}>
              <input
                type="checkbox"
                checked={hideFlipHintForever}
                onChange={e => setHideFlipHintForever(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: T.done, cursor: "pointer" }}
              />
              Don't show this again
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowFlipHint(false)} style={{
                padding: "9px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                background: T.white, color: T.textMid, fontWeight: 500, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody
              }}>Go back</button>
              <button onClick={() => { setShowFlipHint(false); skipGuess(); }} style={{
                padding: "9px 20px", borderRadius: T.radius, border: "none",
                background: T.accent, color: T.white, fontWeight: 600, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody,
                boxShadow: "0 2px 8px rgba(44,42,37,0.2)"
              }}>Flip and self-rate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
