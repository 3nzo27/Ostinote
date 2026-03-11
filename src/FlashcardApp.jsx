import { useState, useEffect } from 'react';
import SM2 from './utils/sm2.js';
import defaultDecks from './data/defaultDecks.js';
import HomeView from './views/HomeView/HomeView.jsx';
import DeckView from './views/DeckView/DeckView.jsx';
import AddCardView from './views/AddCardView/AddCardView.jsx';
import EditCardView from './views/EditCardView/EditCardView.jsx';
import StudyView from './views/StudyView/StudyView.jsx';

export default function FlashcardApp() {
  const [decks, setDecks] = useState(defaultDecks);
  const [view, setView] = useState('home');
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [editCardId, setEditCardId] = useState(null);
  const [newDeckName, setNewDeckName] = useState('');
  const [showNewDeck, setShowNewDeck] = useState(false);

  const activeDeck = decks.find(d => d.id === activeDeckId);
  const dueCards = activeDeck ? activeDeck.cards.filter(c => c.nextReview <= Date.now()) : [];

  // Guard: redirect to deck if editCard target is missing
  useEffect(() => {
    if (view === 'editCard' && activeDeck) {
      const card = activeDeck.cards.find(c => c.id === editCardId);
      if (!card) setView('deck');
    }
  }, [view, activeDeck, editCardId]);

  const updateDeck = (deckId, updater) => {
    setDecks(prev => prev.map(d => d.id === deckId ? updater(d) : d));
  };

  const addDeck = () => {
    if (!newDeckName.trim()) return;
    const id = 'd_' + Date.now();
    setDecks(prev => [...prev, { id, name: newDeckName.trim(), cards: [] }]);
    setNewDeckName('');
    setShowNewDeck(false);
  };

  const deleteDeck = (id) => {
    setDecks(prev => prev.filter(d => d.id !== id));
  };

  const addCard = (front, back) => {
    const card = { id: 'c_' + Date.now(), front, back, ...SM2.defaultCard() };
    updateDeck(activeDeckId, d => ({ ...d, cards: [...d.cards, card] }));
    setView('deck');
  };

  const updateCard = (front, back) => {
    updateDeck(activeDeckId, d => ({
      ...d, cards: d.cards.map(c => c.id === editCardId ? { ...c, front, back } : c)
    }));
    setEditCardId(null);
    setView('deck');
  };

  const deleteCard = (cardId) => {
    updateDeck(activeDeckId, d => ({ ...d, cards: d.cards.filter(c => c.id !== cardId) }));
  };

  const startStudy = () => {
    setStudyIndex(0);
    setFlipped(false);
    setShowRating(false);
    setView('study');
  };

  const handleFlip = () => {
    setFlipped(!flipped);
    if (!flipped) setShowRating(true);
  };

  const handleRate = (quality) => {
    const card = dueCards[studyIndex];
    const updated = SM2.grade(card, quality);
    updateDeck(activeDeckId, d => ({ ...d, cards: d.cards.map(c => c.id === card.id ? updated : c) }));
    if (studyIndex + 1 < dueCards.length) {
      setStudyIndex(studyIndex + 1);
      setFlipped(false);
      setShowRating(false);
    } else {
      setView('deck');
    }
  };

  // --- View Routing ---

  if (view === 'home') {
    return (
      <HomeView
        decks={decks}
        newDeckName={newDeckName}
        showNewDeck={showNewDeck}
        onSelectDeck={(id) => { setActiveDeckId(id); setView('deck'); }}
        onDeleteDeck={deleteDeck}
        onNewDeckNameChange={setNewDeckName}
        onShowNewDeck={() => setShowNewDeck(true)}
        onHideNewDeck={() => setShowNewDeck(false)}
        onAddDeck={addDeck}
      />
    );
  }

  if (view === 'deck' && activeDeck) {
    return (
      <DeckView
        activeDeck={activeDeck}
        dueCards={dueCards}
        onBack={() => setView('home')}
        onStudy={startStudy}
        onAddCard={() => setView('addCard')}
        onEditCard={(cardId) => { setEditCardId(cardId); setView('editCard'); }}
        onDeleteCard={deleteCard}
      />
    );
  }

  if (view === 'addCard') {
    return (
      <AddCardView
        onSave={addCard}
        onCancel={() => setView('deck')}
      />
    );
  }

  if (view === 'editCard' && activeDeck) {
    const card = activeDeck.cards.find(c => c.id === editCardId);
    if (!card) return null;
    return (
      <EditCardView
        card={card}
        onSave={updateCard}
        onCancel={() => setView('deck')}
      />
    );
  }

  if (view === 'study' && activeDeck) {
    return (
      <StudyView
        dueCards={dueCards}
        studyIndex={studyIndex}
        flipped={flipped}
        showRating={showRating}
        onExit={() => setView('deck')}
        onFlip={handleFlip}
        onRate={handleRate}
      />
    );
  }

  return null;
}
