import { useState, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";

export default function HoverMenu({ label, preview, children }) {
  const { T } = useTheme();
  const [open, setOpen] = useState(false);
  const timeout = useRef(null);
  const containerRef = useRef(null);

  const enter = () => { clearTimeout(timeout.current); setOpen(true); };
  const leave = () => { timeout.current = setTimeout(() => setOpen(false), 30); };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  return (
    <div ref={containerRef} onMouseEnter={enter} onMouseLeave={leave} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
        borderRadius: 6, border: `1.5px solid ${open ? T.borderStrong : T.border}`,
        background: open ? T.bgSub : T.white, cursor: "pointer",
        fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, color: T.textMid,
        transition: "all 0.15s", whiteSpace: "nowrap"
      }}>
        {preview}
        <span>{label}</span>
        <span style={{ fontSize: 8, opacity: 0.5 }}>&#9660;</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, paddingTop: 2, zIndex: 20 }}>
          <div style={{
            background: T.card, border: `1px solid ${T.borderStrong}`,
            borderRadius: T.radius, boxShadow: T.shadow3, padding: 12,
            animation: "fadeIn 0.12s ease", minWidth: 160
          }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
