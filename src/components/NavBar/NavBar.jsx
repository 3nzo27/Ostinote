import { useState, useEffect, useRef } from "react";
import useTheme from "../../theme/useTheme.js";
import useAuth from "../../auth/useAuth.js";

const TABS = [
  { id: "home", label: "Home", icon: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )},
  { id: "directed", label: "Study", icon: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )},
  { id: "decks", label: "Decks", icon: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3H8l-2 4h12l-2-4z" />
    </svg>
  )},
  { id: "settings", label: "Settings", icon: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )},
];

const BREAKPOINT = 480;

export default function NavBar({ view, onNavigate, onHelpOpen }) {
  const { T, darkMode } = useTheme();
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
        <div role="button" tabIndex={0} aria-label="Go to home page" onClick={() => onNavigate("home")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 7h6" /><path d="M8 11h4" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.font, letterSpacing: -0.3 }}>Ostinote</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                background: view === tab.id ? T.bgSub : "transparent",
                color: view === tab.id ? T.text : T.textLight,
                fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                fontFamily: T.fontBody
              }}
                onMouseEnter={e => { if (view !== tab.id) e.currentTarget.style.color = T.textMid; }}
                onMouseLeave={e => { if (view !== tab.id) e.currentTarget.style.color = T.textLight; }}
              >{tab.label}</button>
            ))}
          </div>
          {profileBtn}
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
        <div role="button" tabIndex={0} aria-label="Go to home page" onClick={() => handleNav("home")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
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
          {TABS.map((tab) => {
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
