import './RatingButtons.css';

const RATINGS = [
  { q: 0, label: 'Forgot', color: '#e94560', bg: '#fef2f2' },
  { q: 2, label: 'Hard', color: '#f5a623', bg: '#fef9ee' },
  { q: 3, label: 'Good', color: '#0f3460', bg: '#eef3ff' },
  { q: 4, label: 'Easy', color: '#16c79a', bg: '#eefbf6' },
  { q: 5, label: 'Perfect', color: '#8b5cf6', bg: '#f5f0ff' },
];

export default function RatingButtons({ onRate }) {
  return (
    <div className="rating-buttons">
      {RATINGS.map(r => (
        <button
          key={r.q}
          onClick={() => onRate(r.q)}
          className="rating-buttons__btn"
          style={{ '--rating-color': r.color, '--rating-bg': r.bg }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
