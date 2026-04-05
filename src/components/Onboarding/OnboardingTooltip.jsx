import { useState, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";

export default function OnboardingTooltip({ hintKey, children, onDismiss }) {
  const { T } = useTheme();

  const [visible, setVisible] = useState(() => {
    try {
      if (JSON.parse(localStorage.getItem("ostinote_onboardingDone")) !== true) return false;
      const hints = JSON.parse(localStorage.getItem("ostinote_hints")) || {};
      return !hints[hintKey];
    } catch { return false; }
  });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss(), 8000);
    return () => clearTimeout(timer);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    try {
      const hints = JSON.parse(localStorage.getItem("ostinote_hints")) || {};
      hints[hintKey] = true;
      localStorage.setItem("ostinote_hints", JSON.stringify(hints));
    } catch {}
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <div style={{
      padding: "12px 16px", borderRadius: T.radius,
      background: T.card, border: `1px solid ${T.borderStrong}`,
      boxShadow: T.shadow2, animation: "popIn 0.3s ease",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
    }}>
      <span style={{ fontSize: 13, color: T.text, fontFamily: T.fontBody, lineHeight: 1.4 }}>
        {children}
      </span>
      <button onClick={dismiss} style={{
        background: "none", border: "none", padding: 0, cursor: "pointer",
        fontSize: 12, fontWeight: 600, color: T.textMid, fontFamily: T.fontBody,
        whiteSpace: "nowrap", flexShrink: 0
      }}>Got it</button>
    </div>
  );
}
