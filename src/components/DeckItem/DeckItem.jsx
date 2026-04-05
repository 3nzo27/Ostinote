import useTheme from "../../theme/useTheme.js";

export default function DeckItem({ deck, onSelect, onDelete }) {
  const { T } = useTheme();
  const dueCount = deck.cards.filter(c => c.nextReview <= Date.now()).length;

  return (
    <div onClick={onSelect} style={{
      padding: "18px 22px", borderRadius: T.radiusLg, cursor: "pointer", transition: "all 0.2s",
      background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2,
      display: "flex", justifyContent: "space-between", alignItems: "center"
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = T.shadowHover; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = T.shadow2; }}
    >
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, color: T.text, fontFamily: T.font }}>{deck.name}</div>
        <div style={{ fontSize: 13, color: T.textMid, marginTop: 5, fontFamily: T.fontBody }}>
          {deck.cards.length} card{deck.cards.length !== 1 ? "s" : ""} · <span style={{ color: dueCount > 0 ? T.due : T.done, fontWeight: 600 }}>{dueCount} due</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: dueCount > 0 ? T.due : T.done, color: "#fff", fontWeight: 700, fontSize: 14,
          fontFamily: T.fontBody, boxShadow: dueCount > 0 ? "0 2px 8px rgba(196,67,42,0.3)" : "0 2px 8px rgba(58,125,92,0.25)"
        }}>{dueCount}</div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
          width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.white,
          cursor: "pointer", fontSize: 13, color: T.textLight, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s"
        }}
          onMouseEnter={e => { e.currentTarget.style.color = T.due; e.currentTarget.style.borderColor = T.due; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.textLight; e.currentTarget.style.borderColor = T.border; }}
        >×</button>
      </div>
    </div>
  );
}
