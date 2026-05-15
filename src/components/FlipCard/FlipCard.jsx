import { useState, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";

export default function FlipCard({ card, flipped, onFlip, style: wrapStyle = {}, compact = false }) {
  const { T } = useTheme();
  const [cardHeight, setCardHeight] = useState(200);
  const [skipTransition, setSkipTransition] = useState(false);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const prevCardId = useRef(card?.id);
  const CARD_MIN_H = 340;

  // When the card changes, suppress the flip transition so the new card appears front-side instantly
  useEffect(() => {
    if (card?.id !== prevCardId.current) {
      prevCardId.current = card?.id;
      setSkipTransition(true);
      const timer = setTimeout(() => setSkipTransition(false), 50);
      return () => clearTimeout(timer);
    }
  }, [card]);

  useEffect(() => {
    const measure = () => {
      const fh = frontRef.current?.scrollHeight || 0;
      const bh = backRef.current?.scrollHeight || 0;
      setCardHeight(Math.max(fh, bh, CARD_MIN_H));
    };
    measure();
    const timer = setTimeout(measure, 50);
    return () => clearTimeout(timer);
  }, [card, flipped]);

  const renderSide = (side) => {
    const hasDrawing = !!side.drawing;
    const hasAudio = !!side.audio;
    const hasText = !!side.text;
    const textOnly = hasText && !hasDrawing && !hasAudio;
    const empty = !hasText && !hasDrawing && !hasAudio;

    return (
      <div style={{
        padding: "20px 22px", display: "flex", flexDirection: "column",
        gap: 10, overflow: "hidden", boxSizing: "border-box", width: "100%",
        minHeight: CARD_MIN_H - 38,
        justifyContent: (textOnly || empty) ? "center" : "flex-start",
        alignItems: (textOnly || empty) ? "center" : "stretch",
      }}>
        {hasText && (
          <div style={{
            fontSize: textOnly ? 22 : 17,
            lineHeight: textOnly ? 1.5 : 1.7,
            color: T.text, fontFamily: T.fontBody,
            fontWeight: textOnly ? 500 : 400,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            textAlign: textOnly ? "center" : "left",
            maxWidth: textOnly ? "90%" : "100%",
          }}>{side.text}</div>
        )}
        {hasDrawing && <img src={side.drawing} alt="" style={{ width: "100%", borderRadius: 6, border: `1px solid ${T.border}`, display: "block", background: T.canvasBg }} />}
        {hasAudio && <audio src={side.audio} controls style={{ width: "100%", marginTop: 4, display: "block" }} />}
        {empty && (
          <div style={{ color: T.textLight, fontStyle: "italic", fontSize: 14, fontFamily: T.fontBody }}>Empty side</div>
        )}
      </div>
    );
  };

  // `compact` flattens the card into its surroundings — no border, no
  // shadow, transparent bg. Used inside the Tool Bar so the FlipCard
  // doesn't read as a separate "box-in-a-box" against the Tool Bar's
  // T.card background.
  const faceBase = {
    position: "absolute", top: 0, left: 0, width: "100%", minHeight: "100%",
    backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
    borderRadius: compact ? 0 : T.radiusLg,
    overflow: "hidden",
    border: compact ? "none" : `1px solid ${T.borderStrong}`,
    boxShadow: compact ? "none" : T.shadow3,
    boxSizing: "border-box",
  };

  const header = (label) => (
    <div style={{ padding: "10px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: T.textLight, fontFamily: T.fontBody }}>{label}</span>
      <span style={{ fontSize: 10, color: T.textLight, fontFamily: T.fontBody, letterSpacing: 0.5 }}>tap to flip</span>
    </div>
  );

  return (
    <div role="button" tabIndex={0} aria-label={flipped ? "Flashcard showing back side, tap to flip" : "Flashcard showing front side, tap to flip"} onClick={onFlip} style={{ perspective: 900, cursor: "pointer", width: "100%", maxWidth: 580, margin: "0 auto", ...wrapStyle }}>
      <div style={{
        position: "relative", width: "100%", height: cardHeight,
        transition: skipTransition ? "none" : "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
        transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0)"
      }}>
        {/* In compact (Tool Bar) mode the faces inherit the parent's bg
            so the card melts into its surroundings. In standalone mode
            they keep their distinct card surfaces. */}
        <div ref={frontRef} style={{ ...faceBase, background: compact ? "transparent" : T.card }}>{header("Front")}{renderSide(card.front)}</div>
        <div ref={backRef} style={{ ...faceBase, background: compact ? "transparent" : T.cardAlt, transform: "rotateY(180deg)" }}>{header("Back")}{renderSide(card.back)}</div>
      </div>
    </div>
  );
}
