import SM2 from '../utils/sm2.js';

const defaultDecks = [
  {
    id: 'demo',
    name: 'Welcome Deck',
    cards: [
      {
        id: 'c1',
        front: { text: 'What does spaced repetition do?', drawing: null, audio: null },
        back: { text: 'It schedules reviews at increasing intervals to move information into long-term memory.', drawing: null, audio: null },
        ...SM2.defaultCard(),
      },
      {
        id: 'c2',
        front: { text: 'Tap this card to see the answer →', drawing: null, audio: null },
        back: { text: 'You can add text, drawings, and audio to both sides of every card!', drawing: null, audio: null },
        ...SM2.defaultCard(),
      },
    ],
  },
];

export default defaultDecks;
