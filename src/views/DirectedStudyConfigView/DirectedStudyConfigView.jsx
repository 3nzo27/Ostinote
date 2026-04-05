import useTheme from "../../theme/useTheme.js";
import NavBar from "../../components/NavBar/NavBar.jsx";
import WheelPicker from "../../components/WheelPicker/WheelPicker.jsx";

export default function DirectedStudyConfigView({
  decks, dsConfig, setDsConfig, dsMode, setDsMode,
  allTags, dsExpandedRow, setDsExpandedRow,
  dsDeckFilter, setDsDeckFilter, dsTagFilter, setDsTagFilter,
  startDirectedStudy, startShuffleStudy, onNavigate, onHelpOpen
}) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  const toggleDeck = (id) => setDsConfig(prev => ({
    ...prev, selectedDecks: prev.selectedDecks.includes(id) ? prev.selectedDecks.filter(d => d !== id) : [...prev.selectedDecks, id]
  }));
  const toggleTag = (tag) => setDsConfig(prev => ({
    ...prev, selectedTags: prev.selectedTags.includes(tag) ? prev.selectedTags.filter(t => t !== tag) : [...prev.selectedTags, tag]
  }));

  // Preview count calculation
  let previewCount = 0;
  const isNoneDecks = dsConfig.selectedDecks.includes("__none__");
  const selectedDeckIds = isNoneDecks ? decks.map(d => d.id) : (dsConfig.selectedDecks.length > 0 ? dsConfig.selectedDecks : decks.map(d => d.id));
  for (const deck of decks) {
    if (!selectedDeckIds.includes(deck.id)) continue;
    for (const card of deck.cards) {
      if (card.nextReview > Date.now()) continue;
      if (isNoneDecks || dsConfig.selectedTags.length > 0) {
        const cardTags = card.tags || [];
        if (dsConfig.selectedTags.length > 0 && !dsConfig.selectedTags.some(t => cardTags.includes(t))) continue;
        if (isNoneDecks && dsConfig.selectedTags.length === 0) continue;
      }
      previewCount++;
    }
  }
  const finalCount = dsConfig.cardLimit > 0 ? Math.min(previewCount, dsConfig.cardLimit) : previewCount;

  const optionBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${active ? T.text : T.border}`,
      background: active ? T.text : T.white, color: active ? T.card : T.textMid,
      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: T.fontBody,
      transition: "all 0.15s"
    }}>{label}</button>
  );

  const settingRow = (id, label, summary, content) => {
    const isExpanded = dsExpandedRow === id;
    return (
      <div
        key={id}
        aria-expanded={isExpanded}
        onMouseEnter={() => setDsExpandedRow(id)}
        onMouseLeave={() => setDsExpandedRow(null)}
        style={{
          padding: isExpanded ? "22px 18px" : "14px 18px",
          transition: "all 0.35s ease",
          cursor: "default",
          background: isExpanded ? T.bgSub : "transparent",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontBody }}>{label}</span>
          <span style={{ fontSize: 12, color: isExpanded ? T.textMid : T.textLight, fontFamily: T.fontBody, transition: "color 0.35s ease" }}>{summary}</span>
        </div>
        <div style={{
          maxHeight: isExpanded ? 200 : 0,
          opacity: isExpanded ? 1 : 0,
          overflow: "hidden",
          transition: "all 0.45s cubic-bezier(0.4,0,0.2,1)",
          marginTop: isExpanded ? 12 : 0
        }}>
          {content}
        </div>
      </div>
    );
  };

  const deckSummary = dsConfig.selectedDecks.includes("__none__") ? "None \u2014 tags only" : dsConfig.selectedDecks.length === 0 ? "All" : `${dsConfig.selectedDecks.length} selected`;
  const tagSummary = dsConfig.selectedTags.length === 0 ? "Any" : dsConfig.selectedTags.join(", ");
  const timeSummary = dsConfig.timeLimit === 0 ? "None" : dsConfig.timeLimit >= 60 ? `${Math.floor(dsConfig.timeLimit / 60)}m${dsConfig.timeLimit % 60 > 0 ? ` ${dsConfig.timeLimit % 60}s` : ""}` : `${dsConfig.timeLimit}s`;
  const cardSummary = dsConfig.cardLimit === 0 ? "All due" : `${dsConfig.cardLimit}`;

  const filteredDecks = decks.filter(d => d.name.toLowerCase().includes(dsDeckFilter.toLowerCase()));
  const filteredTags = allTags.filter(t => t.toLowerCase().includes(dsTagFilter.toLowerCase()));

  const inputStyle = {
    width: "100%", padding: "6px 10px", borderRadius: T.radius, border: `1.5px solid ${T.border}`,
    fontSize: 12, fontFamily: T.fontBody, color: T.text, outline: "none", background: T.inputBg,
    boxSizing: "border-box", marginBottom: 8
  };

  const allDue = decks.reduce((sum, d) => sum + d.cards.filter(c => c.nextReview <= Date.now()).length, 0);
  const canStart = (dsMode === "shuffle" && allDue > 0) || (dsMode === "focus" && finalCount > 0);

  return (
    <div style={containerStyle}>
      <NavBar view="directed" onNavigate={onNavigate} onHelpOpen={onHelpOpen} />
      <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 6 }}>Study</h2>
      <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, marginBottom: 24 }}>Pick your study style</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.4s ease" }}>

        {/* Mode selection cards */}
        <div style={{ display: "flex", gap: 12 }}>
          {/* Shuffle */}
          <div
            onClick={() => { if (allDue > 0) setDsMode(dsMode === "shuffle" ? "choose" : "shuffle"); }}
            style={{
              flex: 1, padding: "20px 18px", borderRadius: T.radiusLg,
              background: dsMode === "shuffle" ? T.bgSub : T.card,
              border: `1.5px solid ${T.borderStrong}`,
              boxShadow: T.shadow2, cursor: allDue > 0 ? "pointer" : "default",
              transition: "all 0.35s", position: "relative", overflow: "hidden"
            }}
            onMouseEnter={e => { if (allDue > 0) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = T.shadowHover; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = T.shadow2; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={allDue > 0 ? T.text : T.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: allDue > 0 ? T.text : T.textLight, fontFamily: T.fontBody }}>Shuffle</span>
            </div>
            <p style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5, margin: 0 }}>
              All due cards, random order.
            </p>
            <div style={{
              marginTop: 12, padding: "5px 12px", borderRadius: 20, display: "inline-block",
              background: allDue > 0 ? T.doneBg : T.bgSub,
              color: allDue > 0 ? T.done : T.textLight,
              fontSize: 12, fontWeight: 600, fontFamily: T.fontBody
            }}>
              {allDue > 0 ? `${allDue} card${allDue !== 1 ? "s" : ""} ready` : "No cards due"}
            </div>
          </div>

          {/* Focus */}
          <div
            onClick={() => setDsMode(dsMode === "focus" ? "choose" : "focus")}
            style={{
              flex: 1, padding: "20px 18px", borderRadius: T.radiusLg,
              background: dsMode === "focus" ? T.bgSub : T.card,
              border: `1.5px solid ${T.borderStrong}`,
              boxShadow: T.shadow2, cursor: "pointer",
              transition: "all 0.35s"
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = T.shadowHover; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = T.shadow2; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: T.fontBody }}>Focus</span>
            </div>
            <p style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5, margin: 0 }}>
              Filter by deck, tag, and set time limits.
            </p>
            <div style={{
              marginTop: 12, padding: "5px 12px", borderRadius: 20, display: "inline-block",
              background: T.bgSub,
              color: T.textLight,
              fontSize: 12, fontWeight: 600, fontFamily: T.fontBody,
              transition: "all 0.35s"
            }}>
              {dsMode === "focus" ? "Configure below \u2193" : "Tap to configure"}
            </div>
          </div>
        </div>

        {/* Focus config */}
        {dsMode === "focus" && (
          <div style={{ animation: "fadeIn 0.45s ease" }}>
            <div style={{
              borderRadius: T.radiusLg, background: T.card, border: `1px solid ${T.borderStrong}`,
              boxShadow: T.shadow2, overflow: "hidden"
            }}>
              {settingRow("decks", "Decks", deckSummary,
                <>
                  <input value={dsDeckFilter} onChange={e => setDsDeckFilter(e.target.value)}
                    placeholder="Search decks..." style={inputStyle}
                    onClick={e => e.stopPropagation()} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {optionBtn(dsConfig.selectedDecks.includes("__none__"), "None \u2014 tags only", () => {
                      if (dsConfig.selectedDecks.includes("__none__")) {
                        setDsConfig(prev => ({ ...prev, selectedDecks: [] }));
                      } else {
                        setDsConfig(prev => ({ ...prev, selectedDecks: ["__none__"] }));
                      }
                    })}
                    {!dsConfig.selectedDecks.includes("__none__") && filteredDecks.map(d => optionBtn(dsConfig.selectedDecks.includes(d.id), d.name, () => toggleDeck(d.id)))}
                    {!dsConfig.selectedDecks.includes("__none__") && filteredDecks.length === 0 && <span style={{ fontSize: 11, color: T.textLight, fontStyle: "italic", fontFamily: T.fontBody }}>No matches</span>}
                  </div>
                </>
              )}

              {allTags.length > 0 && settingRow("tags", "Tags", tagSummary,
                <>
                  <input value={dsTagFilter} onChange={e => setDsTagFilter(e.target.value)}
                    placeholder="Search tags..." style={inputStyle}
                    onClick={e => e.stopPropagation()} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {filteredTags.map(t => optionBtn(dsConfig.selectedTags.includes(t), t, () => toggleTag(t)))}
                    {filteredTags.length === 0 && <span style={{ fontSize: 11, color: T.textLight, fontStyle: "italic", fontFamily: T.fontBody }}>No matches</span>}
                  </div>
                </>
              )}

              {settingRow("time", "Time per card", timeSummary,
                <WheelPicker
                  options={[
                    { v: 0, l: "Off" }, { v: 15, l: "15 sec" }, { v: 30, l: "30 sec" }, { v: 45, l: "45 sec" },
                    { v: 60, l: "1 min" }, { v: 90, l: "1m 30s" }, { v: 120, l: "2 min" }, { v: 180, l: "3 min" }, { v: 300, l: "5 min" }, { v: 600, l: "10 min" }
                  ]}
                  value={dsConfig.timeLimit}
                  onChange={v => setDsConfig(prev => ({ ...prev, timeLimit: v }))}
                />
              )}

              {settingRow("cards", "Card limit", cardSummary,
                <WheelPicker
                  options={[
                    { v: 0, l: "No limit" }, { v: 5, l: "5 cards" }, { v: 10, l: "10 cards" }, { v: 15, l: "15 cards" },
                    { v: 20, l: "20 cards" }, { v: 30, l: "30 cards" }, { v: 50, l: "50 cards" }, { v: 100, l: "100 cards" }
                  ]}
                  value={dsConfig.cardLimit}
                  onChange={v => setDsConfig(prev => ({ ...prev, cardLimit: v }))}
                />
              )}
            </div>

            <div style={{ textAlign: "center", padding: "16px 0 0" }}>
              <p style={{ fontSize: 13, color: T.textMid, fontFamily: T.fontBody, marginBottom: 0 }}>
                {finalCount > 0 ? `${finalCount} card${finalCount !== 1 ? "s" : ""} ready to study` : "No cards match these filters"}
              </p>
            </div>
          </div>
        )}

        {/* Begin Study button */}
        {canStart && (
          <div style={{ textAlign: "center", padding: "8px 0", animation: "fadeIn 0.45s ease" }}>
            <button onClick={() => dsMode === "shuffle" ? startShuffleStudy() : startDirectedStudy()} style={{
              padding: "14px 40px", borderRadius: T.radius, border: "none",
              background: T.done, color: "#fff",
              fontWeight: 700, fontSize: 15, cursor: "pointer",
              fontFamily: T.fontBody, boxShadow: "0 3px 12px rgba(58,125,92,0.3)",
              transition: "all 0.15s"
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseLeave={e => e.currentTarget.style.transform = ""}
            >Begin Study</button>
          </div>
        )}
      </div>
    </div>
  );
}
