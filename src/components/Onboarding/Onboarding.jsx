import { useState, useEffect, useRef } from "react";
import useTheme from "../../theme/useTheme.js";

const STEPS = 4;

export default function Onboarding({ onComplete }) {
  const { T } = useTheme();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [deckName, setDeckName] = useState("");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 480);
  const inputRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (step === 3 && inputRef.current) inputRef.current.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onComplete(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onComplete]);

  const goNext = () => { setDirection("forward"); setStep(s => Math.min(s + 1, STEPS - 1)); };
  const goBack = () => { setDirection("back"); setStep(s => Math.max(s - 1, 0)); };
  const skip = () => onComplete(null);
  const createDeck = () => {
    if (deckName.trim()) onComplete({ name: deckName.trim() });
  };

  const animStyle = {
    animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 0.3s ease`,
  };

  const headingStyle = {
    fontSize: isMobile ? 22 : 24, fontWeight: 700, fontFamily: T.font,
    color: T.text, marginBottom: 8, letterSpacing: -0.3
  };

  const bodyStyle = {
    fontSize: 14, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.6
  };

  const renderStep = () => {
    if (step === 0) return (
      <div key={0} style={{ ...animStyle, textAlign: "center", padding: "8px 0" }}>
        {/* Card stack illustration */}
        <div style={{ marginBottom: 28 }}>
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" style={{ display: "block", margin: "0 auto" }}>
            <rect x="20" y="24" width="64" height="48" rx="6" stroke={T.textLight} strokeWidth="1.5" fill="none" transform="rotate(-6 52 48)" opacity="0.4" />
            <rect x="26" y="18" width="64" height="48" rx="6" stroke={T.textLight} strokeWidth="1.5" fill="none" transform="rotate(-3 58 42)" opacity="0.6" />
            <rect x="32" y="14" width="64" height="48" rx="6" stroke={T.borderStrong} strokeWidth="1.5" fill={T.card} />
            <line x1="44" y1="28" x2="84" y2="28" stroke={T.textLight} strokeWidth="2" strokeLinecap="round" />
            <line x1="44" y1="36" x2="74" y2="36" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <line x1="44" y1="44" x2="78" y2="44" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            {/* Sparkle */}
            <circle cx="98" cy="20" r="2" fill={T.done} opacity="0.7" />
            <circle cx="104" cy="32" r="1.5" fill={T.easy} opacity="0.5" />
            <circle cx="22" cy="16" r="1.5" fill={T.perfect} opacity="0.5" />
          </svg>
        </div>
        <h1 style={{ ...headingStyle, fontSize: isMobile ? 24 : 28 }}>Welcome to Ostinote</h1>
        <p style={{ ...bodyStyle, marginBottom: 32, maxWidth: 320, margin: "0 auto 32px" }}>
          Remember anything with the power of spaced repetition
        </p>
        <button onClick={goNext} style={{
          width: "100%", padding: "14px", borderRadius: T.radius, border: "none",
          background: T.accent, color: T.white, fontWeight: 600, fontSize: 15,
          cursor: "pointer", fontFamily: T.fontBody,
          boxShadow: "0 2px 8px rgba(44,42,37,0.18)", transition: "all 0.15s"
        }}>Get Started</button>
      </div>
    );

    if (step === 1) return (
      <div key={1} style={{ ...animStyle, padding: "8px 0" }}>
        <h2 style={headingStyle}>How it works</h2>
        <p style={{ ...bodyStyle, marginBottom: 24 }}>Three simple steps to lasting memory</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { num: "1", text: "Create cards with questions and answers", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            )},
            { num: "2", text: "Study and rate how well you remember", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            )},
            { num: "3", text: "Ostinote schedules reviews at the best time", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            )},
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: T.accent, display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {s.icon}
              </div>
              <span style={{ fontSize: 14, color: T.text, fontFamily: T.fontBody, fontWeight: 500 }}>{s.text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
          <button onClick={goBack} style={{
            padding: "12px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.white, color: T.textMid, fontWeight: 500, fontSize: 14,
            cursor: "pointer", fontFamily: T.fontBody
          }}>Back</button>
          <button onClick={goNext} style={{
            flex: 1, padding: "12px", borderRadius: T.radius, border: "none",
            background: T.accent, color: T.white, fontWeight: 600, fontSize: 14,
            cursor: "pointer", fontFamily: T.fontBody,
            boxShadow: "0 2px 8px rgba(44,42,37,0.18)"
          }}>Next</button>
        </div>
      </div>
    );

    if (step === 2) return (
      <div key={2} style={{ ...animStyle, padding: "8px 0" }}>
        <h2 style={headingStyle}>What you can do</h2>
        <p style={{ ...bodyStyle, marginBottom: 24 }}>Powerful tools to learn your way</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            ), name: "Draw on your cards", desc: "Sketch diagrams and visual notes" },
            { icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            ), name: "Record audio", desc: "Capture pronunciation and spoken answers" },
            { icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            ), name: "AI grading", desc: "Get instant feedback on your answers" },
            { icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
            ), name: "Sync across devices", desc: "Sign in to keep your cards everywhere" },
          ].map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 14px", borderRadius: T.radius,
              background: T.bgSub, border: `1px solid ${T.border}`
            }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>{f.name}</div>
                <div style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, marginTop: 1 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button onClick={goBack} style={{
            padding: "12px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.white, color: T.textMid, fontWeight: 500, fontSize: 14,
            cursor: "pointer", fontFamily: T.fontBody
          }}>Back</button>
          <button onClick={goNext} style={{
            flex: 1, padding: "12px", borderRadius: T.radius, border: "none",
            background: T.accent, color: T.white, fontWeight: 600, fontSize: 14,
            cursor: "pointer", fontFamily: T.fontBody,
            boxShadow: "0 2px 8px rgba(44,42,37,0.18)"
          }}>Next</button>
        </div>
      </div>
    );

    if (step === 3) return (
      <div key={3} style={{ ...animStyle, padding: "8px 0" }}>
        <h2 style={headingStyle}>Create your first deck</h2>
        <p style={{ ...bodyStyle, marginBottom: 24 }}>
          Give your deck a name and start adding cards
        </p>
        <input
          ref={inputRef}
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && deckName.trim()) createDeck(); }}
          placeholder="e.g. Spanish Vocabulary, Biology 101..."
          style={{
            width: "100%", padding: "12px 14px", borderRadius: T.radius,
            border: `1.5px solid ${T.border}`, fontSize: 15, fontFamily: T.fontBody,
            color: T.text, background: T.inputBg, outline: "none",
            boxSizing: "border-box", marginBottom: 14
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={goBack} style={{
            padding: "12px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.white, color: T.textMid, fontWeight: 500, fontSize: 14,
            cursor: "pointer", fontFamily: T.fontBody
          }}>Back</button>
          <button onClick={createDeck} disabled={!deckName.trim()} style={{
            flex: 1, padding: "12px", borderRadius: T.radius, border: "none",
            background: deckName.trim() ? T.accent : T.bgSub,
            color: deckName.trim() ? T.white : T.textLight,
            fontWeight: 600, fontSize: 14, cursor: deckName.trim() ? "pointer" : "default",
            fontFamily: T.fontBody,
            boxShadow: deckName.trim() ? "0 2px 8px rgba(44,42,37,0.18)" : "none",
            transition: "all 0.15s"
          }}>Create & Start Learning</button>
        </div>
        <button onClick={skip} style={{
          display: "block", width: "100%", marginTop: 16, padding: "8px",
          background: "none", border: "none", fontSize: 13, color: T.textLight,
          cursor: "pointer", fontFamily: T.fontBody, textAlign: "center"
        }}>I'll explore on my own</button>
      </div>
    );

    return null;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: T.modalOverlay, backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: isMobile ? 0 : 16, animation: "fadeIn 0.3s ease"
    }}>
      <div
        role="dialog" aria-modal="true" aria-label="Welcome to Ostinote"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: isMobile ? 0 : T.radiusLg,
          border: isMobile ? "none" : `1px solid ${T.borderStrong}`,
          boxShadow: isMobile ? "none" : T.shadow3,
          padding: isMobile ? "32px 24px" : "36px 32px",
          maxWidth: isMobile ? "100%" : 480, width: "100%",
          minHeight: isMobile ? "100vh" : "auto",
          display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
          boxSizing: "border-box"
        }}
      >
        {/* Skip button */}
        {step < 3 && (
          <button onClick={skip} style={{
            position: "absolute", top: isMobile ? 20 : 18, right: isMobile ? 20 : 22,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, color: T.textLight, fontFamily: T.fontBody, fontWeight: 500,
            padding: "4px 8px", zIndex: 1
          }}>Skip</button>
        )}

        {/* Step content */}
        <div style={{ flex: 1 }}>
          {renderStep()}
        </div>

        {/* Progress dots */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 8,
          paddingTop: 24
        }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <div key={i} aria-label={`Step ${i + 1} of ${STEPS}`} style={{
              width: i === step ? 20 : 8, height: 8, borderRadius: 4,
              background: i === step ? T.accent : T.border,
              transition: "all 0.3s ease"
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
