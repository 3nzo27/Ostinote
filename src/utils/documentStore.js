// IndexedDB-backed storage for PDF documents, their highlights,
// chat sessions, and the folder tree that organizes them.
//
// documents:  { id, title, textContent, uploadedAt, pageCount, fileSize, hash, hasPdf?, markdown?, folderId?, sortOrder? }
// pdfBlobs:   { docId, buffer (ArrayBuffer) }  — raw PDF kept separate so listing docs stays fast
// highlights: { id, docId, text, page, color, note, createdAt, source }
// chats:      { id, docId, messages: [{role, content, ts}], createdAt, updatedAt }
// folders:    { id, name, parentId, createdAt, sortOrder }

import { openDB } from "idb";

const DB_NAME = "ostinote-documents";
const VERSION = 4;

const STORES = {
  DOCUMENTS: "documents",
  PDF_BLOBS: "pdfBlobs",
  HIGHLIGHTS: "highlights",
  CHATS: "chats",
  FOLDERS: "folders",
};

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    // Note: when modifying existing object stores during an upgrade, use the
    // `transaction` argument (the implicit upgrade tx) — opening a new
    // transaction inside the upgrade handler will abort with
    // "Version change transaction was aborted".
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          const docs = db.createObjectStore(STORES.DOCUMENTS, { keyPath: "id" });
          docs.createIndex("uploadedAt", "uploadedAt");
          docs.createIndex("hash", "hash", { unique: false });
        }
        if (oldVersion < 2) {
          const highlights = db.createObjectStore(STORES.HIGHLIGHTS, { keyPath: "id" });
          highlights.createIndex("docId", "docId");
          highlights.createIndex("createdAt", "createdAt");

          const chats = db.createObjectStore(STORES.CHATS, { keyPath: "id" });
          chats.createIndex("docId", "docId", { unique: true });
        }
        if (oldVersion < 3) {
          const folders = db.createObjectStore(STORES.FOLDERS, { keyPath: "id" });
          folders.createIndex("parentId", "parentId");
          folders.createIndex("sortOrder", "sortOrder");
          // Add folderId index on existing documents store via the upgrade tx
          const docs = transaction.objectStore(STORES.DOCUMENTS);
          if (!docs.indexNames.contains("folderId")) {
            docs.createIndex("folderId", "folderId");
          }
        }
        if (oldVersion < 4) {
          db.createObjectStore(STORES.PDF_BLOBS, { keyPath: "docId" });
        }
      },
    });
  }
  return dbPromise;
}

// ---------- documents ----------

export async function saveDocument(doc) {
  const db = await getDb();
  await db.put(STORES.DOCUMENTS, doc);
  return doc;
}

export async function getDocument(id) {
  const db = await getDb();
  return db.get(STORES.DOCUMENTS, id);
}

export async function listDocuments() {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORES.DOCUMENTS, "uploadedAt");
  return all.reverse();
}

export async function deleteDocument(id) {
  const db = await getDb();
  const tx = db.transaction(
    [STORES.DOCUMENTS, STORES.PDF_BLOBS, STORES.HIGHLIGHTS, STORES.CHATS],
    "readwrite"
  );
  await tx.objectStore(STORES.DOCUMENTS).delete(id);
  await tx.objectStore(STORES.PDF_BLOBS).delete(id).catch(() => {});
  const hIdx = tx.objectStore(STORES.HIGHLIGHTS).index("docId");
  for await (const cursor of hIdx.iterate(id)) await cursor.delete();
  const cIdx = tx.objectStore(STORES.CHATS).index("docId");
  for await (const cursor of cIdx.iterate(id)) await cursor.delete();
  await tx.done;
}

export async function findByHash(hash) {
  const db = await getDb();
  const idx = db.transaction(STORES.DOCUMENTS).store.index("hash");
  return (await idx.get(hash)) || null;
}

// ---------- PDF blobs ----------

export async function savePdfBlob(docId, buffer) {
  const db = await getDb();
  await db.put(STORES.PDF_BLOBS, { docId, buffer });
}

export async function getPdfBlob(docId) {
  const db = await getDb();
  const row = await db.get(STORES.PDF_BLOBS, docId);
  return row?.buffer || null;
}

// ---------- highlights ----------

export async function listHighlights(docId) {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORES.HIGHLIGHTS, "docId", docId);
  return all.sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || a.createdAt - b.createdAt);
}

export async function saveHighlight(h) {
  const db = await getDb();
  await db.put(STORES.HIGHLIGHTS, h);
  return h;
}

export async function deleteHighlight(id) {
  const db = await getDb();
  await db.delete(STORES.HIGHLIGHTS, id);
}

// ---------- chat sessions ----------

export async function getChat(docId) {
  const db = await getDb();
  return (await db.getFromIndex(STORES.CHATS, "docId", docId)) || null;
}

export async function saveChat(chat) {
  const db = await getDb();
  await db.put(STORES.CHATS, chat);
  return chat;
}

export async function clearChat(docId) {
  const existing = await getChat(docId);
  if (!existing) return;
  const db = await getDb();
  await db.delete(STORES.CHATS, existing.id);
}

// ---------- folders ----------
//
// A folder is { id, name, parentId, createdAt, sortOrder }.
// parentId === null means it lives at the library root.
// Folders may be nested arbitrarily — caller is responsible for not creating cycles.

export async function listFolders() {
  const db = await getDb();
  const all = await db.getAll(STORES.FOLDERS);
  return all.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt - b.createdAt);
}

export async function saveFolder(folder) {
  const db = await getDb();
  await db.put(STORES.FOLDERS, folder);
  return folder;
}

// Deletes a folder. Children (subfolders + docs) get re-parented to the
// folder's parent so nothing is lost.
export async function deleteFolder(id) {
  const db = await getDb();
  const folder = await db.get(STORES.FOLDERS, id);
  if (!folder) return;
  const tx = db.transaction([STORES.FOLDERS, STORES.DOCUMENTS], "readwrite");

  // Re-parent child folders
  const fIdx = tx.objectStore(STORES.FOLDERS).index("parentId");
  for await (const cursor of fIdx.iterate(id)) {
    const child = cursor.value;
    child.parentId = folder.parentId;
    await cursor.update(child);
  }
  // Re-parent docs that were inside
  const dIdx = tx.objectStore(STORES.DOCUMENTS).index("folderId");
  for await (const cursor of dIdx.iterate(id)) {
    const doc = cursor.value;
    doc.folderId = folder.parentId;
    await cursor.update(doc);
  }

  await tx.objectStore(STORES.FOLDERS).delete(id);
  await tx.done;
}

// Move a document into a folder (or to root with folderId=null).
export async function moveDocument(docId, folderId) {
  const db = await getDb();
  const doc = await db.get(STORES.DOCUMENTS, docId);
  if (!doc) return;
  doc.folderId = folderId || null;
  await db.put(STORES.DOCUMENTS, doc);
}

// Generic partial update on a document — used for rename, tags, etc.
export async function updateDocument(docId, patch) {
  const db = await getDb();
  const doc = await db.get(STORES.DOCUMENTS, docId);
  if (!doc) return null;
  const updated = { ...doc, ...patch };
  await db.put(STORES.DOCUMENTS, updated);
  return updated;
}

// Move a folder under a new parent (or to root). Caller is responsible for
// not creating cycles (don't move a folder into one of its own descendants).
export async function moveFolder(folderId, newParentId) {
  const db = await getDb();
  const folder = await db.get(STORES.FOLDERS, folderId);
  if (!folder) return;
  folder.parentId = newParentId || null;
  await db.put(STORES.FOLDERS, folder);
}

// ---------- helpers ----------

export async function hashBuffer(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashFile(file) {
  return hashBuffer(await file.arrayBuffer());
}

export function generateId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
