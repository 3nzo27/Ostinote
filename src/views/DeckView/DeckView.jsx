import './DeckView.css';

export default function DeckView({ activeDeck, dueCards, onBack, onStudy, onAddCard, onEditCard, onDeleteCard }) {
  return (
    <div className="app-container deck-view">
      {/* Nav */}
      <button onClick={onBack} className="deck-view__back-btn">← All Decks</button>

      <h2 className="deck-view__title">{activeDeck.name}</h2>
      <p className="deck-view__stats">
        {activeDeck.cards.length} cards ·{' '}
        <span className={`deck-view__due ${dueCards.length > 0 ? 'deck-view__due--active' : 'deck-view__due--clear'}`}>
          {dueCards.length} due for review
        </span>
      </p>

      {/* Action buttons */}
      <div className="deck-view__actions">
        <button
          onClick={onStudy}
          disabled={dueCards.length === 0}
          className={`deck-view__study-btn ${dueCards.length === 0 ? 'deck-view__study-btn--disabled' : ''}`}
        >
          Study Now ({dueCards.length})
        </button>
        <button onClick={onAddCard} className="deck-view__add-btn">+ Add</button>
      </div>

      {/* Card list */}
      <div className="deck-view__card-list">
        {activeDeck.cards.map((card, i) => {
          const isDue = card.nextReview <= Date.now();
          return (
            <div key={card.id} className="deck-view__card-item">
              <div className="deck-view__card-info">
                <div className="deck-view__card-title">
                  {card.front.text || (card.front.drawing ? '🖌 Drawing' : card.front.audio ? '🎙 Audio' : 'Card ' + (i + 1))}
                </div>
                <div className={`deck-view__card-due ${isDue ? 'deck-view__card-due--now' : 'deck-view__card-due--later'}`}>
                  {isDue ? 'Due now' : `Next: ${new Date(card.nextReview).toLocaleDateString()}`}
                </div>
              </div>
              <div className="deck-view__card-actions">
                <button onClick={() => onEditCard(card.id)} className="deck-view__edit-btn">Edit</button>
                <button onClick={() => onDeleteCard(card.id)} className="deck-view__delete-btn">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
