import { useState } from "react";
import useTheme from "../../theme/useTheme.js";
import useAuth from "../../auth/useAuth.js";
import NavBar from "../../components/NavBar/NavBar.jsx";
import { PROVIDERS } from "../../utils/aiGrader.js";
import { deleteDoc, doc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { db } from "../../firebase.js";

export default function SettingsView({ aiSettings, setAiSettings, syncStatus, onNavigate, onHelpOpen, onReplayOnboarding }) {
  const { T } = useTheme();
  const { user, loading, signInWithGoogle, signInWithApple, signOut } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  const provider = PROVIDERS[aiSettings.provider] || PROVIDERS.anthropic;

  const updateSetting = (key, value) => {
    setAiSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === "provider") {
        next.model = PROVIDERS[value].defaultModel;
        next.apiKey = "";
      }
      return next;
    });
  };

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      const { gradeAnswer } = await import("../../utils/aiGrader.js");
      await gradeAnswer(aiSettings, 'Respond ONLY with this exact JSON: {"rating": 5, "label": "Perfect", "explanation": "Connection test successful."}');
      setTestStatus("success");
    } catch (err) {
      setTestStatus("error: " + (err.message || "Unknown error"));
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try { await signInWithGoogle(); } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") setAuthError(err.message);
    }
  };

  const handleAppleSignIn = async () => {
    setAuthError(null);
    try { await signInWithApple(); } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try { await signOut(); } catch (err) { setAuthError(err.message); }
  };

  const sectionBox = (children) => (
    <div style={{
      padding: "18px 20px", borderRadius: T.radiusLg,
      background: T.card, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow2,
      marginBottom: 16
    }}>
      {children}
    </div>
  );

  const labelStyle = { fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 8, display: "block" };

  const syncDot = syncStatus === "synced" ? T.good : syncStatus === "syncing" ? T.textMid : syncStatus === "error" ? T.due : T.textLight;
  const syncLabel = syncStatus === "synced" ? "Synced" : syncStatus === "syncing" ? "Syncing..." : syncStatus === "error" ? "Sync error" : "Local only";

  const dangerColor = T.danger || "#c0392b";

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDoc(doc(db, "users", user.uid, "data", "decks"));
      await deleteUser(user);
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setDeleteError("For security, you need to sign out, sign back in, and try again.");
      } else {
        setDeleteError(err.message || "An error occurred while deleting your account.");
      }
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div style={containerStyle}>
      <NavBar view="settings" onNavigate={onNavigate} onHelpOpen={onHelpOpen} />

      <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody, marginBottom: 24 }}>
        Account, cloud sync, and AI grading
      </p>

      <div style={{ animation: "fadeIn 0.4s ease" }}>

        {/* Account Section */}
        {sectionBox(<>
          <label style={labelStyle}>Account</label>
          {loading ? (
            <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody }}>Loading...</p>
          ) : user ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                {user.photoURL && (
                  <img src={user.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} referrerPolicy="no-referrer" />
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>{user.displayName || "User"}</div>
                  <div style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody }}>{user.email}</div>
                </div>
              </div>
              <div aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: syncDot }} />
                <span style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody }}>{syncLabel}</span>
              </div>
              <button onClick={handleSignOut} style={{
                padding: "10px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                background: T.card, color: T.textMid, fontWeight: 600, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s"
              }}>Sign Out</button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, marginBottom: 14, lineHeight: 1.5 }}>
                Sign in to sync your decks across devices. Your data is stored securely in the cloud.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={handleGoogleSignIn} style={{
                  padding: "12px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                  background: T.card, color: T.text, fontWeight: 600, fontSize: 13,
                  cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 8, flex: "1 1 0", justifyContent: "center"
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </button>
                <button onClick={handleAppleSignIn} style={{
                  padding: "12px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                  background: T.card, color: T.text, fontWeight: 600, fontSize: 13,
                  cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 8, flex: "1 1 0", justifyContent: "center"
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Apple
                </button>
              </div>
            </div>
          )}
          {authError && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: T.radius,
              background: T.dueBg, color: T.due, fontSize: 12, fontWeight: 500, fontFamily: T.fontBody
            }}>{authError}</div>
          )}
        </>)}

        {/* Provider Selection */}
        {sectionBox(<>
          <label style={labelStyle}>AI Provider</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(PROVIDERS).map(([key, p]) => (
              <button key={key} onClick={() => updateSetting("provider", key)} style={{
                padding: "10px 16px", borderRadius: T.radius, cursor: "pointer",
                border: aiSettings.provider === key ? `2px solid ${T.good}` : `1.5px solid ${T.border}`,
                background: aiSettings.provider === key ? T.goodBg : T.card,
                color: aiSettings.provider === key ? T.good : T.textMid,
                fontWeight: 600, fontSize: 13, fontFamily: T.fontBody,
                transition: "all 0.15s", flex: "1 1 0", minWidth: 140, textAlign: "center"
              }}>{p.name}</button>
            ))}
          </div>
        </>)}

        {/* Model Selection */}
        {sectionBox(<>
          <label style={labelStyle}>Model</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {provider.models.map(m => (
              <button key={m} onClick={() => updateSetting("model", m)} style={{
                padding: "8px 14px", borderRadius: T.radius, cursor: "pointer",
                border: aiSettings.model === m ? `2px solid ${T.good}` : `1.5px solid ${T.border}`,
                background: aiSettings.model === m ? T.goodBg : T.card,
                color: aiSettings.model === m ? T.good : T.textMid,
                fontWeight: 500, fontSize: 12, fontFamily: T.fontBody,
                transition: "all 0.15s"
              }}>{m}</button>
            ))}
          </div>
        </>)}

        {/* API Key */}
        {sectionBox(<>
          <label style={labelStyle}>API Key</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type={showKey ? "text" : "password"}
              value={aiSettings.apiKey}
              onChange={e => updateSetting("apiKey", e.target.value)}
              placeholder={provider.placeholder}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: T.radius,
                border: `1.5px solid ${T.border}`, background: T.bg,
                color: T.text, fontSize: 13, fontFamily: "monospace",
                outline: "none", transition: "border-color 0.15s"
              }}
              onFocus={e => e.target.style.borderColor = T.borderStrong}
              onBlur={e => e.target.style.borderColor = T.border}
            />
            <button onClick={() => setShowKey(!showKey)} style={{
              padding: "10px 14px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
              background: T.card, color: T.textMid, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: T.fontBody, whiteSpace: "nowrap"
            }}>{showKey ? "Hide" : "Show"}</button>
          </div>
          <p style={{ fontSize: 11, color: T.textLight, fontFamily: T.fontBody, marginTop: 8, lineHeight: 1.5 }}>
            Your API key is stored locally on this device only. It is never sent to our servers.
          </p>
        </>)}

        {/* Test Connection */}
        {sectionBox(<>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>Test Connection</div>
              <p style={{ fontSize: 11, color: T.textLight, fontFamily: T.fontBody, marginTop: 2 }}>
                Verify your API key works
              </p>
            </div>
            <button onClick={testConnection} disabled={!aiSettings.apiKey || testStatus === "testing"} style={{
              padding: "10px 20px", borderRadius: T.radius, border: "none",
              background: aiSettings.apiKey ? T.good : T.bgSub,
              color: aiSettings.apiKey ? "#fff" : T.textLight,
              fontWeight: 600, fontSize: 13, cursor: aiSettings.apiKey ? "pointer" : "default",
              fontFamily: T.fontBody, transition: "all 0.15s",
              opacity: testStatus === "testing" ? 0.6 : 1
            }}>{testStatus === "testing" ? "Testing..." : "Test"}</button>
          </div>
          {testStatus && testStatus !== "testing" && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: T.radius,
              background: testStatus === "success" ? T.goodBg : T.dueBg,
              color: testStatus === "success" ? T.good : T.due,
              fontSize: 12, fontWeight: 500, fontFamily: T.fontBody
            }}>
              {testStatus === "success" ? "Connection successful!" : testStatus.replace("error: ", "")}
            </div>
          )}
        </>)}

        {/* Help & Tutorials */}
        {sectionBox(<>
          <label style={labelStyle}>Help & Tutorials</label>
          <p style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5, marginBottom: 14 }}>
            Learn how to get the most out of Ostinote
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => onHelpOpen?.()} style={{
              padding: "10px 18px", borderRadius: T.radius,
              border: `1.5px solid ${T.border}`, background: T.card,
              color: T.text, fontWeight: 600, fontSize: 13,
              cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 8
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              View Guides
            </button>
            <button onClick={() => onReplayOnboarding?.()} style={{
              padding: "10px 18px", borderRadius: T.radius,
              border: `1.5px solid ${T.border}`, background: T.card,
              color: T.textMid, fontWeight: 500, fontSize: 13,
              cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 8
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
              Replay Welcome Tour
            </button>
          </div>
        </>)}

        {/* Delete Account Section */}
        {user && (
          <div style={{
            marginTop: 16, paddingTop: 24,
            borderTop: `1px solid ${T.border}`
          }}>
            {sectionBox(<>
              <label style={{ ...labelStyle, color: dangerColor }}>Delete Account</label>
              <p style={{
                fontSize: 12, color: T.textMid, fontFamily: T.fontBody,
                lineHeight: 1.5, marginBottom: 14
              }}>
                Permanently delete your account and all cloud data. This cannot be undone.
              </p>
              <button onClick={() => { setDeleteError(null); setShowDeleteModal(true); }} style={{
                padding: "10px 20px", borderRadius: T.radius, border: "none",
                background: dangerColor, color: "#fff", fontWeight: 600, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s",
                boxShadow: `0 2px 8px ${dangerColor}4d`
              }}>Delete My Account</button>
              {deleteError && (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: T.radius,
                  background: T.dueBg, color: T.due, fontSize: 12, fontWeight: 500,
                  fontFamily: T.fontBody
                }}>{deleteError}</div>
              )}
            </>)}
          </div>
        )}
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: T.modalOverlay, backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, animation: "fadeIn 0.15s ease"
        }} onClick={() => setShowDeleteModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="Delete account confirmation" onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.borderStrong}`,
            boxShadow: T.shadow3, padding: "28px 24px", maxWidth: 360, width: "100%",
            textAlign: "center"
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.fontBody, marginBottom: 8 }}>
              Delete your account?
            </div>
            <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5, marginBottom: 22 }}>
              This will permanently delete your account, remove all your data from the cloud, and sign you out. Your local data will be kept on this device. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowDeleteModal(false)} style={{
                padding: "9px 22px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
                background: T.white, color: T.textMid, fontWeight: 500, fontSize: 13,
                cursor: "pointer", fontFamily: T.fontBody
              }}>Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{
                padding: "9px 22px", borderRadius: T.radius, border: "none",
                background: dangerColor, color: "#fff", fontWeight: 600, fontSize: 13,
                cursor: deleting ? "default" : "pointer", fontFamily: T.fontBody,
                boxShadow: `0 2px 8px ${dangerColor}4d`,
                opacity: deleting ? 0.6 : 1
              }}>{deleting ? "Deleting..." : "Delete Account"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
