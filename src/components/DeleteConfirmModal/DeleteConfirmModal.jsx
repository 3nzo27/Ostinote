import useTheme from "../../theme/useTheme.js";

export default function DeleteConfirmModal({ deckName, onConfirm, onCancel }) {
  const { T } = useTheme();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: T.modalOverlay, backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, animation: "fadeIn 0.15s ease"
    }} onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Delete deck confirmation" onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.borderStrong}`,
        boxShadow: T.shadow3, padding: "28px 24px", maxWidth: 360, width: "100%",
        textAlign: "center"
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 8 }}>
          Delete deck?
        </div>
        <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5, marginBottom: 22 }}>
          This will permanently remove <strong>{deckName}</strong> and all its cards. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{
            padding: "9px 22px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.white, color: T.textMid, fontWeight: 500, fontSize: 13,
            cursor: "pointer", fontFamily: T.fontBody
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: "9px 22px", borderRadius: T.radius, border: "none",
            background: T.due, color: "#fff", fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: T.fontBody,
            boxShadow: "0 2px 8px rgba(196,67,42,0.3)"
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}
