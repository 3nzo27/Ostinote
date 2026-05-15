# CLAUDE.md — Ostinote project handoff

You are continuing work on Ostinote, a React + Vite + Electron desktop study
app. PDF reader → AI chat → flashcard SRS. Everything is client-side
(IndexedDB + localStorage). No backend.

## Source map

- `src/FlashcardApp.jsx` — root. Holds decks state + view router.
- `src/main.jsx` — entry. Includes a polyfill for `ReadableStream`
  `Symbol.asyncIterator` (older WebKit / PDF.js uses it).
- `src/views/<Name>/<Name>.jsx` — top-level screens.
- `src/components/<Name>/<Name>.jsx` — shared widgets.
- `src/theme/tokens.js` — light/dark palettes.
- `src/utils/` — non-React helpers (sm2, pdfConverter, aiGrader,
  gradeCardAnswer, quickGrade, documentAi, documentStore, firestoreSync,
  webllm).
- `electron/main.cjs` + `electron/preload.cjs` — Electron shell + AI bridge.
- `vite-plugin-claude-bridge.js` — Vite dev `/_ai/*` endpoints (mirrors
  the Electron bridge for browser dev).

## View router (FlashcardApp.jsx)

```
"dashboard" | "home"  → HomeView          // greeting + calendar + Recent Decks
"workspace"           → WorkspaceView     // 3-column: LibrarySidebar | reader | DocumentSidebar
"decks"               → DecksView         // legacy fullscreen deck list (label: Flashcards)
"deck"                → DeckView          // single deck fullscreen
"addCard"|"editCard"  → AddCardView / EditCardView (CardEditor wrappers)
"study"               → StudyView         // fullscreen study session
"settings"            → SettingsView
"profile"             → ProfileView
"documents"           → DocumentsView (legacy)
"directed"|"directedStudy"|"directedResults" → DirectedStudy*
```

## Top bar — UNIFIED

`src/components/TopBar/TopBar.jsx` is the canonical app top bar. Used by
HomeView, WorkspaceView, DecksView, SettingsView. Renders:

- Logo + wordmark (left)
- Tabs: Dashboard / Workspace / Flashcards (center)
- Right cluster: theme toggle · Settings · Profile (32px circles, same hover spec)
- Below 540px viewport: hamburger dropdown

The Settings cog gets a subtle active-border when `view === "settings"`.
"Workspace" tab stays active for both `view === "workspace"` AND `view === "home"`.

**Legacy NavBar** (`src/components/NavBar/NavBar.jsx`) is STILL used by:
ProfileView, DocumentsView, DirectedStudy*, HelpModal-adjacent views.
**Next-up sweep**: migrate these to TopBar and delete NavBar.

## Sidebars (in WorkspaceView only)

**LibrarySidebar (left, 260px ↔ 48px rail)** — `src/components/LibrarySidebar/LibrarySidebar.jsx`
- Crossfade between rail + full layer with width transition (0.28s)
- Sections: Library (folder tree of PDFs) + Decks (flat list)
- CSS grid 0fr↔1fr trick for folder/section expand animation
- Internal helpers: `IconButton` (28px), `SectionAction` (22px), `RailIconButton` lookalikes

**DocumentSidebar = "Tool Bar" (right, USER-RESIZABLE)** — `src/components/DocumentSidebar/DocumentSidebar.jsx`
- Resize handle on its LEFT edge, drag to widen/narrow
- min 260 / max 640 / default 320 → persisted to `ostinote_toolbar_width`
- Same crossfade rail pattern as LibrarySidebar
- Tabs: **Chat / Notes / Cards / Tools** — outlined-pill style (matches the PDF tab strip)
- Cards tab auto-switches when user picks a deck from the Library
- Header label reads "TOOL BAR" (not Studio — was renamed)

## Tool Bar tab content (all in `src/components/DocumentSidebar/`)

- **ChatTab.jsx** — AI chat. Accepts `openDocs` array → multi-doc context.
  Send button is an in-bubble circle; pill input radius 20.
- **HighlightsTab.jsx** — per-active-doc highlights.
- **CardsTab.jsx** — selected deck inline. Three modes:
  - `list` — DeckView in inWindow mode + 24px bottom padding for shadow room
  - `addCard` — CardEditor (NOT compact). Wrapper: `flex:1, minHeight:0, overflow:auto, padding "12px 14px 24px"` so card shadow fully renders across the Tool Bar's whole vertical space (the flip animation needs it).
  - `study` — StudyView (inWindow=true). FlipCard renders with `compact` prop for transparent bg + no border + no shadow → blends into Tool Bar.
- **ToolsTab.jsx** — AI-powered card generators.

## Reader (middle column of WorkspaceView)

- PDF tab strip at top — same outlined-pill spec as Tool Bar tabs.
  Multiple docs can be open as tabs.
- `openDocIds` (array) + `activeDocId` drive state.
- `loadedDocs: {id: doc}` caches full doc content for all open tabs (chat
  needs all of them as context).
- Decks do NOT go here. They go to the Tool Bar's Cards tab.

## Persisted state (localStorage)

Active keys:
- `ostinote_decks` (decks array)
- `ostinote_workspace_openDocIds` (array of doc ids)
- `ostinote_workspace_activeDocId`
- `ostinote_workspace_selectedDeckId`
- `ostinote_workspace_libraryOpen`, `ostinote_workspace_studioOpen`
- `ostinote_toolbar_width`
- `ostinote_folder_expanded`, `ostinote_sidebar_sections`
- `ostinote_webllm_downloaded`

Legacy keys auto-migrated on first read (then ignored):
- `ostinote_workspace_openTabs` (was heterogeneous {type,id}[])
- `ostinote_workspace_activeTab`
- `ostinote_workspace_selectedDocId`
- `ostinote_deck_windows_open`, `ostinote_deck_window_geom`, `ostinote_pdf_window` — dead, can be removed.

## Theme tokens & visual spec

`T.bg` (page) ⊂ `T.bgSub` (recess) ⊂ `T.card` (lightest surface). Sidebars use `T.card`. Workspace canvas uses `T.bg`.

Text tiers: `T.text` / `T.textMid` / `T.textLight`. Borders: `T.border` / `T.borderStrong`. Shadows: `T.shadow1/2/3`. Radii: `T.radius` (8) / `T.radiusLg` (14).

### Tab spec (used in ToolBar AND PDF tab strip — must stay in sync)
```js
padding: "6px 10px", borderRadius: 8,
border: isActive ? `1.5px solid ${T.borderStrong}` : "1.5px solid transparent",
background: isActive ? T.bgSub : "transparent",
color: isActive ? T.text : T.textLight,
fontSize: 12, fontWeight: 600,
transition: "all 0.15s",
// hover (inactive): bg = T.bgSub, color = T.textMid
```

### Icon button spec (sidebar headers, top-bar right cluster)
- 32px circle (top bar right cluster) / 28px square radius 6 (sidebar header) / 22px (section actions)
- `border: 1.5px solid T.border`, background `T.card`, color `T.textMid`
- Hover: borderColor → `T.borderStrong`, color → `T.text`
- `transition: "border-color 0.12s, color 0.12s"`

### Animation timings (consistent across app)
- 0.12s — icon button hovers
- 0.15s — tab hovers + selection
- 0.18s — opacity crossfades (rail ↔ full layer)
- 0.22s — grid-row expansions (section/folder open/close)
- 0.28s — sidebar width transitions

## Important visual rules ("seamless" preference)

The user has stated multiple times: things INSIDE a sidebar/panel should
blend into the parent surface — no "box in a box" feel.

- **Things that flatten via `compact` / `inWindow` prop**:
  - `FlipCard` — no border, no shadow, transparent bg in compact mode
  - `DeckView` in inWindow — transparent bg, no page chrome, smaller typography (sz scale)
  - `StudyView` in inWindow — page padding stripped
- **Things that KEEP their chrome** (do not flatten):
  - `CardEditor` — always has T.card bg + T.borderStrong border + T.shadow2 + radius. Don't touch this.
  - Card rows in DeckView list — always T.card bg + T.border + T.shadow1, with bottom padding to prevent shadow clipping.

Shadows MUST have room to render. When putting a shadowed element inside
a scroll container, the wrapper needs enough bottom padding or it must
`flex:1` to fill the parent so shadow goes into empty space.

## AI integration

Five providers in `src/utils/aiGrader.js` (`PROVIDERS` object):
- `anthropic`, `openai`, `google` — need an API key
- `claude-local` — keyless. Uses the local `claude` CLI:
  - In Electron build: via `window.ostinoteAI.complete()` (preload bridge → ipc → spawn `claude --print` in main.cjs).
  - In browser dev: via `fetch("/_ai/complete")` (vite-plugin-claude-bridge handles spawn).
- `webllm` (in webllm.js, separate path) — for grading only, runs in-browser.

`hasApiKey` gate in 5 places (WorkspaceView, DashboardView, DocumentsView,
ChatTab, ToolsTab) treats `claude-local` as keyless-valid. See
`src/utils/aiGrader.js:hasAiCredentials`.

Grading helper (shared between fullscreen StudyView and Tool Bar CardsTab):
`src/utils/gradeCardAnswer.js` — pure async fn, builds prompt, calls
`callAi`, returns {rating, label, explanation, source}.

PDF conversion: `src/utils/pdfConverter.js` → `processFile()` → `extractPdfText()` (pdfjs-dist) → `convertToMarkdown()` → `callAi(...)`.

Multi-doc chat: `documentAi.chatWithDocument` accepts a `docs` array; the
system prompt marks active doc with `[ACTIVE]` so AI knows the user's focus.

## Things that have been TRIED AND REMOVED (do not re-introduce without asking)

- Floating draggable resizable windows for decks (DeckWindow)
- Floating PDF reader with snap zones
- "Open standalone" button on the deck panel
- Add Card / Study navigating fullscreen from inside Tool Bar
- Heterogeneous workspace tabs (deck tabs in the reader pane)
- `T.bgSub` background on card rows inside sidebars (caused discoloration)
- "Studio" label (renamed to "Tool Bar")

## react-rnd is installed but unused

`package.json` has `react-rnd` from the floating-windows era. No source
file imports it. Safe to `npm uninstall react-rnd` whenever.

## Likely next tasks

1. Migrate ProfileView, DocumentsView, DirectedStudy*, HelpModal-related
   screens from NavBar to TopBar. Delete `src/components/NavBar/NavBar.jsx`.
2. Possible inline Edit Card flow in Tool Bar (mirror of Add Card).
3. Tighten Settings view layout (currently still 640px; intentional).
4. Final claude-local end-to-end test once user is `/login`'d.

## Build / dev commands

- `npm run dev` — Vite dev (port 5173) + `/_ai/*` endpoints
- `npm run electron:dev` — `vite build` then open Electron with preload bridge
- `npm run build` — production bundle (no plugin /_ai endpoints)

## How to start working

1. Read this file (you just did).
2. `git log --oneline -20` for recent commits.
3. Ask the user what task they want to tackle.
4. Stay consistent with the conventions above. When in doubt, grep for
   patterns rather than inventing new ones.
