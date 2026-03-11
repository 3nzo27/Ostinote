import { useState, useRef, useEffect } from 'react';
import './DrawingCanvas.css';

const COLORS = ['#1a1a2e', '#e94560', '#0f3460', '#16c79a', '#f5a623', '#8b5cf6', '#ec4899'];

export default function DrawingCanvas({ dataUrl, onChange, width = 540, height = 260 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [color, setColor] = useState('#1a1a2e');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (dataUrl) {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0); };
      img.src = dataUrl;
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }, [dataUrl, width, height]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) * (width / rect.width),
      y: (touch.clientY - rect.top) * (height / rect.height),
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (drawing.current) {
      drawing.current = false;
      onChange(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    onChange(null);
  };

  return (
    <div className="drawing-canvas">
      <div className="drawing-canvas__toolbar">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool('pen'); }}
            className={`drawing-canvas__swatch ${color === c && tool === 'pen' ? 'drawing-canvas__swatch--active' : ''}`}
            style={{
              background: c,
              boxShadow: color === c && tool === 'pen' ? `0 0 0 2px ${c}` : 'none',
            }}
          />
        ))}
        <div className="drawing-canvas__divider" />
        <button
          onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
          className={`drawing-canvas__eraser-btn ${tool === 'eraser' ? 'drawing-canvas__eraser-btn--active' : ''}`}
        >
          {tool === 'eraser' ? '✏ Pen' : '⌫ Eraser'}
        </button>
        <input
          type="range"
          min="1"
          max="12"
          value={brushSize}
          onChange={e => setBrushSize(+e.target.value)}
          className="drawing-canvas__size-slider"
          style={{ accentColor: color }}
        />
        <button onClick={clearCanvas} className="drawing-canvas__clear-btn">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        className="drawing-canvas__canvas"
        style={{ aspectRatio: `${width}/${height}` }}
      />
    </div>
  );
}
