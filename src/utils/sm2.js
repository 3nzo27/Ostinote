// --- Spaced Repetition Engine (SuperMemo 2) ---
const SM2 = {
  grade(card, quality) {
    // quality: 0-5 (0=complete blackout, 5=perfect)
    let { repetitions, easeFactor, interval } = card;
    if (quality >= 3) {
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    const nextReview = Date.now() + interval * 86400000;
    return { ...card, repetitions, easeFactor, interval, nextReview, lastReview: Date.now() };
  },
  defaultCard() {
    return { repetitions: 0, easeFactor: 2.5, interval: 0, nextReview: 0, lastReview: 0 };
  }
};

export default SM2;
