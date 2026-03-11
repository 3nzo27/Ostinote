import DeckItem from '../../components/DeckItem/DeckItem.jsx';
import './HomeView.css';

export default function HomeView({
  decks,
  newDeckName,
  showNewDeck,
  onSelectDeck,
  onDeleteDeck,
  onNewDeckNameChange,
  onShowNewDeck,
  onHideNewDeck,
  onAddDeck,
}) {
  return (
    <div className="app-container home-view">
      {/* Header */}
      <div className="home-view__header">
        <div className="home-view__logo">
          <span className="home-view__logo-icon">⚡</span>
        </div>
        <h1 className="home-view__title">Recall</h1>
        <p className="home-view__subtitle">Spaced repetition flashcards</p>
      </div>

      {/* Decks */}
      <div className="home-view__deck-list">
        {decks.map(deck => (
          <DeckItem
            key={deck.id}
            deck={deck}
            onSelect={() => onSelectDeck(deck.id)}
            onDelete={() => onDeleteDeck(deck.id)}
          />
        ))}
      </div>

      {/* New Deck */}
      {showNewDeck ? (
        <div className="home-view__new-deck-form">
          <input
            value={newDeckName}
            onChange={e => onNewDeckNameChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAddDeck()}
            placeholder="Deck name..."
            autoFocus
            className="home-view__new-deck-input"
          />
          <div className="home-view__new-deck-actions">
            <button onClick={onHideNewDeck} className="home-view__cancel-btn">Cancel</button>
            <button onClick={onAddDeck} className="home-view__create-btn">Create</button>
          </div>
        </div>
      ) : (
        <button onClick={onShowNewDeck} className="home-view__add-deck-btn">+ New Deck</button>
      )}
    </div>
  );
}
