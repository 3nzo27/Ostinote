import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBdXm-JjlSn9LfgELmw65VdXOR6AXNURhg",
  authDomain: "ostinote.firebaseapp.com",
  projectId: "ostinote",
  storageBucket: "ostinote.firebasestorage.app",
  messagingSenderId: "590605428859",
  appId: "1:590605428859:web:11d26944e5db89cc925ade",
  measurementId: "G-T2CZF9H1TG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
