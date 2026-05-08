import { useState, useRef, useEffect, useCallback } from "react";
import useTheme from "./theme/useTheme.js";
import useAuth from "./auth/useAuth.js";
import SM2 from "./utils/sm2.js";
import defaultDecks from "./data/defaultDecks.js";
import { saveDecksToFirestore, loadDecksFromFirestore, subscribeToDecks } from "./utils/firestoreSync.js";
import HomeView from "./views/HomeView/HomeView.jsx";
import DecksView from "./views/DecksView/DecksView.jsx";
import DeckView from "./views/DeckView/DeckView.jsx";
import AddCardView from "./views/AddCardView/AddCardView.jsx";
import EditCardView from "./views/EditCardView/EditCardView.jsx";
import StudyView from "./views/StudyView/StudyView.jsx";
import DirectedStudyConfigView from "./views/DirectedStudyConfigView/DirectedStudyConfigView.jsx";
import DirectedStudySessionView from "./views/DirectedStudySessionView/DirectedStudySessionView.jsx";
import DirectedStudyResultsView from "./views/DirectedStudyResultsView/DirectedStudyResultsView.jsx";
import SettingsView from "./views/SettingsView/SettingsView.jsx";
import ProfileView from "./views/ProfileView/ProfileView.jsx";
import { gradeAnswer } from "./utils/aiGrader.js";
import { gradeWithLocal } from "./utils/webllm.js";
import { quickGrade } from "./utils/quickGrade.js";
import Onboarding from "./components/Onboarding/Onboarding.jsx";
import HelpModal from "./components/HelpModal/HelpModal.jsx";

export default function FlashcardApp() {
  const { T } = useTheme();
  const { user } = useAuth();

  // --- Core state (persisted) ---
  const [decks, setDecks] = useState(() => {
    try { const s = localStorage.getItem("ostinote_decks"); if (s) return JSON.parse(s); } catch {}
    return defaultDecks;
  });
  const [hideFlipHintForever, setHideFlipHintForever] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ostinote_hideFlipHint")) === true; } catch { return false; }
  });

  const [aiSettings, setAiSettings] = useState(() => {
    const defaults = {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKey: "",
      useLocal: false,
      localModelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    };
    try {
      const s = localStorage.getItem("ostinote_aiSettings");
      if (s) return { ...defaults, ...JSON.parse(s) };
    } catch {}
    return defaults;
  });

  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error

  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      if (JSON.parse(localStorage.getItem("ostinote_onboardingDone")) === true) return false;
      if (localStorage.getItem("ostinote_decks")) {
        localStorage.setItem("ostinote_onboardingDone", "true");
        return false;
      }
      return true;
    } catch { return true; }
  });

  // localStorage persistence — debounced to avoid blocking UI on every change
  const localSaveRef = useRef(null);
  useEffect(() => {
    clearTimeout(localSaveRef.current);
    localSaveRef.current = setTimeout(() => {
      localStorage.setItem("ostinote_decks", JSON.stringify(decks));
    }, 300);
    return () => clearTimeout(localSaveRef.current);
  }, [decks]);
  useEffect(() => { localStorage.setItem("ostinote_hideFlipHint", JSON.stringify(hideFlipHintForever)); }, [hideFlipHintForever]);
  useEffect(() => { localStorage.setItem("ostinote_aiSettings", JSON.stringify(aiSettings)); }, [aiSettings]);

  // --- Firestore sync ---
  const firestoreWriteRef = useRef(false);
  const debounceRef = useRef(null);

  // On sign-in: load from Firestore, merge with local
  useEffect(() => {
    if (!user) { setSyncStatus("idle"); return; }
    setSyncStatus("syncing");
    loadDecksFromFirestore(user.uid).then(cloudDecks => {
      if (cloudDecks && cloudDecks.length > 0) {
        firestoreWriteRef.current = true;
        setDecks(cloudDecks);
      } else {
        // First sign-in: upload local decks to cloud
        saveDecksToFirestore(user.uid, decks).catch(console.error);
      }
      setSyncStatus("synced");
    }).catch(err => {
      console.error("Firestore load error:", err);
      setSyncStatus("error");
    });
  }, [user?.uid]);

  // Listen for remote changes (multi-device sync)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToDecks(user.uid, (cloudDecks) => {
      firestoreWriteRef.current = true;
      setDecks(cloudDecks);
      setSyncStatus("synced");
    });
    return unsub;
  }, [user?.uid]);

  // Debounced save to Firestore on local changes
  const saveToCloud = useCallback((newDecks) => {
    if (!user) return;
    // Skip if this change came from Firestore (avoid loop)
    if (firestoreWriteRef.current) {
      firestoreWriteRef.current = false;
      return;
    }
    clearTimeout(debounceRef.current);
    setSyncStatus("syncing");
    debounceRef.current = setTimeout(() => {
      saveDecksToFirestore(user.uid, newDecks)
        .then(() => setSyncStatus("synced"))
        .catch(err => { console.error("Firestore save error:", err); setSyncStatus("error"); });
    }, 1500);
  }, [user]);

  useEffect(() => { saveToCloud(decks); }, [decks, saveToCloud]);

  // --- Core state (ephemeral) ---
  const [view, setView] = useState("home");
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [editCardId, setEditCardId] = useState(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [studyCardIds, setStudyCardIds] = useState([]);
  const [renamingDeck, setRenamingDeck] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [calOffset, setCalOffset] = useState(0);
  const [showFlipHint, setShowFlipHint] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // --- Guess & AI state ---
  const [guess, setGuess] = useState("");
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // --- Directed study state ---
  const [dsConfig, setDsConfig] = useState({
    selectedDecks: [],
    selectedTags: [],
    timeLimit: 0,
    cardLimit: 0,
  });
  const [dsActive, setDsActive] = useState(false);
  const [dsCards, setDsCards] = useState([]);
  const [dsIndex, setDsIndex] = useState(0);
  const [dsResults, setDsResults] = useState([]);
  const [dsTimer, setDsTimer] = useState(0);
  const dsTimerRef = useRef(null);
  const dsCardStartRef = useRef(0);
  const [dsExpandedRow, setDsExpandedRow] = useState(null);
  const [dsDeckFilter, setDsDeckFilter] = useState("");
  const [dsTagFilter, setDsTagFilter] = useState("");
  const [dsMode, setDsMode] = useState("choose");

  // --- Derived ---
  const activeDeck = decks.find(d => d.id === activeDeckId);
  const dueCards = activeDeck ? activeDeck.cards.filter(c => c.nextReview <= Date.now()) : [];
  const studyCards = activeDeck ? studyCardIds.map(id => activeDeck.cards.find(c => c.id === id)).filter(Boolean) : [];
  const allTags = [...new Set(decks.flatMap(d => d.cards.flatMap(c => c.tags || [])))];

  // --- Deck CRUD ---
  const updateDeck = (deckId, updater) => setDecks(prev => prev.map(d => d.id === deckId ? updater(d) : d));
  const addDeck = () => {
    if (!newDeckName.trim()) return;
    setDecks(prev => [...prev, { id: "d_" + Date.now(), name: newDeckName.trim(), cards: [] }]);
    setNewDeckName("");
    setShowNewDeck(false);
  };
  const deleteDeck = (id) => setDecks(prev => prev.filter(d => d.id !== id));
  const renameDeck = () => {
    if (!renameValue.trim()) return;
    updateDeck(activeDeckId, d => ({ ...d, name: renameValue.trim() }));
    setRenamingDeck(false);
  };

  // --- Card CRUD ---
  const addCard = (front, back, tags) => {
    updateDeck(activeDeckId, d => ({
      ...d, cards: [...d.cards, { id: "c_" + Date.now(), front, back, tags: tags || [], ...SM2.defaultCard() }]
    }));
    setView("deck");
  };
  const updateCard = (front, back, tags) => {
    updateDeck(activeDeckId, d => ({
      ...d, cards: d.cards.map(c => c.id === editCardId ? { ...c, front, back, tags: tags || [] } : c)
    }));
    setEditCardId(null);
    setView("deck");
  };
  const deleteCard = (cardId) => updateDeck(activeDeckId, d => ({ ...d, cards: d.cards.filter(c => c.id !== cardId) }));

  // --- Study ---
  const startStudy = () => {
    setStudyCardIds(dueCards.map(c => c.id));
    setStudyIndex(0);
    setFlipped(false);
    setShowRating(false);
    setGuess("");
    setAiResult(null);
    setGuessSubmitted(false);
    setView("study");
  };

  const handleFlip = () => {
    setFlipped(!flipped);
    if (!flipped) setShowRating(true);
  };

  const submitGuess = async () => {
    const card = dsActive ? dsCards[dsIndex] : studyCards[studyIndex];
    const actualAnswer = card.back.text || "(drawing or audio — no text answer)";
    const cardTags = card.tags || [];
    setGuessSubmitted(true);
    setFlipped(true);
    setAiLoading(true);
    setAiResult(null);
    if (dsActive) clearInterval(dsTimerRef.current);

    const tagContext = cardTags.length > 0
      ? `\nCARD TAGS: ${cardTags.join(", ")}\nThese tags indicate what this card is testing. Adjust your grading accordingly:\n${cardTags.map(t => {
          if (t === "spelling") return "- SPELLING: Exact spelling matters. Misspelled words should lower the rating even if the meaning is correct.";
          if (t === "vocabulary") return "- VOCABULARY: The student should use the precise term or word, not just describe the concept.";
          if (t === "definition") return "- DEFINITION: Grade on completeness and accuracy of the definition.";
          if (t === "concept") return "- CONCEPT: Understanding the idea matters more than exact wording.";
          if (t === "formula") return "- FORMULA: Exact notation and structure matter. Close but incorrect formulas should be rated lower.";
          if (t === "date") return "- DATE: The exact date/year matters. Close dates should be rated Hard, not Good.";
          if (t === "name") return "- NAME: The exact name matters. Partial names or misspellings should be rated lower.";
          if (t === "translation") return "- TRANSLATION: The translated word or phrase must be accurate. Synonyms may be acceptable if common.";
          if (t === "diagram") return "- DIAGRAM: Focus on whether the student described the key elements correctly.";
          return `- ${t.toUpperCase()}: Grade with this focus area in mind.`;
        }).join("\n")}`
      : "";

    const prompt = `You are a warm, encouraging teacher grading a flashcard answer. Be honest about accuracy while always staying supportive and positive.

CRITICAL VOICE: Address the user DIRECTLY using "you" / "your" in your explanation. Do NOT write "the student", "they", "the user", or any third-person reference — speak to them, not about them. Even when the answer is wrong, find something constructive to say to them: that attempts strengthen memory, that they'll get it next time, etc.

Examples of the right voice:
✓ "You got the date right but missed the year."
✓ "Nice — your spelling was spot on."
✓ "Close, but the answer is 'Madrid', not 'Madrigal'. You'll get it next time."
✗ "The student got the date right..."  (third person — wrong)
✗ "They were close..."  (third person — wrong)

GRADING RULES:
- Ignore differences in whitespace, trailing spaces, capitalization, and punctuation unless a tag specifically requires exactness (like "spelling").
- Focus on whether the meaning, completeness, and specificity of the answer are correct.
- Perfect should be RARE. Reserve it for answers that demonstrate full understanding — matching the correct answer in both meaning AND completeness.
- If the correct answer is a detailed explanation and the student gives only a one-word or very brief answer, that is NOT Perfect even if the word is relevant. A short answer against a long correct answer caps at Good or Easy depending on how central the word is.
- If the correct answer is itself short (a single word, name, date, or brief phrase), then a matching short answer CAN be Perfect.
- Match the level of detail: a vague answer to a specific question should be rated lower than a specific answer.
- Be fair but not generous. When in doubt, pick the accurate rating, not the higher one.
${tagContext}

CORRECT ANSWER: "${actualAnswer}"

STUDENT'S ANSWER: "${guess}"

Rate on this scale:
0 = "Forgot" — completely wrong or unrelated
2 = "Hard" — got a piece of it right but missing the main point or has significant errors
3 = "Good" — right general idea but lacking key details, specificity, or completeness
4 = "Easy" — correct and fairly complete, only minor differences in wording or small details missing
5 = "Perfect" — demonstrates full understanding, matches the correct answer in meaning AND completeness

Keep your explanation to 1-2 sentences, addressed to "you". Be specific about what you got right or what's missing.${cardTags.length > 0 ? ` Mention the tag-specific criteria you applied (e.g. "your spelling was accurate" or "the exact date was off — you said X").` : ""} Stay warm and encouraging even when strict.

Respond ONLY with valid JSON, no markdown backticks, in this exact format:
{"rating": <number>, "label": "<Forgot|Hard|Good|Easy|Perfect>", "explanation": "<1-2 sentence warm explanation, addressed to 'you'>"}`;

    try {
      // Deterministic short-circuit: clear-cut short factual answers
      // (numbers, dates, single tokens) bypass the AI entirely.
      const quick = quickGrade({ correctAnswer: actualAnswer, studentAnswer: guess });
      if (quick) {
        setAiResult(quick);
        setAiLoading(false);
        return;
      }

      if (aiSettings.useLocal) {
        const parsed = await gradeWithLocal({
          modelId: aiSettings.localModelId,
          correctAnswer: actualAnswer,
          studentAnswer: guess,
          tags: cardTags,
        });
        setAiResult({ ...parsed, source: "local" });
      } else {
        if (!aiSettings.apiKey) throw new Error("No API key");
        const parsed = await gradeAnswer(aiSettings, prompt);
        setAiResult({ ...parsed, source: "cloud" });
      }
    } catch (err) {
      console.error("AI grading error:", err);
      setAiResult({ rating: 3, label: "Good", explanation: "Could not reach AI grader. Please rate manually." });
    }
    setAiLoading(false);
  };

  const handleRate = (quality) => {
    const card = studyCards[studyIndex];
    updateDeck(activeDeckId, d => ({ ...d, cards: d.cards.map(c => c.id === card.id ? SM2.grade(card, quality) : c) }));
    if (studyIndex + 1 < studyCards.length) {
      setStudyIndex(studyIndex + 1);
      setFlipped(false);
      setShowRating(false);
      setGuess("");
      setAiResult(null);
      setGuessSubmitted(false);
    } else {
      setView("deck");
    }
  };

  const skipGuess = () => {
    setFlipped(true);
    setShowRating(true);
    setGuessSubmitted(true);
    setAiResult(null);
  };

  // --- Directed Study ---
  const startDirectedStudy = () => {
    let pool = [];
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
        pool.push({ ...card, deckId: deck.id, deckName: deck.name });
      }
    }
    if (dsConfig.cardLimit > 0) pool = pool.slice(0, dsConfig.cardLimit);
    if (pool.length === 0) return;
    setDsCards(pool);
    setDsIndex(0);
    setDsResults([]);
    setDsActive(true);
    setFlipped(false);
    setGuess("");
    setGuessSubmitted(false);
    setAiResult(null);
    dsCardStartRef.current = Date.now();
    if (dsConfig.timeLimit > 0) {
      setDsTimer(dsConfig.timeLimit);
      clearInterval(dsTimerRef.current);
      dsTimerRef.current = setInterval(() => {
        setDsTimer(prev => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    setView("directedStudy");
  };

  const startShuffleStudy = () => {
    let pool = [];
    for (const deck of decks) {
      for (const card of deck.cards) {
        if (card.nextReview > Date.now()) continue;
        pool.push({ ...card, deckId: deck.id, deckName: deck.name });
      }
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    if (pool.length === 0) return;
    setDsConfig(prev => ({ ...prev, timeLimit: 0 }));
    setDsCards(pool);
    setDsIndex(0);
    setDsResults([]);
    setDsActive(true);
    setFlipped(false);
    setGuess("");
    setGuessSubmitted(false);
    setAiResult(null);
    dsCardStartRef.current = Date.now();
    setView("directedStudy");
  };

  const dsHandleRate = (quality) => {
    const card = dsCards[dsIndex];
    const timeSpent = Math.round((Date.now() - dsCardStartRef.current) / 1000);
    const timedOut = dsConfig.timeLimit > 0 && dsTimer <= 0;
    const finalQuality = timedOut ? Math.min(quality, 2) : quality;

    updateDeck(card.deckId, d => ({
      ...d, cards: d.cards.map(c => c.id === card.id ? SM2.grade(c, finalQuality) : c)
    }));

    const result = {
      cardId: card.id,
      cardFront: card.front.text || "Drawing/Audio card",
      rating: finalQuality,
      label: [, , "Hard", "Good", "Easy", "Perfect"][finalQuality] || "Forgot",
      timeSpent,
      timedOut,
      guess: guess || "(skipped)",
    };
    setDsResults(prev => [...prev, result]);

    if (dsIndex + 1 < dsCards.length) {
      setDsIndex(dsIndex + 1);
      setFlipped(false);
      setGuess("");
      setGuessSubmitted(false);
      setAiResult(null);
      dsCardStartRef.current = Date.now();
      if (dsConfig.timeLimit > 0) {
        setDsTimer(dsConfig.timeLimit);
      }
    } else {
      clearInterval(dsTimerRef.current);
      setDsActive(false);
      setView("directedResults");
    }
  };

  const dsSkip = () => {
    clearInterval(dsTimerRef.current);
    setFlipped(true);
    setGuessSubmitted(true);
    setShowRating(true);
    setAiResult(null);
  };

  // Auto-submit when timer runs out
  useEffect(() => {
    if (dsActive && dsConfig.timeLimit > 0 && dsTimer <= 0 && !guessSubmitted) {
      setFlipped(true);
      setGuessSubmitted(true);
      setShowRating(true);
      setAiResult({ rating: 0, label: "Forgot", explanation: "Time's up! The timer ran out before you could answer. Don't worry — seeing the answer still helps reinforce the memory." });
    }
  }, [dsTimer, dsActive]);

  // Cleanup timer
  useEffect(() => { return () => clearInterval(dsTimerRef.current); }, []);

  // --- Export / Import ---
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ version: 1, decks }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ostinote-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.decks && Array.isArray(data.decks)) {
          setDecks(data.decks);
          setView("home");
        }
      } catch {}
    };
    reader.readAsText(file);
  };

  // --- Onboarding ---
  const completeOnboarding = useCallback((result) => {
    localStorage.setItem("ostinote_onboardingDone", "true");
    setShowOnboarding(false);
    if (result?.name) {
      const newId = "d_" + Date.now();
      setDecks(prev => [...prev, { id: newId, name: result.name, cards: [] }]);
      setActiveDeckId(newId);
      setView("addCard");
    }
  }, []);

  const replayOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  const openHelp = useCallback(() => setShowHelp(true), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);

  // --- Navigation ---
  const onNavigate = (v) => setView(v);
  const onSelectDeck = (deckId) => { setActiveDeckId(deckId); setView("deck"); };

  // --- View Router ---
  const renderView = () => {
  if (view === "home") {
    return <HomeView
      decks={decks}
      calOffset={calOffset} setCalOffset={setCalOffset}
      confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId}
      deleteDeck={deleteDeck}
      exportData={exportData} importData={importData}
      onNavigate={onNavigate} onSelectDeck={onSelectDeck}
      onHelpOpen={openHelp}
    />;
  }

  if (view === "decks") {
    return <DecksView
      decks={decks}
      newDeckName={newDeckName} setNewDeckName={setNewDeckName}
      showNewDeck={showNewDeck} setShowNewDeck={setShowNewDeck}
      addDeck={addDeck}
      confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId}
      deleteDeck={deleteDeck}
      onSelectDeck={onSelectDeck} onNavigate={onNavigate}
      onHelpOpen={openHelp}
    />;
  }

  if (view === "deck" && activeDeck) {
    return <DeckView
      activeDeck={activeDeck} dueCards={dueCards}
      renamingDeck={renamingDeck} setRenamingDeck={setRenamingDeck}
      renameValue={renameValue} setRenameValue={setRenameValue}
      renameDeck={renameDeck}
      startStudy={startStudy} deleteCard={deleteCard}
      setEditCardId={setEditCardId} onNavigate={onNavigate}
    />;
  }

  if (view === "addCard") {
    return <AddCardView onSave={addCard} onCancel={() => setView("deck")} />;
  }

  if (view === "editCard" && activeDeck) {
    const card = activeDeck.cards.find(c => c.id === editCardId);
    if (!card) { setView("deck"); return null; }
    return <EditCardView card={card} onSave={updateCard} onCancel={() => setView("deck")} />;
  }

  if (view === "study" && activeDeck) {
    return <StudyView
      studyCards={studyCards} studyIndex={studyIndex}
      flipped={flipped} guess={guess} guessSubmitted={guessSubmitted}
      aiResult={aiResult} aiLoading={aiLoading}
      showFlipHint={showFlipHint} hideFlipHintForever={hideFlipHintForever}
      setGuess={setGuess} submitGuess={submitGuess} skipGuess={skipGuess}
      handleFlip={handleFlip} handleRate={handleRate}
      setShowFlipHint={setShowFlipHint} setHideFlipHintForever={setHideFlipHintForever}
      onNavigate={onNavigate}
    />;
  }

  if (view === "directed") {
    return <DirectedStudyConfigView
      decks={decks} dsConfig={dsConfig} setDsConfig={setDsConfig}
      dsMode={dsMode} setDsMode={setDsMode}
      allTags={allTags}
      dsExpandedRow={dsExpandedRow} setDsExpandedRow={setDsExpandedRow}
      dsDeckFilter={dsDeckFilter} setDsDeckFilter={setDsDeckFilter}
      dsTagFilter={dsTagFilter} setDsTagFilter={setDsTagFilter}
      startDirectedStudy={startDirectedStudy} startShuffleStudy={startShuffleStudy}
      onNavigate={onNavigate}
      onHelpOpen={openHelp}
    />;
  }

  if (view === "directedStudy" && dsCards.length > 0) {
    return <DirectedStudySessionView
      dsCards={dsCards} dsIndex={dsIndex} dsConfig={dsConfig} dsTimer={dsTimer}
      flipped={flipped} guess={guess} guessSubmitted={guessSubmitted}
      aiResult={aiResult} aiLoading={aiLoading}
      setGuess={setGuess} submitGuess={submitGuess}
      setFlipped={setFlipped} setGuessSubmitted={setGuessSubmitted}
      setShowRating={setShowRating} setAiResult={setAiResult}
      dsHandleRate={dsHandleRate} onSkip={dsSkip}
      onExit={() => { clearInterval(dsTimerRef.current); setDsActive(false); setView("directed"); }}
    />;
  }

  if (view === "directedResults") {
    return <DirectedStudyResultsView dsResults={dsResults} onNavigate={onNavigate} onHelpOpen={openHelp} />;
  }

  if (view === "settings") {
    return <SettingsView aiSettings={aiSettings} setAiSettings={setAiSettings} syncStatus={syncStatus} onNavigate={onNavigate} onHelpOpen={openHelp} onReplayOnboarding={replayOnboarding} />;
  }

  if (view === "profile") {
    return <ProfileView syncStatus={syncStatus} onNavigate={onNavigate} onHelpOpen={openHelp} />;
  }

  return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      {renderView()}
      {showHelp && <HelpModal onClose={closeHelp} onReplayOnboarding={replayOnboarding} />}
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
    </div>
  );
}
