import useTheme from "../../theme/useTheme.js";

export default function RatingButtons({ onRate }) {
  const { T } = useTheme();
  const ratings = [
    { q: 0, label: "Forgot", color: T.forgot, bg: T.dueBg },
    { q: 2, label: "Hard", color: T.hard, bg: T.hardBg },
    { q: 3, label: "Good", color: T.good, bg: T.goodBg },
    { q: 4, label: "Easy", color: T.easy, bg: T.easyBg },
    { q: 5, label: "Perfect", color: T.perfect, bg: T.perfectBg },
  ];
  const fg = T.ratingFg;

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
      {ratings.map(r => {
        const textColor = fg || r.color;
        const borderColor = fg ? `${fg}40` : `${r.color}30`;
        return (
          <button key={r.q} aria-label={`Rate as ${r.label}`} onClick={() => onRate(r.q)} style={{
            padding: "10px 16px", borderRadius: T.radius, border: `1.5px solid ${borderColor}`,
            background: r.bg, color: textColor, fontWeight: 600, fontSize: 13, cursor: "pointer",
            transition: "all 0.15s", minWidth: 74, fontFamily: T.fontBody, boxShadow: T.shadow1
          }}
            onMouseEnter={e => { e.currentTarget.style.background = r.color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = T.shadow2; }}
            onMouseLeave={e => { e.currentTarget.style.background = r.bg; e.currentTarget.style.color = textColor; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = T.shadow1; }}
          >{r.label}</button>
        );
      })}
    </div>
  );
}
