// The single, canonical app top bar used across Dashboard, Workspace,
// Flashcards, and Settings (and any other view that wants the standard
// chrome). Full-width, sits at the very top of the viewport above each
// view's content container.
//
// Houses three regions:
//   - Logo + wordmark on the left (click → onLogoClick or "dashboard")
//   - Primary nav tabs in the middle (Dashboard / Workspace / Flashcards)
//   - Right cluster: theme toggle + Settings + Profile (32px circles)
//
// Below ~480px viewport the tabs row collapses into a hamburger dropdown
// so the layout stays usable on narrow Electron windows / mobile.

import { useEffect, useRef, useState } from "react";
import useTheme from "../../theme/useTheme.js";
import useAuth from "../../auth/useAuth.js";

const NAV_TABS = [
  { id: "dashboard",  label: "Dashboard" },
  { id: "workspace",  label: "Workspace" },
  { id: "decks",      label: "Flashcards" },
];

const BREAKPOINT = 540;

export default function TopBar({ view, onNavigate, onLogoClick, onOpenSettings, onOpenProfile }) {
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

  const handleNav = (id) => {
    setMenuOpen(false);
    onNavigate?.(id);
  };
  const handleLogo = () => {
    if (onLogoClick) onLogoClick();
    else onNavigate?.("dashboard");
  };
  const isTabActive = (id) =>
    view === id || (id === "workspace" && (view === "home" || view === "workspace"));

  const getInitials = (name) =>
    name ? name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() : "";

  // ---- Reusable bits ----
  const logo = (
    <button
      onClick={handleLogo}
      aria-label="Home"
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "none", border: "none", padding: "4px 6px",
        borderRadius: 6, cursor: "pointer",
        color: T.text, fontFamily: T.font, flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.bgSub; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M8 7h6" /><path d="M8 11h4" />
      </svg>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Ostinote</span>
    </button>
  );

  const themeIcon = darkMode ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  const rightCluster = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <CircleButton T={T} title={darkMode ? "Light mode" : "Dark mode"} ariaLabel={darkMode ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setDarkMode(!darkMode)}>
        {themeIcon}
      </CircleButton>
      <CircleButton T={T} title="Settings" ariaLabel="Settings" active={view === "settings"} onClick={() => (onOpenSettings ? onOpenSettings() : onNavigate?.("settings"))}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </CircleButton>
      <CircleButton T={T} title="Profile" ariaLabel={user ? `Profile: ${user.displayName || user.email}` : "Profile"} active={view === "profile"} onClick={() => (onOpenProfile ? onOpenProfile() : onNavigate?.("profile"))}>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{
            width: "100%", height: "100%", objectFit: "cover", display: "block",
            borderRadius: "50%",
          }} />
        ) : user?.displayName || user?.email ? (
          <span style={{
            fontSize: 11, fontWeight: 700, color: T.text, fontFamily: T.fontBody,
          }}>{getInitials(user.displayName || user.email)}</span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </CircleButton>
    </div>
  );

  // ---- Wide layout: logo + tabs + right cluster ----
  if (!isNarrow) {
    return (
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        borderBottom: `1px solid ${T.border}`,
        background: T.card,
        gap: 16,
      }}>
        {logo}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}>
          {NAV_TABS.map(tab => {
            const isActive = isTabActive(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleNav(tab.id)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: isActive ? T.bgSub : "transparent",
                  color: isActive ? T.text : T.textLight,
                  fontSize: 13, fontWeight: 600,
                  fontFamily: T.fontBody, cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.textMid; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.textLight; }}
              >{tab.label}</button>
            );
          })}
        </div>
        {rightCluster}
      </div>
    );
  }

  // ---- Narrow layout: logo + hamburger → dropdown, right cluster compact ----
  return (
    <div ref={menuRef} style={{
      position: "relative",
      flexShrink: 0,
      borderBottom: `1px solid ${T.border}`,
      background: T.card,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
      }}>
        {logo}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Hamburger toggles the dropdown */}
          <CircleButton
            T={T}
            title={menuOpen ? "Close menu" : "Open menu"}
            ariaLabel={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            active={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <span style={{ display: "block", width: 14, height: 2, borderRadius: 1, background: "currentColor", transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(2px, 2px)" : "none" }} />
              <span style={{ display: "block", width: 14, height: 2, borderRadius: 1, background: "currentColor", transition: "all 0.2s", opacity: menuOpen ? 0 : 1 }} />
              <span style={{ display: "block", width: 14, height: 2, borderRadius: 1, background: "currentColor", transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(2px, -2px)" : "none" }} />
            </div>
          </CircleButton>
          {/* Still show profile so the avatar is always one tap away */}
          <CircleButton T={T} title="Profile" ariaLabel="Profile" active={view === "profile"} onClick={() => (onOpenProfile ? onOpenProfile() : onNavigate?.("profile"))}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "50%" }} />
            ) : user?.displayName || user?.email ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: T.fontBody }}>{getInitials(user.displayName || user.email)}</span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </CircleButton>
        </div>
      </div>

      {/* Dropdown menu */}
      <div style={{
        position: "absolute", top: "100%", right: 8, left: 8,
        marginTop: 6,
        background: T.card, borderRadius: 12,
        boxShadow: `0 8px 32px ${darkMode ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)"}`,
        border: `1px solid ${T.border}`,
        overflow: "hidden", zIndex: 1000,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: menuOpen ? 1 : 0,
        transform: menuOpen ? "translateY(0)" : "translateY(-6px)",
        pointerEvents: menuOpen ? "auto" : "none",
      }}>
        <div style={{ padding: 6 }}>
          {NAV_TABS.map(tab => {
            const isActive = isTabActive(tab.id);
            return (
              <MenuItem key={tab.id} T={T} active={isActive} onClick={() => handleNav(tab.id)}>{tab.label}</MenuItem>
            );
          })}
          <div style={{ height: 1, background: T.border, margin: "6px 4px" }} />
          <MenuItem T={T} active={view === "settings"} onClick={() => { setMenuOpen(false); onOpenSettings ? onOpenSettings() : onNavigate?.("settings"); }}>Settings</MenuItem>
          <MenuItem T={T} onClick={() => { setMenuOpen(false); setDarkMode(!darkMode); }}>
            {darkMode ? "Light mode" : "Dark mode"}
          </MenuItem>
        </div>
      </div>
    </div>
  );
}

// Common 32px circular button used in the right cluster + hamburger.
// Centralizes the hover treatment so every right-side affordance feels
// like part of the same group.
function CircleButton({ T, title, ariaLabel, children, onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      style={{
        width: 32, height: 32, borderRadius: "50%",
        border: `1.5px solid ${active ? T.borderStrong : T.border}`,
        background: T.card, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, color: active ? T.text : T.textMid,
        flexShrink: 0, overflow: "hidden",
        transition: "border-color 0.12s, color 0.12s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = active ? T.borderStrong : T.border; e.currentTarget.style.color = active ? T.text : T.textMid; }}
    >{children}</button>
  );
}

function MenuItem({ T, children, onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "10px 12px", borderRadius: 8,
        border: "none", cursor: "pointer",
        background: active ? T.bgSub : "transparent",
        color: active ? T.text : T.textMid,
        fontSize: 14, fontWeight: active ? 700 : 500,
        fontFamily: T.fontBody,
        transition: "all 0.15s ease",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.bgSub; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >{children}</button>
  );
}
