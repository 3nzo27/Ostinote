import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import useTheme from "../../theme/useTheme.js";

// Self-contained worker setup so PdfViewer works even if pdfConverter.js
// (which also registers the worker) hasn't been imported yet.
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const DEFAULT_SCALE = 1.4;
const BUFFER_PAGES = 2;
const MAX_DPR = 2;
const PAGE_GAP = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 80;

const scheduleIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
const cancelIdle = window.cancelIdleCallback || clearTimeout;

// Per-doc scroll + zoom persistence. Lives in localStorage as
//   ostinote_pdf_state_<docId> -> { scrollTop, scale }
// so a refresh / tab switch / view change drops the user back exactly
// where they left off, at the same zoom.
const PDF_STATE_PREFIX = "ostinote_pdf_state_";
function readPdfState(docId) {
  if (!docId) return null;
  try { return JSON.parse(localStorage.getItem(PDF_STATE_PREFIX + docId) || "null"); }
  catch { return null; }
}
function writePdfState(docId, state) {
  if (!docId) return;
  try { localStorage.setItem(PDF_STATE_PREFIX + docId, JSON.stringify(state)); }
  catch {}
}

const PdfViewer = forwardRef(function PdfViewer({ buffer, docId, highlights, onHighlight, onScrollProgress }, ref) {
  const { T } = useTheme();
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [scale, setScale] = useState(() => {
    const saved = readPdfState(docId);
    return saved?.scale || DEFAULT_SCALE;
  });
  const [error, setError] = useState(null);
  const [baseSize, setBaseSize] = useState(null);
  const [visibleRange, setVisibleRange] = useState([1, 1]);
  const rafId = useRef(0);
  // Track which docId we've already restored scroll for so we don't
  // fight the user every time they scroll.
  const restoredForRef = useRef(null);
  // Keep latest scale/docId in refs so the persistent scroll handler
  // can read them without re-attaching every render.
  const scaleRef = useRef(scale);
  const docIdRef = useRef(docId);
  // Snapshot the latest scrollTop on every scroll event. Cleanup-time
  // saves read this instead of containerRef.scrollTop because when
  // WorkspaceView unmounts (navigating to Dashboard/Flashcards) the
  // DOM can already be torn down by the time the cleanup runs.
  const lastScrollRef = useRef(0);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { docIdRef.current = docId; }, [docId]);

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
    // Capture the loaded doc in a local so the cleanup function can
    // actually destroy IT — reading `pdfDoc` from the closure here
    // would always see the stale value (null on first run) and leave
    // the document + all its cached pages leaking on every buffer swap.
    let loadedDoc = null;
    const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
    loadingTask.promise.then(doc => {
      if (cancelled) {
        try { doc.destroy(); } catch {}
        return;
      }
      loadedDoc = doc;
      setPdfDoc(doc);
    }).catch(err => {
      if (!cancelled) setError(err.message || "Failed to load PDF");
    });
    return () => {
      cancelled = true;
      try { loadingTask.destroy(); } catch {}
      if (loadedDoc) {
        try { loadedDoc.destroy(); } catch {}
      }
      setPdfDoc(null);
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

  // When the active docId changes, pick up THAT doc's saved scale.
  useEffect(() => {
    const saved = readPdfState(docId);
    setScale(saved?.scale || DEFAULT_SCALE);
    // Reset restore guard so we restore scroll for the new doc.
    restoredForRef.current = null;
  }, [docId]);

  // Once pdfDoc + baseSize are ready for THIS doc, restore the saved
  // scrollTop exactly once. requestAnimationFrame lets the totalHeight
  // be applied to the DOM first so the scroll actually lands. We also
  // seed lastScrollRef so a save fired before the user's first scroll
  // (e.g. immediately navigating away) doesn't overwrite the saved
  // position with 0.
  useEffect(() => {
    if (!docId || !pdfDoc || !baseSize) return;
    if (restoredForRef.current === docId) return;
    restoredForRef.current = docId;
    const saved = readPdfState(docId);
    if (!saved?.scrollTop) {
      lastScrollRef.current = 0;
      return;
    }
    lastScrollRef.current = saved.scrollTop;
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = saved.scrollTop;
    });
  }, [docId, pdfDoc, baseSize]);

  // Persist scroll position (debounced) + write on unmount. Attached
  // once and reads docId/scale from refs so we don't lose listeners
  // every time scale changes. The handler snapshots scrollTop into a
  // ref synchronously so the unmount-time save can use it even if the
  // DOM is gone by then.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer = 0;
    const save = () => {
      if (docIdRef.current) {
        writePdfState(docIdRef.current, {
          scrollTop: lastScrollRef.current,
          scale: scaleRef.current,
        });
      }
    };
    const handler = () => {
      lastScrollRef.current = el.scrollTop;
      clearTimeout(timer);
      timer = setTimeout(save, 200);
    };
    el.addEventListener("scroll", handler, { passive: true });
    // Save before the page unloads (refresh / close) — covers cases
    // where React doesn't get a clean unmount cycle.
    const onPageHide = () => save();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", handler);
      window.removeEventListener("pagehide", onPageHide);
      save();
    };
  }, []);

  // Also persist immediately when the user zooms — otherwise a refresh
  // right after a zoom would restore the old scale.
  useEffect(() => {
    if (!docId) return;
    writePdfState(docId, { scrollTop: lastScrollRef.current, scale });
  }, [docId, scale]);

  // Expose a seekToPage(n) method so parents can jump from chat citations
  // even if the target page isn't currently inside the virtualized window.
  useImperativeHandle(ref, () => ({
    seekToPage(n) {
      const el = containerRef.current;
      if (!el || !rowH || !n) return;
      const top = PAD_TOP + (n - 1) * rowH;
      el.scrollTo({ top, behavior: "smooth" });
    },
  }), [rowH]);

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
});

export default PdfViewer;

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
  const builderRef = useRef(null);
  const idleRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let page = null;

    (async () => {
      try {
        page = await pdfDoc.getPage(pageNum);
      } catch {
        return; // pdfDoc destroyed mid-fetch — nothing to clean up
      }
      // If we got the page back AFTER the user scrolled away or switched
      // docs, release it immediately rather than leaving it in pdfjs's
      // cache forever.
      if (cancelled) {
        try { page.cleanup(); } catch {}
        page = null;
        return;
      }

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
        builderRef.current = builder;
        tlDiv.appendChild(builder.div);
        builder.render({ viewport });
      }, { timeout: 500 });
    })();

    return () => {
      cancelled = true;
      cancelIdle(idleRef.current);
      if (taskRef.current) try { taskRef.current.cancel(); } catch {}
      taskRef.current = null;
      // Cancel the text-layer builder so its in-flight work + spans
      // get released. Without this, every scroll-induced unmount leaks
      // a chunk of DOM the GC can't reach.
      if (builderRef.current) {
        try { builderRef.current.cancel(); } catch {}
        builderRef.current = null;
      }
      const c = canvasRef.current;
      if (c) { c.width = 1; c.height = 1; }
      const t = textRef.current;
      if (t) t.innerHTML = "";
      if (page) {
        try { page.cleanup(); } catch {}
      }
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
