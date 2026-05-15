// Single sidebar that contains everything outside the reader:
//   - Ostinote header + collapse button
//   - Search across documents + decks
//   - Library section (folder tree of documents)
//   - Decks section (SRS decks with due counts)
//   - Footer: + Upload, + Folder
//   - Bottom: Settings + Profile

import { useState, useEffect, useRef, useMemo } from "react";
import useTheme from "../../theme/useTheme.js";

const EXPANDED_KEY = "ostinote_folder_expanded";
const SECTIONS_KEY = "ostinote_sidebar_sections";

function getExpandedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveExpandedSet(set) {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]));
}

// Persisted collapse state for the two sidebar sections — kept open by default
function getSectionState() {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (!raw) return { library: false, decks: false };
    return { library: false, decks: false, ...JSON.parse(raw) };
  } catch { return { library: false, decks: false }; }
}
function saveSectionState(state) {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(state));
}

export default function LibrarySidebar({
  documents, folders, decks, selectedDocId, selectedDeckId,
  onSelectDocument, onSelectDeck,
  onCreateFolder, onRenameFolder, onDeleteFolder,
  onMoveDocument, onMoveFolder, onMoveDeck,
  onDeleteDocument, onDeleteDeck,
  onRenameDocument, onRenameDeck,
  onTagDocument, onTagDeck,
  onUploadClick,
  onOpenSettings, onOpenProfile, onOpenHome,
  open, onToggleOpen,
}) {
  const { T } = useTheme();
  const [expanded, setExpanded] = useState(() => getExpandedSet());
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  // Inline rename works for any item type via { type, id } — folders, docs, decks
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [search, setSearch] = useState("");
  const [sections, setSections] = useState(getSectionState);
  // Active drag source — tracked locally so we can dim the dragged row and
  // show a contextual "Drop here" label on the target. Cleared on dragend.
  const [dragSource, setDragSource] = useState(null);
  // Move modal: { type: "doc"|"deck"|"folder", id, name }
  const [moveTarget, setMoveTarget] = useState(null);
  // Tag editor modal: { type: "doc"|"deck", id, name, tags }
  const [tagTarget, setTagTarget] = useState(null);
  const renameInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  useEffect(() => { saveExpandedSet(expanded); }, [expanded]);
  useEffect(() => { saveSectionState(sections); }, [sections]);

  const toggleSection = (key) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  // When a drag starts, make sure the Library section is open so the user
  // has visible folders to drop into. Without this, the sidebar can look
  // unresponsive if Library was collapsed when they started dragging.
  useEffect(() => {
    if (dragSource && sections.library) {
      setSections(prev => ({ ...prev, library: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragSource]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  useEffect(() => {
    if ((renamingFolderId || renamingItem) && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFolderId, renamingItem]);

  useEffect(() => {
    if (creatingFolder && newFolderInputRef.current) newFolderInputRef.current.focus();
  }, [creatingFolder]);

  // Pre-compute children maps for the tree
  const childFolders = useMemo(() => {
    const map = new Map();
    folders.forEach(f => {
      const key = f.parentId || "root";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    });
    return map;
  }, [folders]);

  const docsByFolder = useMemo(() => {
    const map = new Map();
    documents.forEach(d => {
      const key = d.folderId || "root";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    return map;
  }, [documents]);

  // Decks are a projection: same deck can appear in Library (folder tree) AND
  // the global Decks section. The Library section uses `folderId` to know
  // structural location; the Decks section always shows the flat list.
  const decksByFolder = useMemo(() => {
    const map = new Map();
    (decks || []).forEach(d => {
      const key = d.folderId || "root";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    return map;
  }, [decks]);

  // Search-filtered subsets
  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const matchingDocs = useMemo(
    () => searching ? documents.filter(d => d.title.toLowerCase().includes(q)) : null,
    [documents, q, searching]
  );
  const matchingDecks = useMemo(
    () => searching ? (decks || []).filter(d => d.name.toLowerCase().includes(q)) : null,
    [decks, q, searching]
  );

  const toggleFolder = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startRename = (folder) => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.name);
    setContextMenu(null);
  };
  const commitRename = () => {
    if (renameValue.trim()) onRenameFolder(renamingFolderId, renameValue.trim());
    setRenamingFolderId(null);
    setRenameValue("");
  };

  // Generic rename for docs and decks (folders use the dedicated flow above
  // because folder names are tightly coupled to the tree's render path).
  const startItemRename = (type, id, currentName) => {
    setRenamingItem({ type, id });
    setRenameValue(currentName);
    setContextMenu(null);
  };
  const commitItemRename = () => {
    if (!renamingItem) return;
    const name = renameValue.trim();
    if (name) {
      if (renamingItem.type === "doc" && onRenameDocument) onRenameDocument(renamingItem.id, name);
      else if (renamingItem.type === "deck" && onRenameDeck) onRenameDeck(renamingItem.id, name);
    }
    setRenamingItem(null);
    setRenameValue("");
  };
  const cancelItemRename = () => {
    setRenamingItem(null);
    setRenameValue("");
  };

  const startCreateFolder = () => {
    setCreatingFolder(true);
    setNewFolderName("");
  };
  const commitCreateFolder = () => {
    const name = newFolderName.trim();
    if (name) onCreateFolder(name, null);
    setCreatingFolder(false);
    setNewFolderName("");
  };

  // Drag and drop
  const onDragStartDoc = (e, doc) => {
    e.dataTransfer.setData("application/x-ostinote-doc", doc.id);
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ type: "doc", id: doc.id, name: doc.title });
  };
  const onDragStartFolder = (e, folder) => {
    e.dataTransfer.setData("application/x-ostinote-folder", folder.id);
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ type: "folder", id: folder.id, name: folder.name });
  };
  const onDragStartDeck = (e, deck) => {
    e.dataTransfer.setData("application/x-ostinote-deck", deck.id);
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ type: "deck", id: deck.id, name: deck.name });
  };
  // Single shared end handler — fires whether drop succeeded or was canceled
  const onDragEndAny = () => {
    setDragSource(null);
    setDragOverFolder(null);
  };
  const onDragOverFolderEl = (e, folderId) => {
    // We trust `dragSource` (set in our own onDragStart) as the source of
    // truth for "is this our drag?". Reading `e.dataTransfer.types` works in
    // most browsers but the typed-strings array is sometimes empty or cased
    // differently across browsers — checking our own state is bulletproof.
    if (!dragSource) {
      // Fallback for the (rare) case where state hasn't propagated yet —
      // still inspect the MIME list so we don't block a legitimate drop.
      const types = e.dataTransfer.types;
      if (!types.includes("application/x-ostinote-doc") &&
          !types.includes("application/x-ostinote-folder") &&
          !types.includes("application/x-ostinote-deck")) {
        return;
      }
    }
    e.preventDefault();
    // Stop propagation so a nested folder's dragover doesn't bubble up to
    // its parent and overwrite our highlight with the parent's id. Without
    // this, the deepest folder under the cursor would lose to the outermost
    // one (parent's handler runs last in the bubble phase).
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    // Avoid pointless re-renders if we're already highlighting this folder
    setDragOverFolder(prev => (prev === folderId ? prev : folderId));
  };
  // IMPORTANT: dragleave fires on the parent every time the cursor enters
  // a child element. If we naively cleared state here we'd lose the highlight
  // the moment the user hovered over the folder header inside the wrapper.
  // Only clear when the cursor actually leaves the wrapper for something
  // outside its subtree.
  const onDragLeaveFolderEl = (e) => {
    const next = e.relatedTarget;
    if (next && e.currentTarget.contains(next)) return;
    setDragOverFolder(null);
  };
  const onDropOnFolder = (e, folderId) => {
    e.preventDefault();
    // CRITICAL: stop propagation so nested folder drops don't bubble up
    // and double-fire on the parent folder's drop handler.
    e.stopPropagation();
    setDragOverFolder(null);
    setDragSource(null);
    const docId = e.dataTransfer.getData("application/x-ostinote-doc");
    const draggedFolderId = e.dataTransfer.getData("application/x-ostinote-folder");
    const deckId = e.dataTransfer.getData("application/x-ostinote-deck");
    const targetFolderId = folderId === "root" ? null : folderId;
    if (docId) onMoveDocument(docId, targetFolderId);
    if (deckId && onMoveDeck) onMoveDeck(deckId, targetFolderId);
    if (draggedFolderId && draggedFolderId !== folderId && !isDescendant(draggedFolderId, targetFolderId, folders)) {
      onMoveFolder(draggedFolderId, targetFolderId);
    }
  };

  // ---- COLLAPSED RAIL CONTENT ----
  // Both layouts are always rendered now (crossfaded with opacity) so the
  // outer width transition can play smoothly without unmounting either
  // tree. The rail is minimal now: the only sidebar-specific affordance
  // when collapsed is "show me the library again". The Ostinote home,
  // Settings, and Profile entry points all live in the app top bar.
  const railLayout = (
    <>
      <IconButton onClick={onToggleOpen} title="Show library" T={T}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </IconButton>
      <div style={{ flex: 1 }} />
    </>
  );

  // ---- TREE RENDERING ----

  const renderFolder = (folder, depth = 0) => {
    const isExpanded = expanded.has(folder.id);
    const subfolders = childFolders.get(folder.id) || [];
    const folderDocs = docsByFolder.get(folder.id) || [];
    const folderDecks = decksByFolder.get(folder.id) || [];
    const isRenaming = renamingFolderId === folder.id;

    const isBeingDragged = dragSource?.type === "folder" && dragSource.id === folder.id;
    // Suppress the highlight in cases where the drop will be rejected anyway:
    //  - dragging a folder onto itself
    //  - dragging a folder into one of its own descendants (cycle)
    // Without this, the user sees a green "Move here" promise that silently
    // does nothing on release — which is the worst kind of feedback.
    const wouldBeRejected =
      dragSource?.type === "folder" &&
      (dragSource.id === folder.id ||
        isDescendant(dragSource.id, folder.id, folders));
    const isOver = dragOverFolder === folder.id && !wouldBeRejected;
    return (
      // Outer wrapper handles drag/drop for this folder's entire visual area
      // (header + expanded children). Drops anywhere within — including on
      // "Empty" placeholders or between child rows — count as a drop INTO
      // this folder. The inner header div handles dragging the folder itself
      // + click-to-expand.
      <div
        key={folder.id}
        onDragOver={e => onDragOverFolderEl(e, folder.id)}
        onDragLeave={onDragLeaveFolderEl}
        onDrop={e => onDropOnFolder(e, folder.id)}
        // Only the actively-hovered folder shows visual feedback — every
        // other folder stays neutral. Soft green wash only, no border or
        // accent bar — just enough tint to mark the target.
        style={{
          position: "relative",
          background: isOver ? `${T.good}26` : "transparent",
          borderRadius: 6,
          transition: "background 0.12s",
          opacity: isBeingDragged ? 0.35 : 1,
        }}
      >
        <div
          draggable={!isRenaming}
          onDragStart={e => onDragStartFolder(e, folder)}
          onDragEnd={onDragEndAny}
          onClick={() => !isRenaming && toggleFolder(folder.id)}
          onContextMenu={e => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, type: "folder", id: folder.id });
          }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: `5px 10px 5px ${10 + depth * 14}px`,
            borderRadius: 6, cursor: "pointer",
            color: T.text, fontSize: 14, fontFamily: T.fontBody, fontWeight: 500,
            userSelect: "none", transition: "background 0.15s",
            fontStyle: isBeingDragged ? "italic" : "normal",
            // Force transparent when the outer wrapper is highlighting itself —
            // otherwise the lingering inline `T.bgSub` set by mouseEnter (which
            // doesn't get cleared because mouse events are suppressed during a
            // drag) would cover the green drop highlight underneath.
            background: isOver ? "transparent" : undefined,
          }}
          onMouseEnter={e => { if (!isOver) e.currentTarget.style.background = T.bgSub; }}
          onMouseLeave={e => { if (!isOver) e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{
            flexShrink: 0, transition: "transform 0.15s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
            color: T.textLight
          }}>
            <polygon points="6 4 18 12 6 20" />
          </svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setRenamingFolderId(null); setRenameValue(""); }
              }}
              onClick={e => e.stopPropagation()}
              style={inputStyle(T)}
            />
          ) : (
            <span style={{
              flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>{folder.name}</span>
          )}
          {/* Contextual drop label that tells the user exactly what will happen */}
          {isOver && dragSource && dragSource.id !== folder.id && (
            <span style={{
              flexShrink: 0,
              padding: "2px 8px", borderRadius: 999,
              background: T.good, color: "#fff",
              fontSize: 10, fontWeight: 600, fontFamily: T.fontBody,
              letterSpacing: 0.2, animation: "fadeIn 0.12s ease",
              display: "inline-flex", alignItems: "center", gap: 4,
              maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Move here
            </span>
          )}
        </div>
        {/* Animated expand/collapse using the CSS grid 0fr→1fr trick.
            Children stay mounted (so swipes/drags don't tear) but get
            clipped to 0 height when the folder collapses. */}
        <div style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            {subfolders.map(f => renderFolder(f, depth + 1))}
            {folderDocs.map(d => renderDoc(d, depth + 1))}
            {folderDecks.map(d => renderDeckInTree(d, depth + 1))}
            {subfolders.length === 0 && folderDocs.length === 0 && folderDecks.length === 0 && (
              <div style={{
                padding: `4px 10px 4px ${10 + (depth + 1) * 14}px`,
                fontSize: 12, color: T.textLight, fontStyle: "italic"
              }}>Empty</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // A deck inside the folder tree. Same shape as a document row but with a
  // stacked-cards icon and a tiny "due" badge so users can tell types apart
  // at a glance per our design principles (canonical view = folder tree,
  // distinct glyph for distinct entity).
  const renderDeckInTree = (deck, depth = 0) => {
    const dueCount = deck.cards.filter(c => c.nextReview <= Date.now()).length;
    const isSelected = selectedDeckId === deck.id;
    const isRenaming = renamingItem?.type === "deck" && renamingItem.id === deck.id;
    const isBeingDragged = dragSource?.type === "deck" && dragSource.id === deck.id;
    return (
      <div
        key={`tree-${deck.id}`}
        draggable={!isRenaming}
        onDragStart={e => onDragStartDeck(e, deck)}
        onDragEnd={onDragEndAny}
        onClick={() => !isRenaming && onSelectDeck(deck.id)}
        onContextMenu={e => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, type: "deck", id: deck.id, name: deck.name });
        }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: `5px 10px 5px ${10 + depth * 14}px`,
          borderRadius: 6, cursor: isRenaming ? "text" : "pointer",
          background: isSelected ? T.bgSub : "transparent",
          color: isSelected ? T.text : T.textMid,
          fontSize: 13.5, fontFamily: T.fontBody,
          fontWeight: isSelected ? 600 : 400,
          transition: "background 0.15s, opacity 0.15s", userSelect: "none",
          opacity: isBeingDragged ? 0.35 : 1,
          fontStyle: isBeingDragged ? "italic" : "normal",
        }}
        onMouseEnter={e => { if (!isSelected && !isRenaming && !isBeingDragged) e.currentTarget.style.background = T.bgSub; }}
        onMouseLeave={e => { if (!isSelected && !isRenaming && !isBeingDragged) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ width: 10, flexShrink: 0 }} />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="6" y="3" width="14" height="16" rx="2" />
          <path d="M4 7v12a2 2 0 0 0 2 2h12" />
        </svg>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitItemRename}
            onKeyDown={e => {
              if (e.key === "Enter") commitItemRename();
              if (e.key === "Escape") cancelItemRename();
            }}
            onClick={e => e.stopPropagation()}
            style={inputStyle(T)}
          />
        ) : (
          <>
            <span style={{
              flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>{deck.name}</span>
            {dueCount > 0 && (
              <span style={{
                flexShrink: 0, fontSize: 11, fontWeight: 600, color: T.due,
                padding: "0 5px"
              }}>{dueCount}</span>
            )}
          </>
        )}
      </div>
    );
  };

  const renderDoc = (doc, depth = 0) => {
    const isSelected = selectedDocId === doc.id;
    const isRenaming = renamingItem?.type === "doc" && renamingItem.id === doc.id;
    const isBeingDragged = dragSource?.type === "doc" && dragSource.id === doc.id;
    return (
      <div
        key={doc.id}
        draggable={!isRenaming}
        onDragStart={e => onDragStartDoc(e, doc)}
        onDragEnd={onDragEndAny}
        onClick={() => !isRenaming && onSelectDocument(doc.id)}
        onContextMenu={e => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, type: "document", id: doc.id, name: doc.title });
        }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: `5px 10px 5px ${10 + depth * 14}px`,
          borderRadius: 6, cursor: isRenaming ? "text" : "pointer",
          background: isSelected ? T.bgSub : "transparent",
          color: isSelected ? T.text : T.textMid,
          fontSize: 13.5, fontFamily: T.fontBody, fontWeight: isSelected ? 600 : 400,
          transition: "background 0.15s, opacity 0.15s",
          userSelect: "none",
          // Dim + italic the row while it's being dragged so the user clearly
          // sees what they're moving
          opacity: isBeingDragged ? 0.35 : 1,
          fontStyle: isBeingDragged ? "italic" : "normal",
        }}
        onMouseEnter={e => { if (!isSelected && !isRenaming && !isBeingDragged) e.currentTarget.style.background = T.bgSub; }}
        onMouseLeave={e => { if (!isSelected && !isRenaming && !isBeingDragged) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ width: 10, flexShrink: 0 }} />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitItemRename}
            onKeyDown={e => {
              if (e.key === "Enter") commitItemRename();
              if (e.key === "Escape") cancelItemRename();
            }}
            onClick={e => e.stopPropagation()}
            style={inputStyle(T)}
          />
        ) : (
          <span style={{
            flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>{doc.title}</span>
        )}
      </div>
    );
  };

  const renderDeckRow = (deck) => {
    const dueCount = deck.cards.filter(c => c.nextReview <= Date.now()).length;
    const isRenaming = renamingItem?.type === "deck" && renamingItem.id === deck.id;
    const isBeingDragged = dragSource?.type === "deck" && dragSource.id === deck.id;
    return (
      <div
        key={deck.id}
        draggable={!isRenaming}
        onDragStart={e => onDragStartDeck(e, deck)}
        onDragEnd={onDragEndAny}
        onClick={() => !isRenaming && onSelectDeck(deck.id)}
        onContextMenu={e => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, type: "deck", id: deck.id, name: deck.name });
        }}
        title={deck.folderId ? `In folder: drag into another folder or back to Decks to remove` : "Drag into a folder to organize"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "5px 10px", borderRadius: 6, cursor: isRenaming ? "text" : "pointer",
          fontFamily: T.fontBody, transition: "background 0.15s, opacity 0.15s",
          // Two reasons a deck can look dimmed:
          //  - It's already filed in a folder (kept at 0.7 baseline)
          //  - It's currently being dragged (drop to 0.35 + italic)
          opacity: isBeingDragged ? 0.35 : (deck.folderId ? 0.7 : 1),
          fontStyle: isBeingDragged ? "italic" : "normal",
        }}
        onMouseEnter={e => { if (!isRenaming && !isBeingDragged) e.currentTarget.style.background = T.bgSub; }}
        onMouseLeave={e => { if (!isRenaming && !isBeingDragged) e.currentTarget.style.background = "transparent"; }}
      >
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitItemRename}
            onKeyDown={e => {
              if (e.key === "Enter") commitItemRename();
              if (e.key === "Escape") cancelItemRename();
            }}
            onClick={e => e.stopPropagation()}
            style={{ ...inputStyle(T), marginLeft: 10 }}
          />
        ) : (
          <>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 13.5, color: T.text, fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              paddingLeft: 10
            }}>{deck.name}</span>
            <span style={{
              flexShrink: 0, fontSize: 12, fontWeight: 600,
              color: dueCount > 0 ? T.due : T.textLight
            }}>
              {dueCount > 0 ? `${dueCount} due` : "Clear"}
            </span>
          </>
        )}
      </div>
    );
  };

  const rootFolders = childFolders.get("root") || [];
  const rootDocs = docsByFolder.get("root") || [];
  // Decks at the library root deliberately don't render in the Library
  // section — they only appear in the flat "Decks" section below. A deck
  // only shows in the Library tree once you drag it INTO a folder, which
  // is the user's signal that it's been organized. Inspired by how
  // Music/iTunes treats playlists: a flat list by default, with optional
  // folder grouping above.

  return (
    <div style={{
      // Outer wrapper owns the width animation. Both inner layouts are
      // always rendered (so React never unmounts them mid-transition) and
      // crossfaded via opacity. overflow: hidden clips whichever layout
      // is currently outside the visible width.
      width: open ? 260 : 48,
      flexShrink: 0, height: "100%",
      borderRight: `1px solid ${T.border}`,
      background: T.card,
      overflow: "hidden",
      position: "relative",
      transition: "width 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      {/* COLLAPSED RAIL LAYER — fades out when sidebar opens. */}
      <div style={{
        position: "absolute", inset: 0,
        width: 48,
        display: "flex", flexDirection: "column",
        alignItems: "center", paddingTop: 10, gap: 8,
        opacity: open ? 0 : 1,
        pointerEvents: open ? "none" : "auto",
        transition: "opacity 0.18s ease",
      }}>
        {railLayout}
      </div>
      {/* FULL SIDEBAR LAYER */}
      <div style={{
        position: "absolute", inset: 0,
        width: 260,
        display: "flex", flexDirection: "column",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.18s ease",
      }}>
      {/* HEADER: just the collapse toggle now — Ostinote logo lives in the
          app-level top bar above the workspace. */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "10px 10px 6px", flexShrink: 0
      }}>
        <IconButton onClick={onToggleOpen} title="Hide library" T={T}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </IconButton>
      </div>

      {/* SEARCH */}
      <div style={{ padding: "0 10px 10px", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 6,
          background: T.bgSub, border: `1px solid ${T.border}`,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            style={{
              flex: 1, minWidth: 0, border: "none", outline: "none",
              background: "transparent", color: T.text, fontFamily: T.fontBody,
              fontSize: 13.5
            }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: T.textLight, display: "flex" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* SCROLLABLE BODY: Library + Decks.
          Doubles as the "root" drop target — anything dropped on empty space
          (not on a specific folder) gets re-parented to the library root. */}
      <div
        style={{
          flex: 1, overflowY: "auto", padding: "4px 6px 8px",
          // Subtle background wash (no border) when the cursor is over empty
          // body space during a drag, so the user can tell "drop here = root"
          // is valid even when no folder lights up.
          background: dragOverFolder === "root" && dragSource
            ? `${T.good}1A`
            : "transparent",
          transition: "background 0.12s",
        }}
        onDragOver={e => onDragOverFolderEl(e, "root")}
        onDragLeave={onDragLeaveFolderEl}
        onDrop={e => onDropOnFolder(e, "root")}
      >
        {searching ? (
          <SearchResults
            T={T}
            docs={matchingDocs}
            decks={matchingDecks}
            selectedDocId={selectedDocId}
            onSelectDocument={onSelectDocument}
            onSelectDeck={onSelectDeck}
          />
        ) : (
          <>
            {/* LIBRARY section — folder tree of docs (and decks inside folders).
                Collapsable. Upload + New-Folder action buttons embedded in the header. */}
            <SectionHeader
              label="Library" T={T}
              collapsed={sections.library}
              onToggle={() => toggleSection("library")}
              actions={
                <>
                  <SectionAction T={T} title="Upload PDF" onClick={onUploadClick}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </SectionAction>
                  <SectionAction T={T} title="New folder" onClick={startCreateFolder}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                  </SectionAction>
                </>
              }
            />
            {/* Section content uses the same grid 0fr→1fr animation trick
                as the folder expand. `sections.library === true` means
                COLLAPSED (the state key is inverted historically). */}
            <div style={{
              display: "grid",
              gridTemplateRows: sections.library ? "0fr" : "1fr",
              transition: "grid-template-rows 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              <div style={{ minHeight: 0, overflow: "hidden" }}>
                {rootFolders.length === 0 && rootDocs.length === 0 && !creatingFolder ? (
                  <div style={{
                    padding: "6px 12px 12px", fontSize: 12.5, color: T.textLight,
                    fontFamily: T.fontBody, lineHeight: 1.5
                  }}>
                    Click <strong>↑</strong> to upload a PDF or <strong>+folder</strong> to start organizing.
                  </div>
                ) : (
                  <>
                    {rootFolders.map(f => renderFolder(f, 0))}
                    {rootDocs.map(d => renderDoc(d, 0))}
                  </>
                )}
                {creatingFolder && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                    <span style={{ width: 10, flexShrink: 0 }} />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <input
                      ref={newFolderInputRef}
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onBlur={commitCreateFolder}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitCreateFolder();
                        if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                      }}
                      placeholder="Folder name"
                      style={inputStyle(T)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* DECKS section — collapsable */}
            <div style={{ height: 12 }} />
            <SectionHeader
              label="Decks" T={T}
              collapsed={sections.decks}
              onToggle={() => toggleSection("decks")}
            />
            <div style={{
              display: "grid",
              gridTemplateRows: sections.decks ? "0fr" : "1fr",
              transition: "grid-template-rows 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              <div style={{ minHeight: 0, overflow: "hidden" }}>
                {(decks || []).length === 0 ? (
                  <div style={{
                    padding: "6px 12px 12px", fontSize: 12.5, color: T.textLight,
                    fontFamily: T.fontBody, lineHeight: 1.5
                  }}>
                    No decks yet — create cards from a document.
                  </div>
                ) : (
                  (decks || []).map(renderDeckRow)
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Settings + Profile moved to the app top bar; no footer needed. */}
      </div>{/* /full sidebar layer */}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} T={T}
          items={buildContextMenuItems(contextMenu, {
            folders, documents, decks,
            onSelectDocument, onSelectDeck,
            onRenameDocument, onRenameDeck,
            onDeleteDocument, onDeleteDeck, onDeleteFolder,
            startItemRename, startRename,
            setMoveTarget, setTagTarget,
          })}
        />
      )}

      {/* Move-to-folder modal */}
      {moveTarget && (
        <MoveModal
          T={T}
          item={moveTarget}
          folders={folders}
          onCancel={() => setMoveTarget(null)}
          onMove={(targetFolderId) => {
            if (moveTarget.type === "doc") onMoveDocument(moveTarget.id, targetFolderId);
            else if (moveTarget.type === "deck" && onMoveDeck) onMoveDeck(moveTarget.id, targetFolderId);
            else if (moveTarget.type === "folder") onMoveFolder(moveTarget.id, targetFolderId);
            setMoveTarget(null);
          }}
        />
      )}

      {/* Tag editor modal */}
      {tagTarget && (
        <TagModal
          T={T}
          item={tagTarget}
          // Suggest tags that already exist across documents and decks
          suggestions={collectTagSuggestions(documents, decks)}
          onCancel={() => setTagTarget(null)}
          onSave={(tags) => {
            if (tagTarget.type === "doc" && onTagDocument) onTagDocument(tagTarget.id, tags);
            else if (tagTarget.type === "deck" && onTagDeck) onTagDeck(tagTarget.id, tags);
            setTagTarget(null);
          }}
        />
      )}
    </div>
  );
}

// Build the menu items shown on right-click. Documents, decks, and folders
// share the same five verbs (Open / Rename / Move / Tag / Delete) but each
// type maps them to different handlers. Folder gets the "Tag" item hidden
// since folders themselves aren't tagged in our model.
function buildContextMenuItems(contextMenu, h) {
  if (contextMenu.type === "document") {
    const doc = h.documents.find(d => d.id === contextMenu.id);
    return [
      { label: "Open",   onClick: () => h.onSelectDocument(contextMenu.id) },
      { label: "Rename", onClick: () => h.startItemRename("doc", contextMenu.id, contextMenu.name) },
      { label: "Move…",  onClick: () => h.setMoveTarget({ type: "doc", id: contextMenu.id, name: contextMenu.name, currentFolderId: doc?.folderId || null }) },
      { label: "Tag…",   onClick: () => h.setTagTarget({ type: "doc", id: contextMenu.id, name: contextMenu.name, tags: doc?.tags || [] }) },
      { label: "Delete", danger: true, onClick: () => h.onDeleteDocument(contextMenu.id) },
    ];
  }
  if (contextMenu.type === "deck") {
    const deck = h.decks?.find(d => d.id === contextMenu.id);
    return [
      { label: "Open",   onClick: () => h.onSelectDeck(contextMenu.id) },
      { label: "Rename", onClick: () => h.startItemRename("deck", contextMenu.id, contextMenu.name) },
      { label: "Move…",  onClick: () => h.setMoveTarget({ type: "deck", id: contextMenu.id, name: contextMenu.name, currentFolderId: deck?.folderId || null }) },
      { label: "Tag…",   onClick: () => h.setTagTarget({ type: "deck", id: contextMenu.id, name: contextMenu.name, tags: deck?.tags || [] }) },
      { label: "Delete", danger: true, onClick: () => h.onDeleteDeck?.(contextMenu.id) },
    ];
  }
  // folder
  const folder = h.folders.find(f => f.id === contextMenu.id);
  return [
    { label: "Rename", onClick: () => folder && h.startRename(folder) },
    { label: "Move…",  onClick: () => h.setMoveTarget({ type: "folder", id: contextMenu.id, name: folder?.name || "Folder", currentFolderId: folder?.parentId || null }) },
    { label: "Delete", danger: true, onClick: () => h.onDeleteFolder(contextMenu.id) },
  ];
}

function collectTagSuggestions(documents, decks) {
  const set = new Set();
  documents.forEach(d => (d.tags || []).forEach(t => set.add(t)));
  (decks || []).forEach(d => (d.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

// ---- Subcomponents ----

// Collapsable section header with chevron + optional embedded actions on
// the right (e.g. + Upload / + Folder). Clicking the label area toggles;
// the action buttons stop propagation so they don't trigger collapse.
function SectionHeader({ label, T, collapsed, onToggle, actions }) {
  const isInteractive = !!onToggle;
  return (
    <div
      onClick={onToggle}
      role={isInteractive ? "button" : undefined}
      aria-expanded={isInteractive ? !collapsed : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 8px 5px 8px", borderRadius: 6,
        cursor: isInteractive ? "pointer" : "default",
        color: T.textLight, fontFamily: T.fontBody,
        fontSize: 11, fontWeight: 700,
        letterSpacing: 0.8, textTransform: "uppercase",
        userSelect: "none", transition: "color 0.1s",
      }}
      onMouseEnter={e => { if (isInteractive) e.currentTarget.style.color = T.textMid; }}
      onMouseLeave={e => { if (isInteractive) e.currentTarget.style.color = T.textLight; }}
    >
      {isInteractive && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{
          flexShrink: 0, transition: "transform 0.15s",
          transform: collapsed ? "rotate(0)" : "rotate(90deg)",
        }}>
          <polygon points="6 4 18 12 6 20" />
        </svg>
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {actions && (
        <span onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 2 }}>
          {actions}
        </span>
      )}
    </div>
  );
}

// Small icon-only button used inside section headers. Tooltip via title attr.
function SectionAction({ T, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 22, height: 22, borderRadius: 6,
        border: "none", background: "transparent",
        cursor: "pointer", color: T.textMid,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, transition: "background 0.15s ease, color 0.15s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMid; }}
    >{children}</button>
  );
}

function SearchResults({ T, docs, decks, selectedDocId, onSelectDocument, onSelectDeck }) {
  const hasDocs = (docs?.length || 0) > 0;
  const hasDecks = (decks?.length || 0) > 0;
  if (!hasDocs && !hasDecks) {
    return (
      <div style={{
        padding: "20px 12px", textAlign: "center",
        fontSize: 13, color: T.textLight, fontFamily: T.fontBody
      }}>No matches</div>
    );
  }
  return (
    <>
      {hasDocs && (
        <>
          <SectionHeader label={`Documents · ${docs.length}`} T={T} />
          {docs.map(d => (
            <div
              key={d.id}
              onClick={() => onSelectDocument(d.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                background: selectedDocId === d.id ? T.bgSub : "transparent",
                color: selectedDocId === d.id ? T.text : T.textMid,
                fontSize: 13.5, fontFamily: T.fontBody,
                fontWeight: selectedDocId === d.id ? 600 : 400,
              }}
              onMouseEnter={e => { if (selectedDocId !== d.id) e.currentTarget.style.background = T.bgSub; }}
              onMouseLeave={e => { if (selectedDocId !== d.id) e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{
                flex: 1, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>{d.title}</span>
            </div>
          ))}
        </>
      )}
      {hasDecks && (
        <>
          {hasDocs && <div style={{ height: 14 }} />}
          <SectionHeader label={`Decks · ${decks.length}`} T={T} />
          {decks.map(d => {
            const dueCount = d.cards.filter(c => c.nextReview <= Date.now()).length;
            return (
              <div
                key={d.id}
                onClick={() => onSelectDeck(d.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                  fontFamily: T.fontBody, transition: "background 0.1s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.bgSub}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ flex: 1, fontSize: 13.5, color: T.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: dueCount > 0 ? T.due : T.textLight }}>
                  {dueCount > 0 ? `${dueCount} due` : "Clear"}
                </span>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function IconButton({ onClick, title, children, T }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 28, height: 28, borderRadius: 6,
        border: "none", background: "transparent",
        cursor: "pointer", color: T.textMid,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMid; }}
    >{children}</button>
  );
}

function FooterButton({ onClick, T, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "7px 10px", borderRadius: 6,
        border: `1px solid ${T.border}`, background: "transparent",
        color: T.textMid, fontSize: 12, fontWeight: 500, fontFamily: T.fontBody,
        cursor: "pointer", transition: "all 0.1s"
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderStrong; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMid; e.currentTarget.style.borderColor = T.border; }}
    >{children}</button>
  );
}

function ContextMenu({ x, y, items, T }) {
  return (
    <div style={{
      position: "fixed", top: y, left: x, zIndex: 1000,
      background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2,
      borderRadius: 6, padding: 4, minWidth: 160, fontFamily: T.fontBody,
      animation: "fadeIn 0.1s ease"
    }}>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          style={{
            display: "block", width: "100%", textAlign: "left",
            padding: "7px 10px", borderRadius: 4,
            border: "none", background: "transparent",
            color: item.danger ? T.due : T.text,
            fontSize: 12, fontWeight: 500, fontFamily: T.fontBody,
            cursor: "pointer"
          }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? `${T.due}15` : T.bgSub}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >{item.label}</button>
      ))}
    </div>
  );
}

const inputStyle = (T) => ({
  flex: 1, padding: "2px 6px", borderRadius: 4,
  border: `1px solid ${T.borderStrong}`, background: T.inputBg,
  fontSize: 12, fontFamily: T.fontBody, color: T.text,
  outline: "none", minWidth: 0
});

function isDescendant(ancestorId, candidateParentId, folders) {
  let current = candidateParentId;
  while (current) {
    if (current === ancestorId) return true;
    const folder = folders.find(f => f.id === current);
    current = folder?.parentId || null;
  }
  return false;
}

// ---- Modals ----

// Folder picker for the "Move…" context-menu action.
// Shows a flat list of folders with indentation indicating hierarchy.
// "(no folder)" option moves the item back to root.
function MoveModal({ T, item, folders, onMove, onCancel }) {
  // Folders sorted by indentation depth via a recursive flatten
  const flatTree = useMemo(() => flattenFolders(folders), [folders]);

  // For folders being moved: filter out their own descendants to prevent cycles
  const cycleSafeTree = useMemo(() => {
    if (item.type !== "folder") return flatTree;
    return flatTree.filter(f => !isDescendant(item.id, f.id, folders) && f.id !== item.id);
  }, [flatTree, item, folders]);

  const [selected, setSelected] = useState(item.currentFolderId || null);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  // Auto-focus the search input when the modal opens — user can immediately
  // type to filter without having to click first.
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Apply search filter on top of the cycle-safe tree. We do a flat
  // case-insensitive substring match — when searching, hierarchy indentation
  // is preserved for readability but non-matching folders just disappear.
  const q = search.trim().toLowerCase();
  const visibleTree = useMemo(() => {
    if (!q) return cycleSafeTree;
    return cycleSafeTree.filter(f => f.name.toLowerCase().includes(q));
  }, [cycleSafeTree, q]);

  // The "No folder (top level)" pseudo-row matches if its label substrings hit.
  const rootLabel = "No folder (top level)";
  const rootMatchesSearch = !q || "root no folder top level".includes(q);

  const totalMatches = visibleTree.length + (rootMatchesSearch ? 1 : 0);

  return (
    <ModalShell T={T} onCancel={onCancel} title={`Move "${item.name}"`} maxWidth={420}>
      {/* Search input — same visual treatment as the sidebar search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", marginBottom: 10,
        borderRadius: T.radius,
        background: T.bgSub, border: `1px solid ${T.border}`,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") {
              if (search) { setSearch(""); }
              else onCancel();
            }
            // Enter on a single-match list = pick that match
            if (e.key === "Enter" && totalMatches === 1) {
              e.preventDefault();
              if (visibleTree.length === 1) {
                onMove(visibleTree[0].id);
              } else if (rootMatchesSearch) {
                onMove(null);
              }
            }
          }}
          placeholder="Search folders…"
          style={{
            flex: 1, minWidth: 0, border: "none", outline: "none",
            background: "transparent", color: T.text, fontFamily: T.fontBody,
            fontSize: 13
          }}
        />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: T.textLight, display: "flex" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div style={{
        maxHeight: 280, overflowY: "auto",
        border: `1px solid ${T.border}`, borderRadius: T.radius,
        background: T.inputBg
      }}>
        {rootMatchesSearch && (
          <FolderChoice
            T={T} label={rootLabel} depth={0}
            selected={selected === null}
            onClick={() => setSelected(null)}
            isCurrent={item.currentFolderId === null || item.currentFolderId === undefined}
          />
        )}
        {visibleTree.map(f => (
          <FolderChoice
            key={f.id} T={T} label={f.name} depth={q ? 0 : f.depth}
            selected={selected === f.id}
            onClick={() => setSelected(f.id)}
            isCurrent={item.currentFolderId === f.id}
          />
        ))}
        {totalMatches === 0 && (
          <div style={{ padding: 14, fontSize: 12, color: T.textLight, textAlign: "center" }}>
            {q ? `No folders match "${search}"` : "No other folders available"}
          </div>
        )}
      </div>

      {/* Quick action hint when there's an exact single match */}
      {q && totalMatches === 1 && (
        <div style={{
          marginTop: 8, fontSize: 11, color: T.textLight, fontFamily: T.fontBody,
          textAlign: "center", letterSpacing: 0.2
        }}>
          Press <strong style={{ color: T.text }}>Enter</strong> to move here
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <ModalBtn T={T} onClick={onCancel}>Cancel</ModalBtn>
        <ModalBtn T={T} primary
          disabled={selected === (item.currentFolderId || null)}
          onClick={() => onMove(selected)}>Move</ModalBtn>
      </div>
    </ModalShell>
  );
}

function FolderChoice({ T, label, depth, selected, onClick, isCurrent }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", textAlign: "left",
        padding: `8px 12px 8px ${12 + depth * 16}px`,
        border: "none",
        background: selected ? T.bgSub : "transparent",
        color: T.text, fontSize: 13, fontFamily: T.fontBody, fontWeight: selected ? 600 : 400,
        cursor: "pointer", transition: "background 0.1s",
        borderBottom: `1px solid ${T.border}`
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = T.bgSub; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {isCurrent && (
        <span style={{ fontSize: 10, color: T.textLight, fontWeight: 500 }}>current</span>
      )}
    </button>
  );
}

// Tag editor: chip-based add/remove plus suggestions from existing tags.
function TagModal({ T, item, suggestions, onSave, onCancel }) {
  const [tags, setTags] = useState(item.tags || []);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addTag = (t) => {
    const v = t.trim().toLowerCase();
    if (!v || tags.includes(v)) return;
    setTags([...tags, v]);
    setInput("");
  };
  const removeTag = (t) => setTags(tags.filter(x => x !== t));

  const availableSuggestions = suggestions.filter(s => !tags.includes(s));

  return (
    <ModalShell T={T} onCancel={onCancel} title={`Tags for "${item.name}"`} maxWidth={420}>
      {/* Existing tags */}
      <div style={{
        minHeight: 40, padding: 8, borderRadius: T.radius,
        border: `1px solid ${T.border}`, background: T.inputBg,
        display: "flex", flexWrap: "wrap", gap: 6
      }}>
        {tags.length === 0 && (
          <span style={{ fontSize: 12, color: T.textLight, fontFamily: T.fontBody, padding: "3px 4px" }}>
            No tags yet
          </span>
        )}
        {tags.map(t => (
          <span key={t} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 999,
            background: `${T.easy}15`, color: T.easy,
            fontSize: 11, fontWeight: 600, fontFamily: T.fontBody
          }}>
            {t}
            <button onClick={() => removeTag(t)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", display: "flex" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Add tag input */}
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); addTag(input); }
            if (e.key === "," || e.key === " ") { e.preventDefault(); addTag(input); }
          }}
          placeholder="Type a tag and press Enter"
          style={{
            flex: 1, padding: "8px 12px", borderRadius: T.radius,
            border: `1px solid ${T.border}`, background: T.inputBg,
            fontSize: 13, fontFamily: T.fontBody, color: T.text, outline: "none"
          }}
        />
        <ModalBtn T={T} onClick={() => addTag(input)} disabled={!input.trim()}>Add</ModalBtn>
      </div>

      {/* Suggestions */}
      {availableSuggestions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
            color: T.textLight, marginBottom: 6, fontFamily: T.fontBody
          }}>Suggestions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {availableSuggestions.slice(0, 12).map(s => (
              <button key={s} onClick={() => addTag(s)} style={{
                padding: "3px 10px", borderRadius: 999,
                border: `1px dashed ${T.border}`, background: "transparent",
                fontSize: 11, color: T.textMid, cursor: "pointer",
                fontFamily: T.fontBody, transition: "all 0.1s"
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <ModalBtn T={T} onClick={onCancel}>Cancel</ModalBtn>
        <ModalBtn T={T} primary onClick={() => onSave(tags)}>Save</ModalBtn>
      </div>
    </ModalShell>
  );
}

// Generic modal wrapper — keeps consistent look across both modals.
function ModalShell({ T, title, onCancel, maxWidth, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: T.modalOverlay, backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, animation: "fadeIn 0.15s ease"
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: T.radiusLg,
        border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow3,
        padding: "20px 22px", maxWidth, width: "100%",
        fontFamily: T.fontBody
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalBtn({ T, primary, disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "8px 18px", borderRadius: T.radius,
      border: primary ? "none" : `1.5px solid ${T.border}`,
      background: primary ? (disabled ? T.bgSub : T.text) : T.card,
      color: primary ? (disabled ? T.textLight : T.card) : T.textMid,
      fontWeight: 600, fontSize: 12, fontFamily: T.fontBody,
      cursor: disabled ? "default" : "pointer",
      transition: "all 0.15s",
      opacity: disabled && !primary ? 0.5 : 1,
    }}>{children}</button>
  );
}

// Flatten folder tree into a depth-tagged ordered list, useful for the
// MoveModal where we want to indent without rendering an interactive tree.
function flattenFolders(folders) {
  const byParent = new Map();
  folders.forEach(f => {
    const key = f.parentId || "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(f);
  });
  const result = [];
  function walk(parentId, depth) {
    const kids = byParent.get(parentId) || [];
    for (const f of kids) {
      result.push({ ...f, depth });
      walk(f.id, depth + 1);
    }
  }
  walk("root", 0);
  return result;
}
