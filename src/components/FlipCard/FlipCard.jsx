import './FlipCard.css';

export default function FlipCard({ card, flipped, onFlip }) {
  const renderSide = (side) => (
    <div className="flip-card__content">
      {side.text && <div className="flip-card__text">{side.text}</div>}
      {side.drawing && <img src={side.drawing} alt="drawing" className="flip-card__drawing" />}
      {side.audio && <audio src={side.audio} controls className="flip-card__audio" />}
      {!side.text && !side.drawing && !side.audio && (
        <div className="flip-card__empty">Empty side</div>
      )}
    </div>
  );

  return (
    <div onClick={onFlip} className="flip-card">
      <div className={`flip-card__inner ${flipped ? 'flip-card__inner--flipped' : ''}`}>
        {/* Front */}
        <div className="flip-card__face flip-card__face--front">
          <div className="flip-card__header">
            <span className="flip-card__label flip-card__label--front">Front</span>
            <span className="flip-card__hint">tap to flip</span>
          </div>
          {renderSide(card.front)}
        </div>
        {/* Back */}
        <div className="flip-card__face flip-card__face--back">
          <div className="flip-card__header">
            <span className="flip-card__label flip-card__label--back">Back</span>
            <span className="flip-card__hint">tap to flip</span>
          </div>
          {renderSide(card.back)}
        </div>
      </div>
    </div>
  );
}
