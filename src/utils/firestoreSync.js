import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

export async function saveDecksToFirestore(uid, decks) {
  await setDoc(doc(db, "users", uid, "data", "decks"), {
    decks,
    updatedAt: serverTimestamp()
  });
}

export async function loadDecksFromFirestore(uid) {
  const snap = await getDoc(doc(db, "users", uid, "data", "decks"));
  if (snap.exists()) return snap.data().decks;
  return null;
}

export function subscribeToDecks(uid, callback) {
  return onSnapshot(doc(db, "users", uid, "data", "decks"), (snap) => {
    if (snap.exists()) callback(snap.data().decks);
  });
}
