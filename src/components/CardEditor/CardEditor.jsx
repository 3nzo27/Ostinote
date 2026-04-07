import { useState, useRef } from "react";
import useTheme from "../../theme/useTheme.js";
import DrawingCanvas from "../DrawingCanvas/DrawingCanvas.jsx";
import AudioRecorder from "../AudioRecorder/AudioRecorder.jsx";

export default function CardEditor({ initialFront, initialBack, initialTags, onSave, onCancel, saveLabel = "Save Card" }) {
  const { T } = useTheme();
  const [activeSide, setActiveSide] = useState("front");
  const [activeTab, setActiveTab] = useState("text");
  const [front, setFront] = useState(initialFront || { text: "", drawing: null, audio: null });
  const [back, setBack] = useState(initialBack || { text: "", drawing: null, audio: null });
  const [tags, setTags] = useState(initialTags || []);
  const [tagInput, setTagInput] = useState("");
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [flipAngle, setFlipAngle] = useState(0);
  const [contentHidden, setContentHidden] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const flipTimer = useRef(null);
  const side = activeSide === "front" ? front : back;
  const setSide = activeSide === "front" ? setFront : setBack;
  const tabs = [{ id: "text", label: "Text" }, { id: "draw", label: "Draw" }, { id: "audio", label: "Audio" }];

  const handleFlip = (newSide) => {
    if (newSide === activeSide || flipping) return;
    setFlipping(true);
    setFlipAngle(prev => prev + 180);
    clearTimeout(flipTimer.current);
    // Hide content just before midpoint, swap, then reveal after midpoint
    setTimeout(() => setContentHidden(true), 180);
    flipTimer.current = setTimeout(() => {
      setActiveSide(newSide);
      setRevealing(true);
      setTimeout(() => setContentHidden(false), 70);
      setTimeout(() => setRevealing(false), 400);
    }, 250);
    setTimeout(() => setFlipping(false), 500);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };
  const removeTag = (tag) => setTags(tags.filter(t => t !== tag));

  const suggestedTags = ["spelling", "vocabulary", "definition", "concept", "formula", "date", "name", "translation", "diagram"];

  return (
    <div style={{ perspective: 900, width: "100%", boxSizing: "border-box" }}>
      <div style={{
        transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
        transformStyle: "preserve-3d",
        transform: `rotateY(${flipAngle}deg)`,
        background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.borderStrong}`,
        boxShadow: T.shadow2, overflow: "hidden", width: "100%", boxSizing: "border-box",
      }}>
        <div style={{
          transform: `rotateY(${-flipAngle}deg)`,
          opacity: contentHidden ? 0 : 1,
          transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
        }}>
        <div style={{
          display: "flex", borderBottom: `1px solid ${T.border}`,
          animation: revealing ? "cardEnter 0.2s ease both" : "none",
        }}>
          {["front", "back"].map(s => (
            <button key={s} onClick={() => handleFlip(s)} style={{
              flex: 1, padding: "13px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: 1.5, transition: "all 0.2s", fontFamily: T.fontBody,
              background: activeSide === s ? T.bgSub : "transparent", color: activeSide === s ? T.text : T.textLight
            }}>{s} side</button>
          ))}
        </div>
        <div style={{
          display: "flex", gap: 4, padding: "12px 18px", borderBottom: `1px solid ${T.border}`,
          animation: revealing ? "cardEnter 0.2s ease 0.04s both" : "none",
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${activeTab === t.id ? T.borderStrong : T.border}`,
              background: activeTab === t.id ? T.bgSub : "transparent", color: activeTab === t.id ? T.text : T.textMid,
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", fontFamily: T.fontBody, letterSpacing: 0.3
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{
          padding: "18px", minHeight: 280, overflow: "hidden", boxSizing: "border-box",
          animation: revealing ? "cardEnter 0.2s ease 0.08s both" : "none",
        }}>
          {activeTab === "text" && (
            <textarea value={side.text} onChange={e => setSide({ ...side, text: e.target.value })}
              placeholder={`Type the ${activeSide} of your card...`}
              style={{
                width: "100%", minHeight: 220, border: `1.5px solid ${T.border}`, borderRadius: T.radius,
                padding: 16, fontSize: 15, lineHeight: 1.7, resize: "vertical", boxSizing: "border-box",
                fontFamily: T.fontBody, color: T.text, outline: "none", transition: "border-color 0.2s", background: T.inputBg
              }}
              onFocus={e => e.target.style.borderColor = T.borderStrong}
              onBlur={e => e.target.style.borderColor = T.border}
            />
          )}
          {activeTab === "draw" && <DrawingCanvas dataUrl={side.drawing} onChange={d => setSide({ ...side, drawing: d })} />}
          {activeTab === "audio" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: T.due, opacity: 0.3 }} />
              </div>
              <AudioRecorder audioUrl={side.audio} onChange={a => setSide({ ...side, audio: a })} />
            </div>
          )}
        </div>

        {/* Tags section — hover to expand */}
        <div
          onMouseEnter={() => setTagDropOpen(true)}
          onMouseLeave={() => setTagDropOpen(false)}
          style={{
            padding: tagDropOpen ? "16px 18px" : "12px 18px",
            borderTop: `1px solid ${T.border}`,
            background: tagDropOpen ? T.bgSub : T.cardAlt,
            transition: "all 0.35s ease",
            animation: revealing ? "cardEnter 0.2s ease 0.12s both" : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>Tags</span>
              {tags.map(tag => (
                <span key={tag} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                  background: T.bgSub, color: T.text, border: `1px solid ${T.border}`,
                  fontFamily: T.fontBody
                }}>
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontSize: 13, color: T.textLight, lineHeight: 1, display: "flex"
                  }}>×</button>
                </span>
              ))}
              {tags.length === 0 && (
                <span style={{ fontSize: 11, color: T.textLight, fontFamily: T.fontBody }}>None</span>
              )}
            </div>
          </div>

          <div style={{
            maxHeight: tagDropOpen ? 200 : 0,
            opacity: tagDropOpen ? 1 : 0,
            overflow: "hidden",
            transition: "all 0.45s cubic-bezier(0.4,0,0.2,1)",
            marginTop: tagDropOpen ? 12 : 0
          }}>
            {/* Tag input */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag..."
                style={{
                  flex: 1, padding: "6px 12px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                  fontSize: 12, fontFamily: T.fontBody, color: T.text, outline: "none", background: T.inputBg,
                  boxSizing: "border-box"
                }}
              />
              <button onClick={addTag} disabled={!tagInput.trim()} style={{
                padding: "6px 12px", borderRadius: T.radius, border: "none",
                background: tagInput.trim() ? T.text : T.bgSub,
                color: tagInput.trim() ? T.card : T.textLight,
                fontSize: 12, fontWeight: 600, cursor: tagInput.trim() ? "pointer" : "default",
                fontFamily: T.fontBody
              }}>Add</button>
            </div>

            {/* Suggested tags */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {suggestedTags.filter(s => !tags.includes(s)).slice(0, 6).map(s => (
                <button key={s} onClick={() => setTags([...tags, s])} style={{
                  padding: "3px 10px", borderRadius: 20, border: `1px dashed ${T.border}`,
                  background: "transparent", fontSize: 11, color: T.textLight, cursor: "pointer",
                  fontFamily: T.fontBody, transition: "all 0.15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.textMid; e.currentTarget.style.color = T.textMid; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textLight; }}
                >{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          padding: "14px 18px", display: "flex", justifyContent: "flex-end", gap: 10, borderTop: `1px solid ${T.border}`,
          animation: revealing ? "cardEnter 0.2s ease 0.16s both" : "none",
        }}>
          <button onClick={onCancel} style={{
            padding: "10px 22px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
            background: T.white, color: T.textMid, fontWeight: 600, fontSize: 13, cursor: "pointer",
            fontFamily: T.fontBody, boxShadow: T.shadow1
          }}>Cancel</button>
          <button onClick={() => onSave(front, back, tags)} style={{
            padding: "10px 26px", borderRadius: T.radius, border: "none",
            background: T.done, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
            fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(58,125,92,0.3)", transition: "all 0.15s"
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2e6349"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.done; e.currentTarget.style.transform = ""; }}
          >{saveLabel}</button>
        </div>
        </div>
      </div>
    </div>
  );
}
