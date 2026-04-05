import { useState } from "react";
import useTheme from "../../theme/useTheme.js";

const GUIDES = [
  {
    id: "getting-started",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
      </svg>
    ),
    title: "Getting Started",
    description: "The basics of creating decks, adding cards, and studying",
    content: [
      { heading: "Create a deck", body: "Go to the Decks tab and tap the dashed \"+ Add Deck\" button. Give your deck a name — something like \"Spanish Vocab\" or \"Biology Ch. 3\"." },
      { heading: "Add cards", body: "Open a deck and tap \"+ Add\". Each card has a front (the question) and a back (the answer). You can type text, draw sketches, or record audio on either side." },
      { heading: "Study your cards", body: "When cards are due, the \"Study Now\" button turns red with a count. Tap it to start reviewing. Try to recall the answer before flipping the card." },
      { heading: "Rate yourself", body: "After seeing the answer, rate how well you remembered: Forgot, Hard, Good, Easy, or Perfect. This determines when you'll see the card again." },
    ],
  },
  {
    id: "spaced-repetition",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: "Spaced Repetition",
    description: "How the scheduling algorithm helps you remember",
    content: [
      { heading: "What is spaced repetition?", body: "It's a learning technique based on the \"forgetting curve.\" Instead of cramming, you review material at increasing intervals — just before you'd forget it." },
      { heading: "How ratings work", body: "Your self-rating directly controls when a card reappears. \"Forgot\" brings it back very soon. \"Perfect\" pushes it far into the future. The algorithm (SM-2) adjusts each card's interval and difficulty independently." },
      { heading: "Why it works", body: "Each successful recall strengthens the memory. Over time, a card you consistently rate \"Good\" or better will go from daily reviews to weekly, monthly, and eventually yearly." },
      { heading: "Tips for best results", body: "Be honest with your ratings — it's tempting to rate \"Easy\" but \"Good\" is more accurate if you hesitated. Short, consistent daily sessions beat long, infrequent cramming." },
    ],
  },
  {
    id: "card-types",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="21" x2="8" y2="3"/><line x1="16" y1="21" x2="16" y2="3"/>
      </svg>
    ),
    title: "Card Types & Media",
    description: "Text, drawings, and audio recordings",
    content: [
      { heading: "Text cards", body: "The simplest type. Type a question on the front and the answer on the back. Great for definitions, vocabulary, and factual recall." },
      { heading: "Drawing cards", body: "Tap the pencil icon to open the drawing canvas. Sketch diagrams, label anatomy, draw chemical structures — anything visual. You can combine drawings with text." },
      { heading: "Audio cards", body: "Tap the microphone icon to record audio. Perfect for language pronunciation, music theory, or anything you need to hear. Recordings play back with a single tap." },
      { heading: "Mixing media", body: "Each side of a card can have text, a drawing, AND audio all at once. For example: front has a text question, back has a drawing explanation with an audio pronunciation." },
    ],
  },
  {
    id: "ai-grading",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: "AI Answer Grading",
    description: "Get instant feedback on your typed answers",
    content: [
      { heading: "How it works", body: "When studying, type your answer in the text box and submit. The AI compares your response to the correct answer and suggests a rating with a short explanation." },
      { heading: "Setting up", body: "Go to Settings and choose an AI provider (Anthropic, OpenAI, or Google). Enter your own API key — it's stored only on your device, never sent to our servers." },
      { heading: "Providers", body: "Anthropic (Claude) — excellent at nuanced grading. OpenAI (ChatGPT) — widely available. Google (Gemini) — a great free-tier option. All work well for flashcard grading." },
      { heading: "You're always in control", body: "The AI suggests a rating, but you make the final call. You can accept its suggestion or override it with your own rating. The AI is a helper, not the authority." },
    ],
  },
  {
    id: "study-sessions",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    title: "Study Sessions",
    description: "Directed study, shuffle mode, and time limits",
    content: [
      { heading: "Quick study", body: "Open any deck and tap \"Study Now\" to review just that deck's due cards. Simple and focused." },
      { heading: "Directed study", body: "Go to the Study tab to configure a session across multiple decks. Filter by specific decks or tags, set a card limit, or add a time limit per card." },
      { heading: "Shuffle mode", body: "In the Study tab, tap \"Shuffle All\" to mix due cards from every deck into one randomized session. Great for variety." },
      { heading: "Time limits", body: "Add a per-card time limit in directed study to build speed. When time runs out, the card auto-flips and your maximum rating is capped at Hard." },
    ],
  },
  {
    id: "cloud-sync",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      </svg>
    ),
    title: "Cloud Sync & Backup",
    description: "Sign in, sync, export, and protect your data",
    content: [
      { heading: "Sign in", body: "Go to Settings and sign in with Google or Apple. Your decks will automatically sync to the cloud so you can access them from any device." },
      { heading: "How sync works", body: "Changes save to the cloud automatically within a few seconds. The sync indicator in Settings shows the current status: Synced, Syncing, or Error." },
      { heading: "Offline use", body: "The app works fully offline. If you're not signed in, everything stays in your browser's local storage. You can always use the app without an account." },
      { heading: "Export & import", body: "On the Home screen, use \"Export Backup\" to download all your decks as a JSON file. Use \"Import Backup\" to restore from a previous export. This works regardless of sign-in status." },
    ],
  },
];

export default function HelpModal({ onClose, onReplayOnboarding }) {
  const { T } = useTheme();
  const [activeGuide, setActiveGuide] = useState(null);

  const guide = GUIDES.find(g => g.id === activeGuide);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: T.modalOverlay, backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, animation: "fadeIn 0.15s ease"
    }} onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Help & Tutorials"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: T.radiusLg,
          border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow3,
          maxWidth: 520, width: "100%", maxHeight: "80vh",
          display: "flex", flexDirection: "column", overflow: "hidden"
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0
        }}>
          {activeGuide ? (
            <button onClick={() => setActiveGuide(null)} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500, color: T.textMid, fontFamily: T.fontBody, padding: 0
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              All Guides
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.font }}>
                Help & Tutorials
              </div>
              <div style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, marginTop: 2 }}>
                Learn how to get the most out of Ostinote
              </div>
            </div>
          )}
          <button onClick={onClose} aria-label="Close help" style={{
            width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${T.border}`,
            background: T.white, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 24px 20px",
          WebkitOverflowScrolling: "touch"
        }}>
          {!activeGuide ? (
            <>
              {/* Guide list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeIn 0.2s ease" }}>
                {GUIDES.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGuide(g.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: T.radius,
                      border: `1px solid ${T.border}`, background: T.bg,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      width: "100%"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.boxShadow = T.shadow1; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: T.card, border: `1px solid ${T.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {g.icon(T.textMid)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>
                        {g.title}
                      </div>
                      <div style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, marginTop: 1 }}>
                        {g.description}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                ))}
              </div>

              {/* Replay onboarding */}
              <div style={{
                marginTop: 20, paddingTop: 16,
                borderTop: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>
                    Welcome Tour
                  </div>
                  <div style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, marginTop: 1 }}>
                    Replay the intro walkthrough
                  </div>
                </div>
                <button onClick={() => { onClose(); onReplayOnboarding(); }} style={{
                  padding: "8px 16px", borderRadius: T.radius,
                  border: `1.5px solid ${T.border}`, background: T.white,
                  color: T.textMid, fontWeight: 500, fontSize: 12,
                  cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
                >Replay</button>
              </div>
            </>
          ) : guide ? (
            /* Guide detail view */
            <div style={{ animation: "slideInRight 0.2s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: T.bg, border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0
                }}>
                  {guide.icon(T.text)}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.font }}>
                    {guide.title}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, marginTop: 1 }}>
                    {guide.description}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {guide.content.map((section, i) => (
                  <div key={i} style={{
                    padding: "16px 18px", borderRadius: T.radius,
                    background: T.bg, border: `1px solid ${T.border}`
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: T.text,
                      fontFamily: T.fontBody, marginBottom: 6
                    }}>
                      {section.heading}
                    </div>
                    <div style={{
                      fontSize: 13, color: T.textMid, fontFamily: T.fontBody,
                      lineHeight: 1.6
                    }}>
                      {section.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
