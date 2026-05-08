import { useState } from "react";
import useTheme from "../../theme/useTheme.js";
import NavBar from "../../components/NavBar/NavBar.jsx";
import { PROVIDERS } from "../../utils/aiGrader.js";
import LocalAILab from "../../components/LocalAILab/LocalAILab.jsx";

export default function SettingsView({ aiSettings, setAiSettings, syncStatus, onNavigate, onHelpOpen, onReplayOnboarding }) {
  const { T, darkMode, setDarkMode } = useTheme();
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

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

  return (
    <div style={containerStyle}>
      <NavBar view="settings" onNavigate={onNavigate} onHelpOpen={onHelpOpen} />

      <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 14, color: T.textMid, fontFamily: T.fontBody, marginBottom: 24 }}>
        Display, AI grading, and help
      </p>

      <div style={{ animation: "fadeIn 0.4s ease" }}>

        {/* Display / Appearance */}
        {sectionBox(<>
          <label style={labelStyle}>Appearance</label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: T.fontBody }}>Dark Mode</div>
              <div style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, marginTop: 2 }}>
                {darkMode ? "Currently using dark theme" : "Currently using light theme"}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={darkMode}
              aria-label="Toggle dark mode"
              onClick={() => setDarkMode(!darkMode)}
              style={{
                position: "relative",
                width: 48, height: 28, borderRadius: 14,
                border: `1.5px solid ${T.border}`,
                background: darkMode ? T.text : T.bgSub,
                cursor: "pointer", flexShrink: 0,
                transition: "background 0.2s, border-color 0.2s",
                padding: 0
              }}
            >
              <div style={{
                position: "absolute", top: 1, left: darkMode ? 22 : 2,
                width: 22, height: 22, borderRadius: "50%",
                background: darkMode ? T.card : T.text,
                transition: "left 0.2s ease",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {darkMode ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.card} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
                  </svg>
                )}
              </div>
            </button>
          </div>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {provider.models.map(m => {
              // Backward compat: aiSettings.model may be a string ID (current shape)
              // or in old data, just the raw string. Always compare ID.
              const id = typeof m === "string" ? m : m.id;
              const name = typeof m === "string" ? m : m.name;
              const note = typeof m === "string" ? null : m.note;
              const recommended = typeof m === "string" ? false : m.recommended;
              const selected = aiSettings.model === id;
              return (
                <button key={id} onClick={() => updateSetting("model", id)} style={{
                  position: "relative",
                  padding: "10px 14px", borderRadius: T.radius, cursor: "pointer",
                  border: selected ? `2px solid ${T.good}` : `1.5px solid ${T.border}`,
                  background: selected ? T.goodBg : T.card,
                  color: selected ? T.good : T.text,
                  fontWeight: 600, fontSize: 13, fontFamily: T.fontBody,
                  transition: "all 0.15s",
                  textAlign: "left", minWidth: 160, flex: "1 1 0"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{name}</span>
                    {recommended && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                        padding: "1px 6px", borderRadius: 3,
                        background: selected ? `${T.good}30` : `${T.good}20`,
                        color: T.good
                      }}>Rec</span>
                    )}
                  </div>
                  {note && (
                    <div style={{
                      fontSize: 11, fontWeight: 400, marginTop: 2,
                      color: selected ? T.good : T.textLight
                    }}>{note}</div>
                  )}
                </button>
              );
            })}
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

        {/* Local AI Lab (beta) */}
        {sectionBox(<>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Local AI Lab</label>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
              padding: "2px 7px", borderRadius: 4,
              background: T.perfectBg, color: T.perfect,
              fontFamily: T.fontBody
            }}>Beta</span>
          </div>
          <LocalAILab aiSettings={aiSettings} setAiSettings={setAiSettings} />
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

      </div>
    </div>
  );
}
