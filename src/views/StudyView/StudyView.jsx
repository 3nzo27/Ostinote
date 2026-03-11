import FlipCard from '../../components/FlipCard/FlipCard.jsx';
import RatingButtons from '../../components/RatingButtons/RatingButtons.jsx';
import './StudyView.css';

export default function StudyView({ dueCards, studyIndex, flipped, showRating, onExit, onFlip, onRate }) {
  // All done state
  if (dueCards.length === 0) {
    return (
      <div className="app-container study-view study-view--complete">
        <div className="study-view__complete-emoji">🎉</div>
        <h2 className="study-view__complete-title">All done!</h2>
        <p className="study-view__complete-text">No more cards due for review.</p>
        <button onClick={onExit} className="study-view__back-btn">Back to Deck</button>
      </div>
    );
  }

  const currentCard = dueCards[studyIndex];
  if (!currentCard) return null;

  return (
    <div className="app-container study-view">
      <div className="study-view__nav">
        <button onClick={onExit} className="study-view__exit-btn">← Exit</button>
        <div className="study-view__counter">
          {studyIndex + 1} / {dueCards.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="study-view__progress">
        <div
          className="study-view__progress-fill"
          style={{ width: `${(studyIndex / dueCards.length) * 100}%` }}
        />
      </div>

      <div className="study-view__card-wrapper">
        <FlipCard card={currentCard} flipped={flipped} onFlip={onFlip} />
      </div>

      {showRating && (
        <div className="study-view__rating">
          <p className="study-view__rating-prompt">How well did you know this?</p>
          <RatingButtons onRate={onRate} />
        </div>
      )}

      {!flipped && (
        <p className="study-view__hint">Tap the card to reveal the answer</p>
      )}
    </div>
  );
}
