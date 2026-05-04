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
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [imageOverlay, setImageOverlay] = useState(null);
  const dragCounter = useRef(0);
  const flipTimer = useRef(null);
  const dropErrorTimer = useRef(null);
  const fileInputRef = useRef(null);

  const CANVAS_W = 540;
  const CANVAS_H = 340;

  const isSideEmpty = (s) => !s.text?.trim() && !s.drawing && !s.audio;
  const frontEmpty = isSideEmpty(front);
  const backEmpty = isSideEmpty(back);

  const handleSaveClick = () => {
    if (frontEmpty || backEmpty) {
      setShowEmptyConfirm(true);
    } else {
      onSave(front, back, tags);
    }
  };

  const handleConfirmEmptySave = () => {
    setShowEmptyConfirm(false);
    onSave(front, back, tags);
  };

  const handleGoBackToEdit = () => {
    setShowEmptyConfirm(false);
    // Auto-flip to the empty side so user can fix it
    if (frontEmpty && activeSide !== "front") handleFlip("front");
    else if (backEmpty && activeSide !== "back") handleFlip("back");
  };
  const side = activeSide === "front" ? front : back;
  const setSide = activeSide === "front" ? setFront : setBack;
  const tabs = [{ id: "text", label: "Text" }, { id: "draw", label: "Draw" }, { id: "audio", label: "Audio" }];

  // Read an image file and return overlay state (centered, ~70% of canvas)
  const processImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const targetScale = 0.7;
        const fitScale = Math.min(
          (CANVAS_W * targetScale) / img.width,
          (CANVAS_H * targetScale) / img.height,
          1
        );
        const width = Math.max(40, Math.round(img.width * fitScale));
        const height = Math.max(40, Math.round(img.height * fitScale));
        const x = Math.round((CANVAS_W - width) / 2);
        const y = Math.round((CANVAS_H - height) / 2);
        resolve({
          src: reader.result,
          x, y, width, height,
          naturalWidth: img.width,
          naturalHeight: img.height,
        });
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

  // Bake the overlay image onto the existing drawing canvas
  // No background fill — keep transparency so canvas's CSS background shows through (theme-aware)
  const commitImageOverlay = () => {
    if (!imageOverlay) return;
    const { src, x, y, width, height } = imageOverlay;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d");

      const finishDrawing = () => {
        ctx.drawImage(img, x, y, width, height);
        // PNG preserves transparency so theme background shows correctly
        setSide(prev => ({ ...prev, drawing: canvas.toDataURL("image/png") }));
        setImageOverlay(null);
      };
      if (side.drawing) {
        const existing = new Image();
        existing.onload = () => {
          ctx.drawImage(existing, 0, 0, CANVAS_W, CANVAS_H);
          finishDrawing();
        };
        existing.onerror = finishDrawing;
        existing.src = side.drawing;
      } else {
        finishDrawing();
      }
    };
    img.onerror = () => showDropError("Could not place image");
    img.src = src;
  };

  const cancelImageOverlay = () => setImageOverlay(null);

  const processAudio = (file) => new Promise((resolve, reject) => {
    // 2MB cap so Firestore docs stay reasonable
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error("Audio file too large (max 2MB)"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read audio"));
    reader.readAsDataURL(file);
  });

  const showDropError = (msg) => {
    setDropError(msg);
    clearTimeout(dropErrorTimer.current);
    dropErrorTimer.current = setTimeout(() => setDropError(null), 3000);
  };

  const handleFiles = async (files) => {
    if (!files || !files.length) return;
    const file = files[0];
    try {
      if (file.type.startsWith("image/")) {
        const overlay = await processImage(file);
        setActiveTab("draw");
        setImageOverlay(overlay);
      } else if (file.type.startsWith("audio/")) {
        const dataUrl = await processAudio(file);
        setSide(prev => ({ ...prev, audio: dataUrl }));
        setActiveTab("audio");
      } else {
        showDropError("Only image or audio files are supported");
      }
    } catch (err) {
      showDropError(err.message || "Could not process file");
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes("Files")) {
      dragCounter.current++;
      setDragOver(true);
    }
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOver(false);
    }
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

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
    <div
      style={{ perspective: 900, width: "100%", boxSizing: "border-box", position: "relative" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{
        transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s ease",
        transformStyle: "preserve-3d",
        transform: `rotateY(${flipAngle}deg)`,
        background: T.card, borderRadius: T.radiusLg,
        border: `1px solid ${dragOver ? T.good : T.borderStrong}`,
        boxShadow: dragOver
          ? `0 0 0 3px ${T.good}33, ${T.shadow3}`
          : T.shadow2,
        overflow: "hidden", width: "100%", boxSizing: "border-box",
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload image or audio file"
            style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              background: T.cardAlt, border: `1px solid ${T.border}`,
              fontSize: 11, fontWeight: 600, color: T.textMid, fontFamily: T.fontBody,
              letterSpacing: 0.2, cursor: "pointer", transition: "all 0.15s"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = T.borderStrong;
              e.currentTarget.style.color = T.text;
              e.currentTarget.style.background = T.bgSub;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.textMid;
              e.currentTarget.style.background = T.cardAlt;
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            style={{ display: "none" }}
            onChange={e => {
              const files = e.target.files;
              if (files && files.length) handleFiles(files);
              e.target.value = "";  // reset so re-uploading the same file re-fires onChange
            }}
          />
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
          {activeTab === "draw" && (
            <div>
              <DrawingCanvas
                dataUrl={side.drawing}
                onChange={d => setSide({ ...side, drawing: d })}
                drawingDisabled={!!imageOverlay}
              >
                {imageOverlay && (
                  <ImageOverlay
                    overlay={imageOverlay}
                    onChange={setImageOverlay}
                    onCommit={commitImageOverlay}
                    onCancel={cancelImageOverlay}
                    canvasW={CANVAS_W}
                    canvasH={CANVAS_H}
                    T={T}
                  />
                )}
              </DrawingCanvas>
              {!side.drawing && !imageOverlay && (
                <div style={{
                  fontSize: 11, color: T.textLight, fontFamily: T.fontBody,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10
                }}>
                  <span style={{ width: 16, height: 1, background: T.border }} />
                  or drop an image file anywhere
                  <span style={{ width: 16, height: 1, background: T.border }} />
                </div>
              )}
              {imageOverlay && (
                <div style={{
                  fontSize: 11, color: T.textMid, fontFamily: T.fontBody,
                  textAlign: "center", marginTop: 10
                }}>
                  Drag corners to resize · Drag image to reposition · Click <strong>Place</strong> when ready
                </div>
              )}
            </div>
          )}
          {activeTab === "audio" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: T.due, opacity: 0.3 }} />
              </div>
              <AudioRecorder audioUrl={side.audio} onChange={a => setSide({ ...side, audio: a })} />
              {!side.audio && (
                <div style={{
                  fontSize: 11, color: T.textLight, fontFamily: T.fontBody,
                  display: "flex", alignItems: "center", gap: 6, marginTop: 4
                }}>
                  <span style={{ width: 16, height: 1, background: T.border }} />
                  or drop an audio file anywhere
                  <span style={{ width: 16, height: 1, background: T.border }} />
                </div>
              )}
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
          <button onClick={handleSaveClick} style={{
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

      {/* Drag-over overlay */}
      {dragOver && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: T.radiusLg,
          background: `${T.text}b3`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 14, pointerEvents: "none",
          animation: "fadeIn 0.15s ease",
          zIndex: 10
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: T.card, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: T.shadow2
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.good} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.card, fontFamily: T.fontBody, textAlign: "center" }}>
            Drop image or audio file
          </div>
          <div style={{ fontSize: 12, color: `${T.card}b0`, fontFamily: T.fontBody, textAlign: "center" }}>
            Adds to <strong>{activeSide}</strong> side
          </div>
        </div>
      )}

      {/* Drop error toast */}
      {dropError && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          background: T.due, color: "#fff", padding: "8px 16px", borderRadius: T.radius,
          fontSize: 12, fontWeight: 500, fontFamily: T.fontBody,
          boxShadow: T.shadow2, animation: "fadeIn 0.2s ease", zIndex: 11,
          whiteSpace: "nowrap"
        }}>{dropError}</div>
      )}

      {/* Empty side confirmation modal */}
      {showEmptyConfirm && (() => {
        const bothEmpty = frontEmpty && backEmpty;
        const emptySideLabel = frontEmpty && backEmpty
          ? "Both sides"
          : frontEmpty ? "The front side" : "The back side";
        const title = bothEmpty ? "Both sides are empty" : "One side is empty";
        const warningColor = T.hard || "#c47f2a";
        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: T.modalOverlay, backdropFilter: "blur(2px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16, animation: "fadeIn 0.15s ease"
            }}
            onClick={handleGoBackToEdit}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="empty-confirm-title"
              aria-describedby="empty-confirm-body"
              onClick={e => e.stopPropagation()}
              style={{
                background: T.card, borderRadius: T.radiusLg,
                border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow3,
                padding: "28px 24px", maxWidth: 380, width: "100%",
                textAlign: "center"
              }}
            >
              {/* Warning icon */}
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: `${warningColor}1a`, color: warningColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px auto"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              <div id="empty-confirm-title" style={{
                fontSize: 16, fontWeight: 700, color: T.text,
                fontFamily: T.fontBody, marginBottom: 8
              }}>
                {title}
              </div>

              <p id="empty-confirm-body" style={{
                fontSize: 13, color: T.textMid, fontFamily: T.fontBody,
                lineHeight: 1.55, marginBottom: 22
              }}>
                {bothEmpty
                  ? "Your card has no text, drawing, or audio on either side. Are you sure you want to save it?"
                  : `${emptySideLabel} has no text, drawing, or audio. Cards usually have content on both sides. Are you sure you want to save?`}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={handleGoBackToEdit}
                  autoFocus
                  style={{
                    padding: "11px 20px", borderRadius: T.radius, border: "none",
                    background: T.text, color: T.card,
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                    fontFamily: T.fontBody, transition: "all 0.15s",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
                >
                  Go Back & Edit
                </button>
                <button
                  onClick={handleConfirmEmptySave}
                  style={{
                    padding: "9px 20px", borderRadius: T.radius,
                    border: "none", background: "transparent",
                    color: T.textMid, fontWeight: 500, fontSize: 13,
                    cursor: "pointer", fontFamily: T.fontBody,
                    transition: "color 0.15s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.textMid; }}
                >
                  Save Anyway
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Resizable / draggable image overlay rendered inside DrawingCanvas
function ImageOverlay({ overlay, onChange, onCommit, onCancel, canvasW, canvasH, T }) {
  const aspect = overlay.naturalWidth / overlay.naturalHeight;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const startDrag = (e, mode, handle) => {
    e.preventDefault();
    e.stopPropagation();
    // Get the parent canvas wrapper for coordinate conversion
    const wrapperEl = e.currentTarget.closest('[data-canvas-wrapper]') || e.currentTarget.parentElement?.parentElement;
    const rect = wrapperEl.getBoundingClientRect();
    const cssToCanvas = canvasW / rect.width;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height };

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) * cssToCanvas;
      const dy = (ev.clientY - startY) * cssToCanvas;
      if (mode === "move") {
        onChange({
          ...overlay,
          x: clamp(start.x + dx, 0, canvasW - start.width),
          y: clamp(start.y + dy, 0, canvasH - start.height),
        });
      } else if (mode === "resize") {
        const MIN = 30;
        let newX = start.x, newY = start.y, newW = start.width, newH = start.height;
        // Determine target width based on the handle direction
        if (handle === "br") {
          newW = clamp(start.width + dx, MIN, canvasW - start.x);
          newH = newW / aspect;
          if (newY + newH > canvasH) { newH = canvasH - newY; newW = newH * aspect; }
        } else if (handle === "tl") {
          newW = clamp(start.width - dx, MIN, start.x + start.width);
          newH = newW / aspect;
          newX = start.x + start.width - newW;
          newY = start.y + start.height - newH;
          if (newY < 0) { newY = 0; newH = start.y + start.height; newW = newH * aspect; newX = start.x + start.width - newW; }
        } else if (handle === "tr") {
          newW = clamp(start.width + dx, MIN, canvasW - start.x);
          newH = newW / aspect;
          newY = start.y + start.height - newH;
          if (newY < 0) { newY = 0; newH = start.y + start.height; newW = newH * aspect; }
        } else if (handle === "bl") {
          newW = clamp(start.width - dx, MIN, start.x + start.width);
          newH = newW / aspect;
          newX = start.x + start.width - newW;
          if (newY + newH > canvasH) { newH = canvasH - newY; newW = newH * aspect; newX = start.x + start.width - newW; }
        }
        onChange({ ...overlay, x: newX, y: newY, width: newW, height: newH });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const xPct = (overlay.x / canvasW) * 100;
  const yPct = (overlay.y / canvasH) * 100;
  const wPct = (overlay.width / canvasW) * 100;
  const hPct = (overlay.height / canvasH) * 100;

  const handles = [
    { id: "tl", style: { top: -7, left: -7, cursor: "nwse-resize" } },
    { id: "tr", style: { top: -7, right: -7, cursor: "nesw-resize" } },
    { id: "bl", style: { bottom: -7, left: -7, cursor: "nesw-resize" } },
    { id: "br", style: { bottom: -7, right: -7, cursor: "nwse-resize" } },
  ];

  return (
    <>
      {/* Wrapper marker so children can find the canvas-area parent for coords */}
      <div data-canvas-wrapper style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }} />

      {/* Image preview */}
      <div
        onPointerDown={e => startDrag(e, "move")}
        style={{
          position: "absolute",
          left: `${xPct}%`, top: `${yPct}%`,
          width: `${wPct}%`, height: `${hPct}%`,
          cursor: "move",
          outline: `2px dashed ${T.good}`,
          outlineOffset: 0,
          zIndex: 5, userSelect: "none", touchAction: "none",
          background: "rgba(255,255,255,0.4)"
        }}
      >
        <img
          src={overlay.src}
          alt=""
          draggable={false}
          style={{
            width: "100%", height: "100%", display: "block",
            pointerEvents: "none", objectFit: "fill"
          }}
        />
        {handles.map(h => (
          <div
            key={h.id}
            onPointerDown={e => startDrag(e, "resize", h.id)}
            style={{
              position: "absolute",
              ...h.style,
              width: 14, height: 14, borderRadius: "50%",
              background: T.card, border: `2px solid ${T.good}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              touchAction: "none", zIndex: 6
            }}
          />
        ))}
      </div>

      {/* Floating action toolbar */}
      <div style={{
        position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 8, zIndex: 7,
        background: T.card, border: `1px solid ${T.borderStrong}`,
        borderRadius: 999, boxShadow: T.shadow2,
        padding: "5px 6px"
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 14px", borderRadius: 999, border: "none",
            background: "transparent", color: T.textMid,
            fontSize: 12, fontWeight: 500, cursor: "pointer",
            fontFamily: T.fontBody
          }}
        >Cancel</button>
        <button
          onClick={onCommit}
          style={{
            padding: "6px 16px", borderRadius: 999, border: "none",
            background: T.good, color: "#fff",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: T.fontBody, boxShadow: "0 1px 4px rgba(58,125,92,0.35)"
          }}
        >Place</button>
      </div>
    </>
  );
}
