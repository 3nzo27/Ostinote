import './DeckItem.css';

export default function DeckItem({ deck, onSelect, onDelete }) {
  const dueCount = deck.cards.filter(c => c.nextReview <= Date.now()).length;

  return (
    <div onClick={onSelect} className="deck-item">
      <div className="deck-item__info">
        <div className="deck-item__name">{deck.name}</div>
        <div className="deck-item__stats">
          {deck.cards.length} card{deck.cards.length !== 1 ? 's' : ''} ·{' '}
          <span className={`deck-item__due ${dueCount > 0 ? 'deck-item__due--active' : 'deck-item__due--clear'}`}>
            {dueCount} due
          </span>
        </div>
      </div>
      <div className="deck-item__actions">
        <div className={`deck-item__badge ${dueCount > 0 ? 'deck-item__badge--due' : 'deck-item__badge--clear'}`}>
          {dueCount}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="deck-item__delete-btn"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
