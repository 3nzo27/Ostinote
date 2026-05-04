import { useState, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";
import HoverMenu from "./HoverMenu.jsx";

export default function DrawingCanvas({ dataUrl, onChange, width = 540, height = 340, children, drawingDisabled = false }) {
  const { T } = useTheme();
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const startPos = useRef(null);
  const history = useRef([]);
  const redoStack = useRef([]);
  const [color, setColor] = useState("#2c2a25");
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState("pen");
  const [opacity, setOpacity] = useState(1);
  const [customColor, setCustomColor] = useState("#2c2a25");

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    if (dataUrl) {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0); };
      img.src = dataUrl;
    } else { ctx.clearRect(0, 0, width, height); }
  }, [dataUrl, width, height]);

  const saveState = () => {
    history.current.push(canvasRef.current.toDataURL());
    if (history.current.length > 30) history.current.shift();
    redoStack.current = [];
  };

  const undo = () => {
    if (history.current.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    redoStack.current.push(canvasRef.current.toDataURL());
    const prev = history.current.pop();
    const img = new Image();
    img.onload = () => { ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0); onChange(canvasRef.current.toDataURL()); };
    img.src = prev;
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    history.current.push(canvasRef.current.toDataURL());
    const next = redoStack.current.pop();
    const img = new Image();
    img.onload = () => { ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0); onChange(canvasRef.current.toDataURL()); };
    img.src = next;
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - rect.left) * (width / rect.width), y: (t.clientY - rect.top) * (height / rect.height) };
  };

  const isShapeTool = tool === "line" || tool === "rect" || tool === "circle";

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    startPos.current = pos;
    if (tool === "fill") {
      saveState();
      floodFill(Math.round(pos.x), Math.round(pos.y));
      drawing.current = false;
      onChange(canvasRef.current.toDataURL());
      return;
    }
    if (!isShapeTool) saveState();
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);

    if (isShapeTool) {
      const octx = overlayRef.current.getContext("2d");
      octx.clearRect(0, 0, width, height);
      octx.strokeStyle = color;
      octx.lineWidth = brushSize;
      octx.lineCap = "round";
      octx.lineJoin = "round";
      octx.globalAlpha = opacity;
      octx.beginPath();
      if (tool === "line") {
        octx.moveTo(startPos.current.x, startPos.current.y);
        octx.lineTo(pos.x, pos.y);
      } else if (tool === "rect") {
        octx.rect(startPos.current.x, startPos.current.y, pos.x - startPos.current.x, pos.y - startPos.current.y);
      } else if (tool === "circle") {
        const rx = Math.abs(pos.x - startPos.current.x) / 2;
        const ry = Math.abs(pos.y - startPos.current.y) / 2;
        const cx = startPos.current.x + (pos.x - startPos.current.x) / 2;
        const cy = startPos.current.y + (pos.y - startPos.current.y) / 2;
        octx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      }
      octx.stroke();
      octx.globalAlpha = 1;
    } else {
      const ctx = canvasRef.current.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = brushSize * 4;
      } else if (tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize * 3;
        ctx.globalAlpha = 0.25;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.globalAlpha = opacity;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      lastPos.current = pos;
    }
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;

    if (isShapeTool) {
      saveState();
      const octx = overlayRef.current.getContext("2d");
      const ctx = canvasRef.current.getContext("2d");
      ctx.drawImage(overlayRef.current, 0, 0);
      octx.clearRect(0, 0, width, height);
    }
    onChange(canvasRef.current.toDataURL());
  };

  const floodFill = (sx, sy) => {
    const ctx = canvasRef.current.getContext("2d");
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const idx = (y, x) => (y * width + x) * 4;
    const target = [data[idx(sy, sx)], data[idx(sy, sx) + 1], data[idx(sy, sx) + 2], data[idx(sy, sx) + 3]];
    const hex = color.replace("#", "");
    const fill = [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16), Math.round(opacity * 255)];
    if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3]) return;
    const match = (i) => Math.abs(data[i] - target[0]) < 20 && Math.abs(data[i + 1] - target[1]) < 20 && Math.abs(data[i + 2] - target[2]) < 20 && Math.abs(data[i + 3] - target[3]) < 20;
    const stack = [[sx, sy]];
    const visited = new Set();
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const i = idx(y, x);
      const key = y * width + x;
      if (x < 0 || x >= width || y < 0 || y >= height || visited.has(key) || !match(i)) continue;
      visited.add(key);
      data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3];
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const clearCanvas = () => {
    saveState();
    canvasRef.current.getContext("2d").clearRect(0, 0, width, height);
    onChange(null);
  };

  const colors = ["#2c2a25", "#ffffff", "#5a4a3a", "#c4432a", "#c47f2a", "#3a7d5c", "#4a6fa5", "#7c5cbf", "#d4708f", "#8b6b4a"];

  const tools = [
    { id: "pen", label: "Pen" },
    { id: "highlighter", label: "Highlight" },
    { id: "eraser", label: "Eraser" },
    { id: "line", label: "Line" },
    { id: "rect", label: "Rect" },
    { id: "circle", label: "Circle" },
    { id: "fill", label: "Fill" },
  ];

  const cursorStyle = tool === "eraser" ? "cell" : tool === "fill" ? "crosshair" : isShapeTool ? "crosshair" : "crosshair";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box", overflow: "visible" }}>
      {/* Compact toolbar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>

        {/* Tools dropdown */}
        <HoverMenu
          label={tools.find(t => t.id === tool)?.label || "Pen"}
          preview={null}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {tools.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} style={{
                padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, textAlign: "left",
                background: tool === t.id ? T.bgSub : "transparent",
                color: tool === t.id ? T.text : T.textMid,
                transition: "all 0.1s", width: "100%"
              }}
                onMouseEnter={e => { if (tool !== t.id) e.currentTarget.style.background = T.bgSub; }}
                onMouseLeave={e => { if (tool !== t.id) e.currentTarget.style.background = "transparent"; }}
              >{t.label}</button>
            ))}
          </div>
        </HoverMenu>

        {/* Colors dropdown */}
        <HoverMenu
          label="Color"
          preview={<div style={{ width: 14, height: 14, borderRadius: "50%", background: color, border: `1.5px solid ${T.border}`, flexShrink: 0 }} />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 28px)", gap: 5, justifyContent: "center" }}>
              {colors.map(c => (
                <button key={c} onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }} style={{
                  width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                  border: color === c ? `2.5px solid ${T.bgSub}` : `2px solid ${T.border}`,
                  boxShadow: color === c ? `0 0 0 2px ${c === "#ffffff" ? T.textLight : c}` : "none",
                  transition: "all 0.15s"
                }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontBody }}>Custom</span>
              <input type="color" value={customColor}
                onChange={e => { setCustomColor(e.target.value); setColor(e.target.value); if (tool === "eraser") setTool("pen"); }}
                style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4, background: "none" }} />
            </div>
          </div>
        </HoverMenu>

        {/* Brush settings dropdown */}
        <HoverMenu
          label={`${brushSize}px`}
          preview={<div style={{
            width: Math.max(Math.min(brushSize, 14), 5), height: Math.max(Math.min(brushSize, 14), 5),
            borderRadius: "50%", background: tool === "eraser" ? T.textLight : color,
            opacity: tool === "highlighter" ? 0.3 : opacity,
            border: `1px solid ${T.border}`, flexShrink: 0, transition: "all 0.15s"
          }} />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontBody, fontWeight: 500, minWidth: 44 }}>Size</span>
              <input type="range" min="1" max="20" value={brushSize} onChange={e => setBrushSize(+e.target.value)}
                style={{ flex: 1, accentColor: T.textMid }} />
              <span style={{ fontSize: 12, color: T.text, fontFamily: T.fontBody, fontWeight: 600, minWidth: 24, textAlign: "right" }}>{brushSize}</span>
            </div>
            {tool !== "eraser" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontBody, fontWeight: 500, minWidth: 44 }}>Opacity</span>
                <input type="range" min="10" max="100" value={Math.round(opacity * 100)} onChange={e => setOpacity(e.target.value / 100)}
                  style={{ flex: 1, accentColor: T.textMid }} />
                <span style={{ fontSize: 12, color: T.text, fontFamily: T.fontBody, fontWeight: 600, minWidth: 30, textAlign: "right" }}>{Math.round(opacity * 100)}%</span>
              </div>
            )}
            {/* Size presets */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {[1, 3, 6, 10, 16].map(s => (
                <button key={s} onClick={() => setBrushSize(s)} style={{
                  width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${brushSize === s ? T.text : T.border}`,
                  background: brushSize === s ? T.bgSub : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <div style={{
                    width: Math.max(s * 0.8, 3), height: Math.max(s * 0.8, 3),
                    borderRadius: "50%", background: T.text
                  }} />
                </button>
              ))}
            </div>
          </div>
        </HoverMenu>

        <div style={{ width: 1, height: 20, background: T.border, flexShrink: 0 }} />

        {/* Undo / Redo / Clear */}
        <button onClick={undo} title="Undo" style={{
          padding: "5px 8px", borderRadius: 6, border: `1.5px solid ${T.border}`, background: T.white,
          cursor: "pointer", fontSize: 12, color: T.textMid, fontFamily: T.fontBody
        }}>&#8617;</button>
        <button onClick={redo} title="Redo" style={{
          padding: "5px 8px", borderRadius: 6, border: `1.5px solid ${T.border}`, background: T.white,
          cursor: "pointer", fontSize: 12, color: T.textMid, fontFamily: T.fontBody
        }}>&#8618;</button>
        <button onClick={clearCanvas} style={{
          padding: "5px 9px", borderRadius: 6, border: `1.5px solid ${T.border}`, background: T.white,
          cursor: "pointer", fontSize: 11, color: T.textMid, fontFamily: T.fontBody, fontWeight: 600
        }}>Clear</button>
      </div>

      {/* Canvas area */}
      <div style={{ position: "relative", width: "100%", borderRadius: T.radius, overflow: "hidden", border: `1.5px solid ${T.border}` }}>
        <canvas ref={canvasRef} width={width} height={height}
          onMouseDown={drawingDisabled ? undefined : startDraw}
          onMouseMove={drawingDisabled ? undefined : draw}
          onMouseUp={drawingDisabled ? undefined : endDraw}
          onMouseLeave={drawingDisabled ? undefined : endDraw}
          onTouchStart={drawingDisabled ? undefined : startDraw}
          onTouchMove={drawingDisabled ? undefined : draw}
          onTouchEnd={drawingDisabled ? undefined : endDraw}
          style={{
            width: "100%", height: "auto", aspectRatio: `${width}/${height}`,
            background: T.canvasBg, cursor: drawingDisabled ? "default" : cursorStyle, touchAction: "none",
            boxSizing: "border-box", display: "block",
            pointerEvents: drawingDisabled ? "none" : "auto"
          }} />
        <canvas ref={overlayRef} width={width} height={height}
          onMouseDown={drawingDisabled ? undefined : startDraw}
          onMouseMove={drawingDisabled ? undefined : draw}
          onMouseUp={drawingDisabled ? undefined : endDraw}
          onMouseLeave={drawingDisabled ? undefined : endDraw}
          onTouchStart={drawingDisabled ? undefined : startDraw}
          onTouchMove={drawingDisabled ? undefined : draw}
          onTouchEnd={drawingDisabled ? undefined : endDraw}
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            cursor: drawingDisabled ? "default" : cursorStyle, touchAction: "none",
            pointerEvents: drawingDisabled ? "none" : (isShapeTool ? "auto" : "none")
          }} />
        {children}
      </div>
    </div>
  );
}
