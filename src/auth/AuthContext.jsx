import { createContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { auth, googleProvider, appleProvider } from "../firebase.js";

export const AuthContext = createContext({
  user: null,
  loading: true,
  signInWithGoogle: () => {},
  signInWithApple: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
  const signInWithApple = () => signInWithPopup(auth, appleProvider);
  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
