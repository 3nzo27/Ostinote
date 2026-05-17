import { useState, useEffect, useRef, useCallback, memo } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import useTheme from "../../theme/useTheme.js";

const DEFAULT_SCALE = 1.4;
const BUFFER_PAGES = 2;
const MAX_DPR = 2;
const PAGE_GAP = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 80;

const scheduleIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
const cancelIdle = window.cancelIdleCallback || clearTimeout;

export default function PdfViewer({ buffer, highlights, onHighlight, onScrollProgress }) {
  const { T } = useTheme();
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [error, setError] = useState(null);
  const [baseSize, setBaseSize] = useState(null);
  const [visibleRange, setVisibleRange] = useState([1, 1]);
  const rafId = useRef(0);

  const numPages = pdfDoc?.numPages || 0;
  const pageW = baseSize ? Math.floor(baseSize.width * scale) : 0;
  const pageH = baseSize ? Math.floor(baseSize.height * scale) : 0;
  const rowH = pageH + PAGE_GAP;
  const totalHeight = numPages > 0
    ? PAD_TOP + numPages * pageH + (numPages - 1) * PAGE_GAP + PAD_BOTTOM
    : 0;

  useEffect(() => {
    if (!buffer) return;
    let cancelled = false;
    pdfjsLib.getDocument({ data: buffer.slice(0) }).promise.then(doc => {
      if (cancelled) return;
      setPdfDoc(doc);
    }).catch(err => {
      if (!cancelled) setError(err.message || "Failed to load PDF");
    });
    return () => {
      cancelled = true;
      if (pdfDoc) pdfDoc.destroy();
    };
  }, [buffer]);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    pdfDoc.getPage(1).then(page => {
      if (cancelled) return;
      const vp = page.getViewport({ scale: 1 });
      setBaseSize({ width: vp.width, height: vp.height });
    });
    return () => { cancelled = true; };
  }, [pdfDoc]);

  const recomputeRange = useCallback(() => {
    const el = containerRef.current;
    if (!el || !rowH || !numPages) return;
    const top = el.scrollTop;
    const h = el.clientHeight;
    const s = Math.max(1, Math.floor((top - PAD_TOP) / rowH) + 1 - BUFFER_PAGES);
    const e = Math.min(numPages, Math.ceil((top + h - PAD_TOP) / rowH) + BUFFER_PAGES);
    setVisibleRange(prev => (prev[0] === s && prev[1] === e) ? prev : [s, e]);
    if (onScrollProgress) {
      const max = el.scrollHeight - el.clientHeight;
      onScrollProgress(max > 0 ? Math.min(top / max, 1) : 0);
    }
  }, [rowH, numPages, onScrollProgress]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(recomputeRange);
    };
    el.addEventListener("scroll", handler, { passive: true });
    recomputeRange();
    return () => { el.removeEventListener("scroll", handler); cancelAnimationFrame(rafId.current); };
  }, [recomputeRange]);

  useEffect(() => { recomputeRange(); }, [scale, baseSize, recomputeRange]);

  const handleTextSelect = useCallback(() => {
    if (!onHighlight) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 4) return;
    if (!containerRef.current?.contains(sel.anchorNode)) return;
    let pageNum = null;
    let node = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
    while (node && node !== containerRef.current) {
      if (node.dataset?.pageNumber) { pageNum = parseInt(node.dataset.pageNumber, 10); break; }
      node = node.parentElement;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    onHighlight({ text, page: pageNum, x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, [onHighlight]);

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelect);
    return () => document.removeEventListener("mouseup", handleTextSelect);
  }, [handleTextSelect]);

  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.6));

  if (error) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: T.due, fontSize: 13, fontFamily: T.fontBody, padding: 32,
      }}>
        Failed to load PDF: {error}
      </div>
    );
  }

  const pages = [];
  if (pdfDoc && pageH) {
    for (let p = visibleRange[0]; p <= visibleRange[1]; p++) {
      pages.push(
        <PageCanvas
          key={p}
          pdfDoc={pdfDoc}
          pageNum={p}
          scale={scale}
          T={T}
          top={PAD_TOP + (p - 1) * rowH}
          width={pageW}
          height={pageH}
        />
      );
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, padding: "6px 12px", flexShrink: 0,
        borderBottom: `1px solid ${T.border}`, background: T.card,
      }}>
        <ZoomBtn T={T} onClick={zoomOut} label="Zoom out">−</ZoomBtn>
        <span style={{
          fontSize: 11, fontWeight: 600, color: T.textMid, fontFamily: T.fontBody,
          minWidth: 44, textAlign: "center",
        }}>{Math.round(scale * 100)}%</span>
        <ZoomBtn T={T} onClick={zoomIn} label="Zoom in">+</ZoomBtn>
      </div>

      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: "auto", overflowX: "auto", background: T.bgSub, minHeight: 0 }}
      >
        <div style={{
          position: "relative",
          height: totalHeight,
          minWidth: pageW ? pageW + 32 : "auto",
        }}>
          {pages}
        </div>
      </div>
    </div>
  );
}

function ZoomBtn({ T, onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 28, height: 28, borderRadius: 6,
        border: `1.5px solid ${T.border}`, background: T.card,
        color: T.textMid, fontSize: 15, fontWeight: 600,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "border-color 0.12s, color 0.12s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
    >{children}</button>
  );
}

const PageCanvas = memo(function PageCanvas({ pdfDoc, pageNum, scale, T, top, width, height }) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const taskRef = useRef(null);
  const idleRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let page = null;

    (async () => {
      page = await pdfDoc.getPage(pageNum);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext("2d");

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (taskRef.current) try { taskRef.current.cancel(); } catch {}
      const task = page.render({ canvasContext: ctx, viewport });
      taskRef.current = task;
      try { await task.promise; } catch (e) {
        if (e?.name === "RenderingCancelledException") return;
        return;
      }
      if (cancelled) return;
      taskRef.current = null;

      // Defer text layer to idle time so it never blocks scrolling
      idleRef.current = scheduleIdle(() => {
        if (cancelled) return;
        const tlDiv = textRef.current;
        if (!tlDiv) return;
        tlDiv.innerHTML = "";
        tlDiv.style.width = `${viewport.width}px`;
        tlDiv.style.height = `${viewport.height}px`;
        const builder = new TextLayerBuilder({ pdfPage: page });
        tlDiv.appendChild(builder.div);
        builder.render({ viewport });
      }, { timeout: 500 });
    })();

    return () => {
      cancelled = true;
      cancelIdle(idleRef.current);
      if (taskRef.current) try { taskRef.current.cancel(); } catch {}
      taskRef.current = null;
      const c = canvasRef.current;
      if (c) { c.width = 1; c.height = 1; }
      const t = textRef.current;
      if (t) t.innerHTML = "";
      if (page) page.cleanup();
    };
  }, [pdfDoc, pageNum, scale]);

  return (
    <div
      data-page-number={pageNum}
      id={`page-${pageNum}`}
      style={{
        position: "absolute", top, left: "50%", transform: "translateX(-50%)",
        width, height,
        boxShadow: T.shadow2, background: "#fff", lineHeight: 0,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <div ref={textRef} style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }} />
      <div style={{
        position: "absolute", bottom: 6, right: 8,
        fontSize: 10, fontWeight: 600, color: T.textLight,
        fontFamily: T.fontBody, opacity: 0.7,
        background: "rgba(255,255,255,0.8)", padding: "1px 6px",
        borderRadius: 4,
      }}>{pageNum}</div>
    </div>
  );
});
