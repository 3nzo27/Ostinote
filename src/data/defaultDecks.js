import SM2 from '../utils/sm2.js';

const defaultDecks = [
  {
    id: 'demo',
    name: 'Welcome Deck',
    cards: [
      {
        id: 'c1',
        front: { text: 'What is spaced repetition?', drawing: null, audio: null },
        back: { text: 'A learning technique that schedules reviews at increasing intervals, moving information from short-term to long-term memory.', drawing: null, audio: null },
        tags: ['concept'],
        ...SM2.defaultCard(),
      },
      {
        id: 'c2',
        front: { text: 'How do you rate your answer?', drawing: null, audio: null },
        back: { text: 'After revealing the answer, rate yourself: Forgot, Hard, Good, Easy, or Perfect. This determines when you\'ll see the card again.', drawing: null, audio: null },
        tags: ['concept'],
        ...SM2.defaultCard(),
      },
      {
        id: 'c3',
        front: { text: 'What can you put on a card?', drawing: null, audio: null },
        back: { text: 'Text, hand-drawn sketches, and audio recordings. You can mix them on the front and back of each card.', drawing: null, audio: null },
        tags: ['concept'],
        ...SM2.defaultCard(),
      },
      {
        id: 'c4',
        front: { text: 'What does the AI grader do?', drawing: null, audio: null },
        back: { text: 'If you add an API key in Settings, the AI compares your typed answer to the correct one and suggests a rating. It\'s like having a study buddy check your work.', drawing: null, audio: null },
        tags: ['concept'],
        ...SM2.defaultCard(),
      },
    ],
  },
];

export default defaultDecks;
