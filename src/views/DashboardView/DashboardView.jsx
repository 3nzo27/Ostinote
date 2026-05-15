// Dashboard: the new central hub of Ostinote.
//
// Replaces the previous Home view. Everything orbits around documents:
// you pick what you're studying, then act on it (read, quiz, flashcards).
// Cards-due is surfaced as a compact secondary section so SRS stays
// frictionless without dominating the page.

import { useState, useEffect, useRef } from "react";
import useTheme from "../../theme/useTheme.js";
import NavBar from "../../components/NavBar/NavBar.jsx";
import {
  listDocuments, saveDocument, deleteDocument, findByHash,
  hashFile, generateId, getChat, listHighlights,
} from "../../utils/documentStore.js";
import { processFile } from "../../utils/pdfConverter.js";

const MOBILE_BREAKPOINT = 768;

export default function DashboardView({
  decks, aiSettings, onNavigate, onSelectDeck, onStartStudy,
  onOpenDocument, onHelpOpen
}) {
  const { T } = useTheme();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [docs, setDocs] = useState([]);
  const [docMeta, setDocMeta] = useState({}); // { [docId]: { highlights: n, hasChat: bool } }
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ stage: "", page: 0, total: 0 });
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    (async () => {
      const all = await listDocuments();
      setDocs(all);
      // Load meta in parallel (highlights count + chat presence)
      const meta = {};
      await Promise.all(all.slice(0, 8).map(async d => {
        const [hs, chat] = await Promise.all([
          listHighlights(d.id),
          getChat(d.id),
        ]);
        meta[d.id] = {
          highlights: hs.length,
          chatMessages: chat?.messages?.length || 0,
          lastActivity: Math.max(
            ...hs.map(h => h.createdAt),
            chat?.updatedAt || 0,
            d.uploadedAt
          ),
        };
      }));
      setDocMeta(meta);
      setDocsLoading(false);
    })();
  }, []);

  const containerStyle = {
    maxWidth: 720, margin: "0 auto",
    padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))",
    minHeight: "100vh", fontFamily: T.fontBody, background: T.bg
  };

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  // ---- Stats / state ----
  const totalDue = decks.reduce((sum, d) => sum + d.cards.filter(c => c.nextReview <= Date.now()).length, 0);
  const dueDecks = decks
    .map(d => ({ deck: d, dueCount: d.cards.filter(c => c.nextReview <= Date.now()).length }))
    .filter(x => x.dueCount > 0)
    .sort((a, b) => b.dueCount - a.dueCount);

  const recentDoc = docs[0]; // most-recently uploaded
  const hasApiKey =
    aiSettings?.provider === "claude-local"
      ? true
      : (!!aiSettings?.apiKey && !aiSettings?.useLocal);

  // ---- Upload flow ----
  const handleFiles = async (files) => {
    setUploadError(null);
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    if (!hasApiKey) {
      setUploadError("PDF conversion needs a cloud AI provider configured. Open Settings → AI Provider.");
      return;
    }
    if (isMobile) {
      setUploadError("Uploading PDFs needs a desktop or laptop browser.");
      return;
    }
    setUploading(true);
    try {
      const hash = await hashFile(file);
      const existing = await findByHash(hash);
      if (existing) {
        setUploading(false);
        onOpenDocument(existing.id);
        return;
      }
      const result = await processFile(file, aiSettings, p => setUploadProgress(p));
      const doc = {
        id: generateId(),
        title: result.title,
        markdown: result.markdown,
        pageCount: result.pageCount,
        fileSize: result.fileSize,
        hash, uploadedAt: Date.now(),
      };
      await saveDocument(doc);
      setDocs(prev => [doc, ...prev]);
      setUploading(false);
      onOpenDocument(doc.id);
    } catch (err) {
      setUploadError(err.message || "Conversion failed");
      setUploading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <NavBar view="dashboard" onNavigate={onNavigate} onHelpOpen={onHelpOpen} />

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>
          {greeting}
        </h1>
        {totalDue > 0 ? (
          <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody }}>
            You have {totalDue} card{totalDue !== 1 ? "s" : ""} due for review
          </p>
        ) : (
          <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody }}>
            {docs.length === 0 ? "Welcome — upload a PDF or create a deck to get started" : "You're all caught up — nice work"}
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 0.4s ease" }}>

        {/* Continue reading */}
        {recentDoc && (
          <ContinueCard
            doc={recentDoc}
            meta={docMeta[recentDoc.id]}
            onResume={() => onOpenDocument(recentDoc.id)}
            T={T}
          />
        )}

        {/* Documents library */}
        <Section
          title="Your documents"
          action={!isMobile && hasApiKey && (
            <button onClick={() => fileInputRef.current?.click()} style={linkBtn(T)}>
              + Upload PDF
            </button>
          )}
          T={T}
        >
          {!hasApiKey && (
            <div style={{
              padding: "10px 14px", borderRadius: T.radius,
              background: `${T.hard || "#c47f2a"}10`, border: `1px solid ${T.hard || "#c47f2a"}30`,
              fontSize: 12, color: T.text, fontFamily: T.fontBody, lineHeight: 1.55,
              marginBottom: 12
            }}>
              <strong>Cloud AI required</strong> for PDF reading.{" "}
              <button onClick={() => onNavigate("settings")} style={inlineLink(T)}>Open Settings →</button>
            </div>
          )}

          {isMobile && (
            <div style={{
              padding: "10px 14px", borderRadius: T.radius,
              background: T.bgSub, border: `1px solid ${T.border}`,
              fontSize: 12, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5,
              marginBottom: 12
            }}>
              PDF reading is designed for desktop. Open Ostinote on a larger screen to upload and study PDFs.
            </div>
          )}

          {/* Upload dropzone — desktop only, when API key set, when no docs yet */}
          {!isMobile && hasApiKey && docs.length === 0 && !uploading && (
            <UploadDropzone
              T={T} onFiles={handleFiles}
              onClick={() => fileInputRef.current?.click()}
            />
          )}

          {/* Upload progress */}
          {uploading && (
            <div style={{
              padding: "14px 16px", borderRadius: T.radius,
              background: T.bgSub, border: `1px solid ${T.border}`, fontFamily: T.fontBody
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.good, animation: "pulse 1.2s ease-in-out infinite" }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                  {uploadProgress.stage === "extract" && `Extracting page ${uploadProgress.page} of ${uploadProgress.total}…`}
                  {uploadProgress.stage === "convert" && "Converting with AI…"}
                  {uploadProgress.stage === "start" && "Reading PDF…"}
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.textMid }}>This takes ~10-30 seconds. Cached after first conversion.</div>
            </div>
          )}

          {uploadError && (
            <div style={{
              padding: "10px 14px", borderRadius: T.radius,
              background: T.dueBg, color: T.due,
              fontSize: 12, fontFamily: T.fontBody, marginBottom: 8
            }}>{uploadError}</div>
          )}

          {/* Document list */}
          {!docsLoading && docs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {docs.slice(0, 5).map(d => (
                <DocumentRow
                  key={d.id} doc={d} meta={docMeta[d.id]}
                  onOpen={() => onOpenDocument(d.id)}
                  T={T} disabled={isMobile}
                />
              ))}
              {docs.length > 5 && (
                <div style={{ textAlign: "center", padding: 8 }}>
                  <button onClick={() => onNavigate("documents")} style={linkBtn(T)}>
                    View all {docs.length} documents →
                  </button>
                </div>
              )}
            </div>
          )}

          {!docsLoading && docs.length === 0 && !uploading && (isMobile || !hasApiKey) && (
            <div style={{
              padding: "20px 16px", borderRadius: T.radius,
              background: T.cardAlt, border: `1px dashed ${T.border}`,
              fontSize: 12, color: T.textMid, fontFamily: T.fontBody, textAlign: "center"
            }}>
              No documents yet
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf"
            style={{ display: "none" }}
            onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
        </Section>

        {/* Cards to review */}
        <Section
          title="Cards to review"
          action={totalDue > 0 && (
            <button onClick={onStartStudy} style={linkBtn(T)}>
              Study all →
            </button>
          )}
          T={T}
        >
          {decks.length === 0 ? (
            <div style={{
              padding: "20px 16px", borderRadius: T.radius,
              background: T.cardAlt, border: `1px dashed ${T.border}`,
              fontSize: 12, color: T.textMid, fontFamily: T.fontBody, textAlign: "center"
            }}>
              No decks yet —{" "}
              <button onClick={() => onNavigate("decks")} style={inlineLink(T)}>create one</button>
              {" "}or convert a PDF into flashcards.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(dueDecks.length > 0 ? dueDecks : decks.slice(0, 3).map(d => ({ deck: d, dueCount: 0 }))).slice(0, 4).map(({ deck, dueCount }) => (
                <DeckRow
                  key={deck.id} deck={deck} dueCount={dueCount}
                  onClick={() => onSelectDeck(deck.id)}
                  T={T}
                />
              ))}
              {decks.length > 4 && (
                <div style={{ textAlign: "center", padding: 8 }}>
                  <button onClick={() => onNavigate("decks")} style={linkBtn(T)}>
                    View all {decks.length} decks →
                  </button>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ----- Subcomponents -----

function Section({ title, action, children, T }) {
  return (
    <div style={{
      padding: "18px 20px", borderRadius: T.radiusLg,
      background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function ContinueCard({ doc, meta, onResume, T }) {
  const activity = [];
  if (meta?.chatMessages > 0) activity.push(`${meta.chatMessages} message${meta.chatMessages === 1 ? "" : "s"}`);
  if (meta?.highlights > 0) activity.push(`${meta.highlights} highlight${meta.highlights === 1 ? "" : "s"}`);
  const subline = activity.length > 0
    ? activity.join(" · ")
    : `${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"} · ${formatRelative(doc.uploadedAt)}`;

  return (
    <div style={{
      padding: "18px 20px", borderRadius: T.radiusLg,
      background: T.text, color: T.card,
      boxShadow: T.shadow2,
      fontFamily: T.fontBody, cursor: "pointer",
      transition: "transform 0.15s, box-shadow 0.15s",
      display: "flex", alignItems: "center", gap: 16,
    }}
      onClick={onResume}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = T.shadow3; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = T.shadow2; }}
    >
      <div style={{
        flexShrink: 0, width: 36, height: 44, borderRadius: 4,
        background: `${T.card}20`, border: `1px solid ${T.card}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: T.card, fontWeight: 700, fontSize: 9, letterSpacing: 0.5
      }}>PDF</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          Continue reading
        </div>
        <div style={{
          fontSize: 16, fontWeight: 700, marginBottom: 4,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>
          {doc.title}
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{subline}</div>
      </div>
      <div style={{ flexShrink: 0, opacity: 0.7 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}

function DocumentRow({ doc, meta, onOpen, T, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: T.radius,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        fontFamily: T.fontBody
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = T.bgSub; }}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{
        flexShrink: 0, width: 28, height: 36, borderRadius: 3,
        background: T.bgSub, border: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: T.textMid, fontWeight: 700, fontSize: 8, letterSpacing: 0.4
      }}>PDF</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>{doc.title}</div>
        <div style={{ fontSize: 11, color: T.textLight, marginTop: 1 }}>
          {doc.pageCount} pages
          {meta?.highlights > 0 && ` · ${meta.highlights} highlight${meta.highlights === 1 ? "" : "s"}`}
          {meta?.chatMessages > 0 && ` · chat`}
          {" · "}{formatRelative(doc.uploadedAt)}
        </div>
      </div>
    </div>
  );
}

function DeckRow({ deck, dueCount, onClick, T }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 0", borderBottom: `1px solid ${T.border}`,
        cursor: "pointer", transition: "all 0.15s", fontFamily: T.fontBody
      }}
      onMouseEnter={e => e.currentTarget.style.paddingLeft = "4px"}
      onMouseLeave={e => e.currentTarget.style.paddingLeft = "0px"}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: T.fontBody }}>{deck.name}</div>
        <div style={{ fontSize: 11, color: T.textLight, marginTop: 2 }}>{deck.cards.length} cards</div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: dueCount > 0 ? T.due : T.done, fontFamily: T.fontBody }}>
        {dueCount > 0 ? `${dueCount} due` : "Clear"}
      </span>
    </div>
  );
}

function UploadDropzone({ T, onFiles, onClick }) {
  const [dragOver, setDragOver] = useState(false);
  const counter = useRef(0);
  const enter = (e) => { e.preventDefault(); if (e.dataTransfer?.types?.includes("Files")) { counter.current++; setDragOver(true); } };
  const leave = (e) => { e.preventDefault(); counter.current--; if (counter.current <= 0) { counter.current = 0; setDragOver(false); } };
  const over = (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
  const drop = (e) => { e.preventDefault(); counter.current = 0; setDragOver(false); onFiles(e.dataTransfer.files); };

  return (
    <button type="button" onClick={onClick}
      onDragEnter={enter} onDragLeave={leave} onDragOver={over} onDrop={drop}
      style={{
        width: "100%", padding: "24px 20px", borderRadius: T.radius,
        background: dragOver ? `${T.good}10` : T.cardAlt,
        border: `2px dashed ${dragOver ? T.good : T.border}`,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
        transition: "all 0.15s", fontFamily: T.fontBody
      }}>
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
        background: dragOver ? `${T.good}20` : T.bgSub,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dragOver ? T.good : T.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div style={{ textAlign: "left", flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
          {dragOver ? "Drop to upload" : "Upload a PDF"}
        </div>
        <div style={{ fontSize: 11, color: T.textLight, marginTop: 2 }}>
          Drop a file here or click to choose
        </div>
      </div>
    </button>
  );
}

// ----- Styles helpers -----

const linkBtn = (T) => ({
  background: "none", border: "none", padding: 0,
  fontSize: 12, color: T.textLight, cursor: "pointer",
  fontFamily: T.fontBody, fontWeight: 500, transition: "color 0.15s"
});
const inlineLink = (T) => ({
  background: "none", border: "none", padding: 0,
  fontSize: "inherit", color: T.easy, cursor: "pointer",
  fontFamily: "inherit", textDecoration: "underline"
});

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
