import { useState, useEffect, useRef } from "react";
import useTheme from "../../theme/useTheme.js";
import useAuth from "../../auth/useAuth.js";

// Primary navigation tabs. Internal view ids match FlashcardApp's router;
// "decks" stays as the route id while the user-facing label says Flashcards.
// Settings and Profile live as right-side icon buttons, not as tabs.
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
    </svg>
  )},
  { id: "workspace", label: "Workspace", icon: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )},
  { id: "decks", label: "Flashcards", icon: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3H8l-2 4h12l-2-4z" />
    </svg>
  )},
];

const SETTINGS_ICON = (c) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const BREAKPOINT = 480;

export default function NavBar({ view, onNavigate, onHelpOpen }) {
  const { T, darkMode, setDarkMode } = useTheme();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < BREAKPOINT);
  const menuRef = useRef(null);

  // Responsive listener
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  // Close menu on navigation
  const handleNav = (id) => {
    setMenuOpen(false);
    onNavigate(id);
  };

  const activeLabel = TABS.find(t => t.id === view)?.label || "Menu";

  // --- Profile button (shared) ---
  const getInitials = (name) => {
    if (!name) return "";
    return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  };
  const isActiveProfile = view === "profile";
  const profileBtn = (
    <button
      aria-label={user ? `Profile: ${user.displayName || user.email}` : "Profile"}
      onClick={() => onNavigate("profile")}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        border: `1.5px solid ${isActiveProfile ? T.borderStrong : T.border}`,
        background: T.card, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s", flexShrink: 0,
        padding: 0, overflow: "hidden"
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isActiveProfile ? T.borderStrong : T.border; }}
    >
      {user?.photoURL ? (
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{
          width: "100%", height: "100%", objectFit: "cover", display: "block"
        }} />
      ) : user?.displayName || user?.email ? (
        <span style={{
          fontSize: 12, fontWeight: 700, color: T.text, fontFamily: T.fontBody,
          letterSpacing: 0.2
        }}>{getInitials(user.displayName || user.email)}</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </button>
  );

  // --- WIDE LAYOUT: horizontal tabs (unchanged feel, slightly refined) ---
  if (!isNarrow) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${T.border}`
      }}>
        <div role="button" tabIndex={0} aria-label="Go to home page" onClick={() => onNavigate("dashboard")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 7h6" /><path d="M8 11h4" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.font, letterSpacing: -0.3 }}>Ostinote</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {TABS.map(tab => {
              const isActive = view === tab.id;
              return (
                <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: isActive ? T.bgSub : "transparent",
                  color: isActive ? T.text : T.textLight,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                  fontFamily: T.fontBody
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.textMid; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.textLight; }}
                >{tab.label}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Light mode" : "Dark mode"}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                border: `1.5px solid ${T.border}`,
                background: T.card, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: T.textMid,
                transition: "all 0.2s", flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
            >
              {darkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                  <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
                  <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => onNavigate("settings")}
              aria-label="Settings"
              title="Settings"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                border: `1.5px solid ${view === "settings" ? T.borderStrong : T.border}`,
                background: T.card, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: T.textMid,
                transition: "all 0.2s", flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = view === "settings" ? T.borderStrong : T.border; e.currentTarget.style.color = T.textMid; }}
            >
              {SETTINGS_ICON("currentColor")}
            </button>
            {profileBtn}
          </div>
        </div>
      </div>
    );
  }

  // --- NARROW LAYOUT: logo + hamburger → dropdown ---
  return (
    <div ref={menuRef} style={{
      position: "relative",
      marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${T.border}`
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <div role="button" tabIndex={0} aria-label="Go to home page" onClick={() => handleNav("dashboard")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 7h6" /><path d="M8 11h4" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.font, letterSpacing: -0.3 }}>Ostinote</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Hamburger */}
          <button
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1.5px solid ${menuOpen ? T.borderStrong : T.border}`,
              background: menuOpen ? T.bgSub : T.card,
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4,
              transition: "all 0.2s", flexShrink: 0
            }}
          >
            {/* Animated hamburger → X */}
            <span style={{
              display: "block", width: 16, height: 2, borderRadius: 1,
              background: T.text, transition: "all 0.25s ease",
              transform: menuOpen ? "rotate(45deg) translate(2px, 2px)" : "none"
            }} />
            <span style={{
              display: "block", width: 16, height: 2, borderRadius: 1,
              background: T.text, transition: "all 0.25s ease",
              opacity: menuOpen ? 0 : 1,
              transform: menuOpen ? "scaleX(0)" : "scaleX(1)"
            }} />
            <span style={{
              display: "block", width: 16, height: 2, borderRadius: 1,
              background: T.text, transition: "all 0.25s ease",
              transform: menuOpen ? "rotate(-45deg) translate(2px, -2px)" : "none"
            }} />
          </button>
          {profileBtn}
        </div>
      </div>

      {/* Dropdown menu */}
      <div style={{
        position: "absolute", top: "calc(100% + 8px)", right: 0, left: 0,
        background: T.card, borderRadius: 14,
        boxShadow: `0 8px 32px ${darkMode ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)"}, 0 1px 3px ${darkMode ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.06)"}`,
        border: `1px solid ${T.border}`,
        overflow: "hidden", zIndex: 1000,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: menuOpen ? 1 : 0,
        transform: menuOpen ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
        pointerEvents: menuOpen ? "auto" : "none",
        transformOrigin: "top right"
      }}>
        <div style={{ padding: 6 }}>
          {[...TABS, { id: "settings", label: "Settings", icon: SETTINGS_ICON }].map((tab) => {
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleNav(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: "none", cursor: "pointer",
                  background: isActive ? T.bgSub : "transparent",
                  color: isActive ? T.text : T.textMid,
                  fontSize: 15, fontWeight: isActive ? 700 : 500,
                  fontFamily: T.fontBody,
                  transition: "all 0.15s ease",
                  textAlign: "left"
                }}
              >
                {tab.icon(isActive ? T.text : T.textLight)}
                {tab.label}
                {isActive && (
                  <div style={{
                    marginLeft: "auto", width: 6, height: 6, borderRadius: 3,
                    background: T.accent
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
