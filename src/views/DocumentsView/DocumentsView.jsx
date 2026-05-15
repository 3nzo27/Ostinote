import { useState, useEffect, useRef } from "react";
import useTheme from "../../theme/useTheme.js";
import NavBar from "../../components/NavBar/NavBar.jsx";
import {
  listDocuments, saveDocument, deleteDocument, findByHash,
  hashFile, generateId
} from "../../utils/documentStore.js";
import { processFile } from "../../utils/pdfConverter.js";

const MOBILE_BREAKPOINT = 768;

export default function DocumentsView({ aiSettings, onNavigate, onOpenDocument, onHelpOpen }) {
  const { T } = useTheme();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ stage: "", page: 0, total: 0 });
  const [error, setError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileInputRef = useRef(null);

  const containerStyle = {
    maxWidth: 720, margin: "0 auto",
    padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))",
    minHeight: "100vh", fontFamily: T.fontBody, background: T.bg
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setDocs(await listDocuments());
      } catch (err) {
        console.error("Failed to load documents", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasApiKey =
    aiSettings?.provider === "claude-local"
      ? true
      : (!!aiSettings?.apiKey && !aiSettings?.useLocal);

  const handleFiles = async (files) => {
    setError(null);
    if (!files || !files.length) return;
    const file = files[0];

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    if (!hasApiKey) {
      setError("PDF conversion needs a cloud AI provider configured. Open Settings → AI Provider and add an API key.");
      return;
    }

    setUploading(true);
    setProgress({ stage: "start", page: 0, total: 0 });

    try {
      const hash = await hashFile(file);
      // Dedup: if user uploads a PDF we already have, just open it.
      const existing = await findByHash(hash);
      if (existing) {
        setUploading(false);
        onOpenDocument(existing.id);
        return;
      }

      const result = await processFile(file, aiSettings, (p) => setProgress(p));

      const doc = {
        id: generateId(),
        title: result.title,
        markdown: result.markdown,
        pageCount: result.pageCount,
        fileSize: result.fileSize,
        hash,
        uploadedAt: Date.now(),
      };
      await saveDocument(doc);
      setDocs(prev => [doc, ...prev]);
      setUploading(false);
      onOpenDocument(doc.id);
    } catch (err) {
      console.error(err);
      setError(err.message || "Conversion failed");
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteDocument(confirmDeleteId);
    setDocs(docs.filter(d => d.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };

  // -------- Mobile gating --------
  if (isMobile) {
    return (
      <div style={containerStyle}>
        <NavBar view="documents" onNavigate={onNavigate} onHelpOpen={onHelpOpen} />
        <div style={{
          marginTop: 48, padding: "32px 24px", borderRadius: T.radiusLg,
          background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2,
          textAlign: "center"
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: T.bgSub, color: T.textMid,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: T.font, color: T.text, marginBottom: 8 }}>
            Reading on desktop
          </h1>
          <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            The PDF study tool is designed for a larger screen. Open Ostinote on your desktop or laptop to upload and study PDFs. Flashcards work great here on mobile.
          </p>
          <button onClick={() => onNavigate("decks")} style={{
            marginTop: 22, padding: "10px 22px", borderRadius: T.radius, border: "none",
            background: T.accent, color: T.white, fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(44,42,37,0.18)"
          }}>Go to your decks</button>
        </div>
      </div>
    );
  }

  // -------- Desktop --------
  return (
    <div style={containerStyle}>
      <NavBar view="documents" onNavigate={onNavigate} onHelpOpen={onHelpOpen} />

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>
          Read
        </h1>
        <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody }}>
          Upload a PDF — it'll be converted to a clean reading view you can study from.
        </p>
      </div>

      {!hasApiKey && (
        <div style={{
          marginBottom: 18, padding: "12px 16px", borderRadius: T.radius,
          background: `${T.hard || "#c47f2a"}10`, border: `1px solid ${T.hard || "#c47f2a"}30`,
          color: T.text, fontSize: 13, fontFamily: T.fontBody, lineHeight: 1.55
        }}>
          <strong>Cloud AI required.</strong> PDF conversion uses your configured AI provider.{" "}
          <button onClick={() => onNavigate("settings")} style={{
            background: "none", border: "none", padding: 0, color: T.easy,
            cursor: "pointer", textDecoration: "underline", fontFamily: T.fontBody, fontSize: 13
          }}>Open Settings →</button>
        </div>
      )}

      {/* Upload area */}
      <UploadDropzone
        T={T} onFiles={handleFiles} disabled={uploading || !hasApiKey}
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef} type="file" accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Upload progress */}
      {uploading && (
        <div style={{
          marginTop: 16, padding: "14px 16px", borderRadius: T.radius,
          background: T.bgSub, border: `1px solid ${T.border}`, fontFamily: T.fontBody
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.good, animation: "pulse 1.2s ease-in-out infinite" }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
              {progress.stage === "extract" && `Extracting page ${progress.page} of ${progress.total}…`}
              {progress.stage === "convert" && "Converting to readable format with AI…"}
              {progress.stage === "start" && "Reading PDF…"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.textMid }}>
            This takes ~10-30 seconds depending on document size. Pages are cached so you only convert once.
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: T.radius,
          background: T.dueBg, color: T.due, fontSize: 13, fontFamily: T.fontBody, lineHeight: 1.5
        }}>{error}</div>
      )}

      {/* Documents list */}
      {!loading && (
        <div style={{ marginTop: 28 }}>
          {docs.length === 0 ? (
            !uploading && (
              <div style={{
                textAlign: "center", padding: "36px 24px", borderRadius: T.radiusLg,
                background: T.cardAlt, border: `1px dashed ${T.border}`,
                color: T.textMid, fontFamily: T.fontBody, fontSize: 13
              }}>
                No documents yet. Drop a PDF above to get started.
              </div>
            )
          ) : (
            <>
              <div style={{
                fontSize: 11, fontWeight: 600, color: T.textMid,
                fontFamily: T.fontBody, marginBottom: 10,
                textTransform: "uppercase", letterSpacing: 0.5
              }}>
                Your documents
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map(doc => (
                  <DocumentRow
                    key={doc.id} doc={doc} T={T}
                    onOpen={() => onOpenDocument(doc.id)}
                    onDelete={() => setConfirmDeleteId(doc.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: T.modalOverlay, backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          animation: "fadeIn 0.15s ease"
        }} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: T.radiusLg,
            border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow3,
            padding: "26px 24px", maxWidth: 360, width: "100%", textAlign: "center"
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 8 }}>
              Delete this document?
            </div>
            <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5, marginBottom: 20 }}>
              You'll need to upload and convert the PDF again to read it. Any highlights or notes will be lost.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{
                padding: "9px 22px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                background: T.white, color: T.textMid, fontWeight: 500, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody
              }}>Cancel</button>
              <button onClick={confirmDelete} style={{
                padding: "9px 22px", borderRadius: T.radius, border: "none",
                background: T.due, color: "#fff", fontWeight: 600, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody,
                boxShadow: "0 2px 8px rgba(196,67,42,0.3)"
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- subcomponents -----------------------------------------------------

function UploadDropzone({ T, onFiles, onClick, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const counter = useRef(0);

  const enter = (e) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes("Files")) {
      counter.current++;
      setDragOver(true);
    }
  };
  const leave = (e) => {
    e.preventDefault();
    counter.current--;
    if (counter.current <= 0) { counter.current = 0; setDragOver(false); }
  };
  const over = (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
  const drop = (e) => {
    e.preventDefault();
    counter.current = 0;
    setDragOver(false);
    if (!disabled) onFiles(e.dataTransfer.files);
  };

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onDragEnter={enter} onDragLeave={leave} onDragOver={over} onDrop={drop}
      disabled={disabled}
      style={{
        width: "100%", padding: "28px 24px", borderRadius: T.radiusLg,
        background: dragOver ? `${T.good}10` : T.card,
        border: `2px dashed ${dragOver ? T.good : T.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        transition: "all 0.15s", fontFamily: T.fontBody
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: dragOver ? `${T.good}20` : T.bgSub,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={dragOver ? T.good : T.textMid}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
        {dragOver ? "Drop to upload" : "Drop a PDF or click to choose"}
      </div>
      <div style={{ fontSize: 11, color: T.textLight }}>
        Up to ~300 pages · text-only PDFs work best
      </div>
    </button>
  );
}

function DocumentRow({ doc, T, onOpen, onDelete }) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", borderRadius: T.radius,
        background: T.card, border: `1px solid ${T.border}`,
        cursor: "pointer", transition: "all 0.15s",
        fontFamily: T.fontBody
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.boxShadow = T.shadow1; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{
        flexShrink: 0, width: 36, height: 44, borderRadius: 4,
        background: T.bgSub, border: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: T.textMid, fontWeight: 700, fontSize: 9, letterSpacing: 0.5
      }}>PDF</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: T.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>{doc.title}</div>
        <div style={{ fontSize: 11, color: T.textLight, marginTop: 2 }}>
          {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"} · {formatRelative(doc.uploadedAt)}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete document"
        style={{
          background: "none", border: "none", padding: 6, cursor: "pointer",
          color: T.textLight, borderRadius: 6, display: "flex"
        }}
        onMouseEnter={e => e.currentTarget.style.color = T.due}
        onMouseLeave={e => e.currentTarget.style.color = T.textLight}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>
    </div>
  );
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
