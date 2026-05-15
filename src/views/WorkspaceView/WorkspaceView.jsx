// The new central UI of Ostinote — a 3-column workspace.
//
//  [Library sidebar] | [Reader + highlights] | [Studio: chat / cards / tools]
//
// Library is collapsable (Safari-style). Reader stays focused on one document
// at a time. Studio surfaces AI chat, highlights, generated flashcards, and
// the rest of the study tools for the currently-open document.
//
// Replaces the old separate Dashboard + DocumentReader views.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import useTheme from "../../theme/useTheme.js";
import Markdown from "../../components/Markdown/Markdown.jsx";
import LibrarySidebar from "../../components/LibrarySidebar/LibrarySidebar.jsx";
import DocumentSidebar from "../../components/DocumentSidebar/DocumentSidebar.jsx";
import TopBar from "../../components/TopBar/TopBar.jsx";
import {
  listDocuments, listFolders, getDocument, saveDocument, deleteDocument, findByHash,
  hashFile, generateId,
  saveFolder, deleteFolder, moveDocument, moveFolder, updateDocument,
  listHighlights, saveHighlight,
} from "../../utils/documentStore.js";
import { processFile } from "../../utils/pdfConverter.js";

// Workspace tabs are documents only — decks live in the Tool Bar (right
// sidebar) under their own "Cards" tab. The middle pane stays focused on
// reading PDFs; clicking a deck in the Library swings the Tool Bar over
// to the deck instead of stealing the reader.
const OPEN_DOC_IDS_KEY = "ostinote_workspace_openDocIds";
const ACTIVE_DOC_ID_KEY = "ostinote_workspace_activeDocId";
const SELECTED_DECK_ID_KEY = "ostinote_workspace_selectedDeckId";
// Legacy keys migrated forward on first run so existing users don't lose
// state across the refactor.
const LEGACY_OPEN_TABS_KEY = "ostinote_workspace_openTabs";
const LEGACY_ACTIVE_TAB_KEY = "ostinote_workspace_activeTab";
const LEGACY_SELECTED_DOC_KEY = "ostinote_workspace_selectedDocId";
const LIBRARY_OPEN_KEY = "ostinote_workspace_libraryOpen";
const STUDIO_OPEN_KEY = "ostinote_workspace_studioOpen";

export default function WorkspaceView({
  decks, aiSettings, onAddCardToDeck,
  onMoveDeck, onRenameDeck, onTagDeck, onDeleteDeck, onSelectDeck,
  // Deck-tab action handlers. These let the workspace render a deck tab
  // without requiring the user to "Open standalone" for every action.
  // Each takes an explicit deckId since multiple tabs may be open.
  onStartStudyForDeck, onAddCardForDeck, onEditCardForDeck, onDeleteCardInDeck,
  onApplyRatingInDeck,
  onNavigate, onHelpOpen, user
}) {
  const { T } = useTheme();

  // ---- Library state ----
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingLib, setLoadingLib] = useState(true);
  // openDocIds = ordered list of doc tabs in the reader pane.
  // activeDocId = the currently-rendered tab. Migration ladder:
  //   - openDocIds (new shape): used as-is
  //   - LEGACY openTabs ([{type:"doc",id}]): extract doc ids
  //   - LEGACY selectedDocId (single id): one tab
  const [openDocIds, setOpenDocIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_DOC_IDS_KEY) || "null");
      if (Array.isArray(saved)) return saved.filter(Boolean);
      const legacyTabs = JSON.parse(localStorage.getItem(LEGACY_OPEN_TABS_KEY) || "null");
      if (Array.isArray(legacyTabs)) {
        return legacyTabs.filter(t => t?.type === "doc" && t.id).map(t => t.id);
      }
      const legacy = localStorage.getItem(LEGACY_SELECTED_DOC_KEY);
      return legacy ? [legacy] : [];
    } catch { return []; }
  });
  const [activeDocId, setActiveDocId] = useState(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_DOC_ID_KEY);
      if (saved) return saved;
      const legacyTab = JSON.parse(localStorage.getItem(LEGACY_ACTIVE_TAB_KEY) || "null");
      if (legacyTab?.type === "doc") return legacyTab.id;
      return localStorage.getItem(LEGACY_SELECTED_DOC_KEY) || null;
    } catch { return null; }
  });
  // The deck currently in the Tool Bar's "Cards" tab. null when none.
  const [selectedDeckId, setSelectedDeckId] = useState(() => {
    try { return localStorage.getItem(SELECTED_DECK_ID_KEY) || null; }
    catch { return null; }
  });
  const [libraryOpen, setLibraryOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LIBRARY_OPEN_KEY) ?? "true"); } catch { return true; }
  });
  const [studioOpen, setStudioOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STUDIO_OPEN_KEY) ?? "true"); }
    catch { return true; }
  });
  const fileInputRef = useRef(null);

  // ---- Document reader: docked / floating mode ----
  //
  // "docked" (default) — reader fills the middle column like a fixed pane.
  // "floating" — reader becomes a draggable / resizable Rnd window inside
  // Persist UI state
  useEffect(() => { localStorage.setItem(OPEN_DOC_IDS_KEY, JSON.stringify(openDocIds)); }, [openDocIds]);
  useEffect(() => {
    if (activeDocId) localStorage.setItem(ACTIVE_DOC_ID_KEY, activeDocId);
    else localStorage.removeItem(ACTIVE_DOC_ID_KEY);
  }, [activeDocId]);
  useEffect(() => {
    if (selectedDeckId) localStorage.setItem(SELECTED_DECK_ID_KEY, selectedDeckId);
    else localStorage.removeItem(SELECTED_DECK_ID_KEY);
  }, [selectedDeckId]);
  useEffect(() => { localStorage.setItem(LIBRARY_OPEN_KEY, JSON.stringify(libraryOpen)); }, [libraryOpen]);
  useEffect(() => { localStorage.setItem(STUDIO_OPEN_KEY, JSON.stringify(studioOpen)); }, [studioOpen]);

  // Initial library load + scrub stale ids against what's in the doc
  // store. The deck-id scrub runs in its own effect that watches the
  // `decks` prop.
  useEffect(() => {
    (async () => {
      const [docs, fs] = await Promise.all([listDocuments(), listFolders()]);
      setDocuments(docs);
      setFolders(fs);
      const docIds = new Set(docs.map(d => d.id));
      setOpenDocIds(prev => prev.filter(id => docIds.has(id)));
      setActiveDocId(prev => (prev && docIds.has(prev) ? prev : null));
      setLoadingLib(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear selectedDeckId if its deck got deleted out from under us.
  useEffect(() => {
    const deckIds = new Set((decks || []).map(d => d.id));
    setSelectedDeckId(prev => (prev && deckIds.has(prev) ? prev : null));
  }, [decks]);

  // ---- Active content state ----
  const [loadedDocs, setLoadedDocs] = useState({});
  const [highlights, setHighlights] = useState([]);
  const [progress, setProgress] = useState(0);
  const [selectionPopover, setSelectionPopover] = useState(null);
  const readerRef = useRef(null);

  const activeDoc = activeDocId ? loadedDocs[activeDocId] : null;
  const selectedDeck = selectedDeckId ? (decks || []).find(d => d.id === selectedDeckId) : null;

  // Prune loaded docs for tabs that closed.
  useEffect(() => {
    const ids = new Set(openDocIds);
    setLoadedDocs(prev => {
      let changed = false;
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (ids.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [openDocIds]);

  // Load any open tabs not yet fetched.
  useEffect(() => {
    let cancelled = false;
    openDocIds.forEach(id => {
      if (loadedDocs[id]) return;
      getDocument(id).then(d => {
        if (cancelled || !d) return;
        setLoadedDocs(prev => prev[id] ? prev : { ...prev, [id]: d });
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocIds]);

  // Highlights follow the active doc.
  useEffect(() => {
    let cancelled = false;
    if (!activeDocId) { setHighlights([]); return; }
    (async () => {
      const hs = await listHighlights(activeDocId);
      if (cancelled) return;
      setHighlights(hs);
    })();
    return () => { cancelled = true; };
  }, [activeDocId]);

  // ---- Tab open/close helpers ----
  const openDocTab = useCallback((id) => {
    if (!id) return;
    setOpenDocIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setActiveDocId(id);
  }, []);
  const closeDocTab = useCallback((id) => {
    setOpenDocIds(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const next = prev.filter(x => x !== id);
      setActiveDocId(curr => {
        if (curr !== id) return curr;
        return next[idx] || next[idx - 1] || null;
      });
      return next;
    });
  }, []);

  // Clicking a deck in the Library sends it into the Tool Bar's Cards
  // tab (NOT into the reader pane). We also open the Tool Bar if it was
  // collapsed — otherwise the user clicks and nothing visibly happens.
  const selectDeck = useCallback((deckId) => {
    if (!deckId) return;
    setSelectedDeckId(deckId);
    setStudioOpen(true);
  }, []);

  // Reader scroll progress
  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(el.scrollTop / max, 1) : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeDoc]);

  // Text selection → floating "Highlight" button
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 4) { setSelectionPopover(null); return; }
    if (!readerRef.current?.contains(sel.anchorNode)) { setSelectionPopover(null); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopover({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text,
      page: findPageForNode(sel.anchorNode),
    });
  }, []);
  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  const handleSaveHighlight = async () => {
    if (!selectionPopover || !activeDoc) return;
    const h = {
      id: generateId(),
      docId: activeDoc.id,
      text: selectionPopover.text,
      page: selectionPopover.page,
      color: T.hard || "#c47f2a",
      note: null,
      createdAt: Date.now(),
      source: "user",
    };
    await saveHighlight(h);
    setHighlights(prev => [...prev, h].sort((a, b) => (a.page ?? 0) - (b.page ?? 0)));
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  };

  const scrollToPage = useCallback((n) => {
    const target = document.getElementById(`page-${n}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    const orig = target.style.background;
    target.style.transition = "background 0.5s ease";
    target.style.background = `${T.easy}15`;
    setTimeout(() => { if (target) target.style.background = orig || "transparent"; }, 1200);
  }, [T.easy]);

  // Markdown w/ highlights baked in
  const markdownWithHighlights = useMemo(() => {
    if (!activeDoc?.markdown) return "";
    let md = activeDoc.markdown;
    for (const h of highlights) {
      const safe = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${safe})`, "");
      md = md.replace(re, `<mark>$1</mark>`);
    }
    return md;
  }, [activeDoc?.markdown, highlights]);

  // ---- Library mutations ----

  const handleCreateFolder = async (name, parentId) => {
    const folder = {
      id: generateId(), name, parentId: parentId || null,
      createdAt: Date.now(), sortOrder: folders.length,
    };
    await saveFolder(folder);
    setFolders(prev => [...prev, folder]);
  };

  const handleRenameFolder = async (id, name) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const updated = { ...folder, name };
    await saveFolder(updated);
    setFolders(prev => prev.map(f => f.id === id ? updated : f));
  };

  const handleDeleteFolder = async (id) => {
    await deleteFolder(id);
    // Re-fetch — deleteFolder re-parents children, easier to just resync
    const [docs, fs] = await Promise.all([listDocuments(), listFolders()]);
    setDocuments(docs);
    setFolders(fs);
  };

  const handleMoveDocument = async (docId, folderId) => {
    await moveDocument(docId, folderId);
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, folderId } : d));
  };

  const handleMoveFolder = async (folderId, newParentId) => {
    await moveFolder(folderId, newParentId);
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: newParentId } : f));
  };

  const handleDeleteDocument = async (id) => {
    await deleteDocument(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
    // Close the tab too if it was open
    closeDocTab(id);
  };

  const handleRenameDocument = async (id, title) => {
    const updated = await updateDocument(id, { title });
    if (updated) {
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
      // Update the loaded copy if this doc is open in a tab
      setLoadedDocs(prev => prev[id] ? { ...prev, [id]: updated } : prev);
    }
  };

  const handleTagDocument = async (id, tags) => {
    const updated = await updateDocument(id, { tags: tags || [] });
    if (updated) {
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
      setLoadedDocs(prev => prev[id] ? { ...prev, [id]: updated } : prev);
    }
  };

  // ---- Upload flow ----

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ stage: "", page: 0, total: 0 });
  const [uploadError, setUploadError] = useState(null);

  // "Do we have an AI provider configured?" — true for any cloud key
  // OR the keyless claude-local provider. `useLocal` (the WebLLM grading
  // toggle) still suppresses cloud paths to preserve existing behavior.
  const hasApiKey =
    aiSettings?.provider === "claude-local"
      ? true
      : (!!aiSettings?.apiKey && !aiSettings?.useLocal);

  const handleUploadFiles = async (files) => {
    setUploadError(null);
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    if (!hasApiKey) {
      setUploadError("PDF conversion needs a cloud AI provider configured.");
      return;
    }
    setUploading(true);
    try {
      const hash = await hashFile(file);
      const existing = await findByHash(hash);
      if (existing) {
        setUploading(false);
        openDocTab(existing.id);
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
        folderId: null,
      };
      await saveDocument(doc);
      setDocuments(prev => [doc, ...prev]);
      openDocTab(doc.id);
      setUploading(false);
    } catch (err) {
      // Surface the full error in the console so users (and us) can see
      // the stack trace, not just the message. The UI still shows the
      // short message.
      console.error("Upload failed:", err);
      setUploadError(err.message || "Conversion failed");
      setUploading(false);
    }
  };

  // ---- Render ----

  const readingTime = useMemo(() => {
    if (!activeDoc?.markdown) return 0;
    const words = activeDoc.markdown.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  }, [activeDoc]);

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      background: T.bg, fontFamily: T.fontBody,
      // Now vertical: top bar on top, 3-column workspace below.
      display: "flex", flexDirection: "column",
    }}>
      {/* TOP BAR — Ostinote logo (left), Settings + Profile (right). The
          logo doubles as a home button, clearing the active document. */}
      <TopBar
        view="workspace"
        onNavigate={onNavigate}
        onLogoClick={() => setActiveDocId(null)}
      />

      {/* 3-column flex below the top bar */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      {/* Library sidebar (left) — search, library, decks */}
      {!loadingLib && (
        <LibrarySidebar
          documents={documents}
          folders={folders}
          decks={decks}
          selectedDocId={activeDocId}
          selectedDeckId={selectedDeckId}
          onSelectDocument={openDocTab}
          // Clicking a deck routes it to the Tool Bar's Cards tab. The
          // reader pane stays on the active PDF — decks no longer steal
          // the middle column.
          onSelectDeck={selectDeck}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveDocument={handleMoveDocument}
          onMoveFolder={handleMoveFolder}
          onMoveDeck={onMoveDeck}
          onRenameDocument={handleRenameDocument}
          onTagDocument={handleTagDocument}
          onRenameDeck={onRenameDeck}
          onTagDeck={onTagDeck}
          onDeleteDeck={onDeleteDeck}
          onDeleteDocument={handleDeleteDocument}
          onUploadClick={() => fileInputRef.current?.click()}
          open={libraryOpen}
          onToggleOpen={() => setLibraryOpen(!libraryOpen)}
        />
      )}

      {/* 2-column flex for the rest of the workspace. */}
      <div style={{
        flex: 1, minHeight: 0, display: "flex",
        position: "relative", overflow: "hidden",
      }}>
        {/* Placeholder so the new structure aligns visually with the rest below */}

        {/* Middle pane — reader (when a doc is open) or welcome / empty
            state. Reader stays docked here; no floating-window mode. */}
        <div style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          background: T.bg
        }}>
          {openDocIds.length > 0 ? (
            <>
              {/* Tab strip — one tab per open document. Active tab drives
                  the reader content. Decks go to the Tool Bar instead. */}
              <DocTabStrip
                T={T}
                openDocIds={openDocIds}
                activeDocId={activeDocId}
                loadedDocs={loadedDocs}
                documents={documents}
                progress={progress}
                onSelect={setActiveDocId}
                onClose={closeDocTab}
              />

              {/* Reader pane — renders the active doc's markdown. */}
              {activeDoc ? (
                <div ref={readerRef} style={{
                  flex: 1, overflowY: "auto", padding: "32px 24px 80px",
                  minHeight: 0,
                }}>
                  <article style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
                    <h1 style={{
                      fontSize: 32, fontWeight: 700, color: T.text, fontFamily: T.font,
                      marginBottom: 24, letterSpacing: -0.4, lineHeight: 1.2
                    }}>{activeDoc.title}</h1>
                    <Markdown markdown={markdownWithHighlights} />
                  </article>
                </div>
              ) : (
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  color: T.textLight, fontSize: 13, fontFamily: T.fontBody,
                }}>
                  Loading…
                </div>
              )}
            </>
          ) : (
            <EmptyMiddle
              T={T}
              docs={documents}
              hasApiKey={hasApiKey}
              uploading={uploading}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              onUploadClick={() => fileInputRef.current?.click()}
              onSelectDoc={openDocTab}
              onOpenSettings={() => onNavigate("settings")}
            />
          )}
        </div>

        {/* Studio (right) — always rendered, consistent with the left
            sidebar. Collapses to a thin rail when closed; full layout when
            open. The tabs inside gracefully degrade to empty states when
            no document is selected. */}
        <DocumentSidebar
          doc={activeDoc}
          openDocs={openDocIds.map(id => loadedDocs[id]).filter(Boolean)}
          // Decks live in the Tool Bar now — the Cards tab renders the
          // selected deck. `null` when no deck has been picked yet.
          selectedDeck={selectedDeck}
          // Deck-action handlers — needed by the Cards tab for inline
          // Add Card, fullscreen Study/Edit, inline delete, rename.
          onRenameDeck={onRenameDeck}
          onStartStudyForDeck={onStartStudyForDeck}
          onEditCardForDeck={onEditCardForDeck}
          onDeleteCardInDeck={onDeleteCardInDeck}
          onApplyRatingInDeck={onApplyRatingInDeck}
          aiSettings={aiSettings}
          decks={decks}
          highlights={highlights}
          setHighlights={setHighlights}
          onScrollToPage={scrollToPage}
          onAddCardToDeck={onAddCardToDeck}
          open={studioOpen}
          onToggleOpen={() => setStudioOpen(o => !o)}
        />
      </div>

      {/* Floating "Highlight" button when text is selected */}
      {selectionPopover && (
        <div style={{
          position: "fixed",
          left: selectionPopover.x, top: selectionPopover.y,
          transform: "translate(-50%, -100%)",
          background: T.text, color: T.card,
          padding: "6px 12px", borderRadius: 20,
          fontSize: 12, fontWeight: 600, fontFamily: T.fontBody,
          cursor: "pointer", boxShadow: T.shadow2,
          display: "flex", alignItems: "center", gap: 6,
          zIndex: 50, animation: "fadeIn 0.12s ease"
        }} onMouseDown={e => { e.preventDefault(); handleSaveHighlight(); }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11H5a2 2 0 0 0-2 2v7h7V13a2 2 0 0 0-2-2z" />
            <path d="M9 7l3-5 3 5" />
          </svg>
          Highlight
        </div>
      )}

      {/* Hidden file input for the library Upload button */}
      <input
        ref={fileInputRef} type="file" accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={e => { handleUploadFiles(e.target.files); e.target.value = ""; }}
      />
      </div>{/* /3-column row */}
    </div>
  );
}

// ---- Subcomponents ----

// Tab strip rendered at the top of the reader pane — one tab per open
// document. Outlined-pill style shared with the Tool Bar tab strip.
function DocTabStrip({ T, openDocIds, activeDocId, loadedDocs, documents, progress, onSelect, onClose }) {
  const titleFor = (id) =>
    loadedDocs[id]?.title || documents.find(d => d.id === id)?.title || "Untitled";
  return (
    <div style={{
      position: "relative",
      flexShrink: 0,
      background: T.card,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        padding: "8px 12px", gap: 6,
        overflowX: "auto", overflowY: "hidden",
      }}>
        {openDocIds.map(id => {
          const isActive = id === activeDocId;
          const title = titleFor(id);
          return (
            <div
              key={id}
              onClick={() => onSelect(id)}
              role="tab"
              aria-selected={isActive}
              title={title}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px 6px 10px",
                borderRadius: 8,
                border: isActive ? `1.5px solid ${T.borderStrong}` : "1.5px solid transparent",
                background: isActive ? T.bgSub : "transparent",
                cursor: "pointer",
                color: isActive ? T.text : T.textLight,
                fontSize: 12, fontWeight: 600,
                fontFamily: T.fontBody,
                maxWidth: 220, minWidth: 80,
                transition: "all 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = T.bgSub;
                  e.currentTarget.style.color = T.textMid;
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = T.textLight;
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{
                flex: 1, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(id); }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={`Close ${title}`}
                style={{
                  width: 18, height: 18, borderRadius: 4, border: "none",
                  background: "transparent", color: "inherit",
                  cursor: "pointer", padding: 0, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: 0.55,
                  transition: "opacity 0.12s, background 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "0.55"; }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, pointerEvents: "none" }}>
        <div style={{
          width: `${(progress || 0) * 100}%`, height: "100%",
          background: T.good, transition: "width 0.1s ease",
        }} />
      </div>
    </div>
  );
}

function EmptyMiddle({ T, docs, hasApiKey, uploading, uploadProgress, uploadError, onUploadClick, onSelectDoc, onOpenSettings }) {
  const [dragOver, setDragOver] = useState(false);
  const counter = useRef(0);
  const enter = (e) => { e.preventDefault(); if (e.dataTransfer?.types?.includes("Files")) { counter.current++; setDragOver(true); } };
  const leave = (e) => { e.preventDefault(); counter.current--; if (counter.current <= 0) { counter.current = 0; setDragOver(false); } };
  const over = (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
  const drop = (e) => {
    e.preventDefault();
    counter.current = 0;
    setDragOver(false);
    const input = document.querySelector('input[type="file"]');
    if (input && e.dataTransfer.files[0]) {
      // pipe through the same upload flow by triggering the change event
      const dt = new DataTransfer();
      dt.items.add(e.dataTransfer.files[0]);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, overflow: "auto"
    }}
      onDragEnter={enter} onDragLeave={leave} onDragOver={over} onDrop={drop}
    >
      <div style={{
        maxWidth: 520, width: "100%", textAlign: "center",
        fontFamily: T.fontBody
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: dragOver ? `${T.good}20` : T.bgSub,
          margin: "0 auto 20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: dragOver ? T.good : T.textMid,
          transition: "all 0.15s",
          border: dragOver ? `2px dashed ${T.good}` : `2px dashed ${T.border}`
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 8 }}>
          {docs.length === 0 ? "Welcome to your workspace" : "Open a document"}
        </h1>
        <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.55, marginBottom: 24, maxWidth: 420, margin: "0 auto 24px" }}>
          {dragOver
            ? "Drop your PDF to upload"
            : docs.length === 0
              ? "Drop a PDF here, or pick one from the library on the left, to start reading and studying."
              : "Pick a document from the library on the left, or upload a new one."}
        </p>

        {!hasApiKey && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderRadius: 999,
            background: `${T.hard || "#c47f2a"}15`, border: `1px solid ${T.hard || "#c47f2a"}40`,
            fontSize: 12, color: T.text, fontFamily: T.fontBody, marginBottom: 16
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.hard || "#c47f2a"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Cloud AI required for PDF reading
            <button onClick={onOpenSettings} style={{
              background: "none", border: "none", padding: 0, color: T.easy,
              cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline"
            }}>Setup →</button>
          </div>
        )}

        {hasApiKey && (
          <button onClick={onUploadClick} disabled={uploading} style={{
            padding: "11px 22px", borderRadius: 999,
            background: T.text, color: T.card, border: "none",
            fontWeight: 600, fontSize: 13, fontFamily: T.fontBody,
            cursor: uploading ? "default" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            opacity: uploading ? 0.6 : 1
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload PDF
          </button>
        )}

        {uploading && (
          <div style={{
            marginTop: 24, padding: "14px 16px", borderRadius: 12,
            background: T.bgSub, border: `1px solid ${T.border}`,
            fontFamily: T.fontBody, textAlign: "left", maxWidth: 360, margin: "24px auto 0"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.good, animation: "pulse 1.2s ease-in-out infinite" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                {uploadProgress.stage === "extract" && `Extracting page ${uploadProgress.page} of ${uploadProgress.total}…`}
                {uploadProgress.stage === "convert" && "Converting with AI…"}
                {(uploadProgress.stage === "start" || !uploadProgress.stage) && "Reading PDF…"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.textMid }}>10-30 seconds. Cached after first conversion.</div>
          </div>
        )}

        {uploadError && (
          <div style={{
            marginTop: 16, padding: "10px 14px", borderRadius: 8,
            background: T.dueBg, color: T.due, fontSize: 12, fontFamily: T.fontBody, maxWidth: 420, margin: "16px auto 0"
          }}>{uploadError}</div>
        )}

        {/* Recent docs hint */}
        {docs.length > 0 && (
          <div style={{ marginTop: 36, textAlign: "left", maxWidth: 420, margin: "36px auto 0" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: T.textLight,
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10
            }}>
              Recent
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {docs.slice(0, 5).map(d => (
                <button key={d.id} onClick={() => onSelectDoc(d.id)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8,
                  border: `1px solid ${T.border}`, background: T.card,
                  cursor: "pointer", textAlign: "left", fontFamily: T.fontBody,
                  transition: "all 0.1s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.background = T.bgSub; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{
                    flex: 1, fontSize: 13, color: T.text, fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>{d.title}</span>
                  <span style={{ fontSize: 10, color: T.textLight, flexShrink: 0 }}>
                    {d.pageCount}p
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const topBtn = (T) => ({
  padding: "4px 12px", borderRadius: 6, border: "none",
  background: "transparent", color: T.textMid,
  fontSize: 12, fontWeight: 500, fontFamily: T.fontBody, cursor: "pointer",
  transition: "color 0.1s"
});

// Walks up DOM from a node to find its nearest <section id="page-N">
function findPageForNode(node) {
  let el = node?.nodeType === 3 ? node.parentElement : node;
  while (el) {
    if (el.id?.startsWith("page-")) return parseInt(el.id.slice(5), 10);
    el = el.parentElement;
  }
  return null;
}
