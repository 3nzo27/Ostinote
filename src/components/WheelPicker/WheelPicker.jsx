import { useState, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";

export default function WheelPicker({ options, value, onChange }) {
  const { T } = useTheme();
  const ITEM_H = 36;
  const VISIBLE = 5;
  const scrollRef = useRef(null);
  const currentIdx = options.findIndex(o => o.v === value);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (scrollRef.current && currentIdx >= 0) {
      scrollRef.current.scrollTop = currentIdx * ITEM_H;
      setScrollY(currentIdx * ITEM_H);
    }
  }, [currentIdx]);

  const handleScroll = (e) => {
    const top = e.target.scrollTop;
    setScrollY(top);
    const idx = Math.round(top / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, options.length - 1));
    if (options[clamped].v !== value) {
      onChange(options[clamped].v);
    }
  };

  return (
    <div style={{
      position: "relative", height: ITEM_H * VISIBLE, overflow: "hidden", borderRadius: 12,
      background: T.bgSub,
      border: `1.5px solid ${T.borderStrong}`
    }}>
      <div style={{
        position: "absolute", top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
        background: T.card, borderRadius: 10,
        boxShadow: `0 0 12px ${T.card}`,
        pointerEvents: "none", zIndex: 0
      }} />
      <div ref={scrollRef} onScroll={handleScroll} style={{
        height: "100%", overflowY: "auto", scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch", position: "relative", zIndex: 1,
        scrollbarWidth: "none", msOverflowStyle: "none"
      }}>
        <div style={{ height: ITEM_H * 2 }} />
        {options.map((o, i) => {
          const itemCenterInScroll = (ITEM_H * 2) + (i * ITEM_H) + (ITEM_H / 2);
          const viewportCenter = scrollY + (ITEM_H * 2) + (ITEM_H / 2);
          const dist = Math.abs(itemCenterInScroll - viewportCenter);
          const maxDist = ITEM_H * 2.5;
          const ratio = Math.min(dist / maxDist, 1);
          const scale = 1.1 - ratio * 0.4;
          const rotateX = ratio * 50;
          const sign = (itemCenterInScroll - viewportCenter) < 0 ? 1 : -1;

          return (
            <div key={o.v} style={{
              height: ITEM_H, display: "flex", alignItems: "center", justifyContent: "center",
              scrollSnapAlign: "center",
              fontSize: 16, fontWeight: ratio < 0.15 ? 600 : 400,
              color: ratio < 0.15 ? T.text : T.textLight,
              fontFamily: T.fontBody, cursor: "default",
              userSelect: "none",
              transform: `scale(${scale}) perspective(300px) rotateX(${sign * rotateX * 0.25}deg)`,
              opacity: 1 - ratio * 0.6,
              transition: "none",
            }}>{o.l}</div>
          );
        })}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: `linear-gradient(rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.03) 40%, transparent 100%)`,
        pointerEvents: "none", zIndex: 2
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: `linear-gradient(transparent 0%, rgba(0,0,0,0.03) 60%, rgba(0,0,0,0.07) 100%)`,
        pointerEvents: "none", zIndex: 2
      }} />
    </div>
  );
}
