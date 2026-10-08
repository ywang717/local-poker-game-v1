import { describe, expect, it } from 'vitest';
import { createCareer, recordHand } from '../../src/career/careerService';
import type { HandSummary } from '../../src/career/handHistory';

function summary(index: number, overrides: Partial<HandSummary> = {}): HandSummary {
  return {
    handId: `hand-${index}`,
    timestamp: `2026-09-30T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
    mode: index % 2 === 0 ? 'STANDARD' : 'SHORT_DECK',
    tableLevel: index % 2 === 0 ? 1 : 2,
    tableSize: index % 2 === 0 ? 6 : 2,
    smallBlind: 25,
    bigBlind: 50,
    dealerSeat: 0,
    playerHoleCards: [],
    communityCards: [],
    finalCategory: 'ONE_PAIR',
    finalPot: 500 + index,
    playerContribution: 100,
    playerNet: index % 2 === 0 ? 200 : -100,
    result: index % 2 === 0 ? 'WIN' : 'LOSS',
    actionHistory: [],
    allIn: index % 3 === 0,
    allInWon: index % 3 === 0 && index % 2 === 0,
    ...overrides,
  };
}

describe('career statistics and hand history', () => {
  it('records overall, mode, player-count and table-level statistics', () => {
    let career = createCareer('玩家');
    career = recordHand(career, summary(0));
    career = recordHand(career, summary(1));
    expect(career.statistics.overall.totalHands).toBe(2);
    expect(career.statistics.overall.wonHands).toBe(1);
    expect(career.statistics.overall.totalProfit).toBe(100);
    expect(career.statistics.overall.maxSingleHandProfit).toBe(200);
    expect(career.statistics.overall.maxSingleHandLoss).toBe(-100);
    expect(career.statistics.overall.allInCount).toBe(1);
    expect(career.statistics.overall.allInWins).toBe(1);
    expect(career.statistics.byMode.STANDARD.totalHands).toBe(1);
    expect(career.statistics.byMode.SHORT_DECK.totalProfit).toBe(-100);
    expect(career.statistics.byPlayerCount[6].totalHands).toBe(1);
    expect(career.statistics.byPlayerCount[2].totalProfit).toBe(-100);
    expect(career.statistics.byLevel[2].wonHands).toBe(0);
    expect(career.handHistory).toHaveLength(2);
  });

  it('records voluntary pots entered and exposes the hand denominator', () => {
    let career = createCareer('玩家');
    career = recordHand(career, summary(0, { vpip: true }));
    career = recordHand(career, summary(1, { vpip: false }));
    expect(career.statistics.overall.vpipHands).toBe(1);
    expect(career.statistics.overall.totalHands).toBe(2);
  });

  it('records real outcomes by starting hand class and keeps modes separate', () => {
    const aceKingSuited = [
      { id: '14-spades', rank: 14, suit: 'spades' },
      { id: '13-spades', rank: 13, suit: 'spades' },
    ] as const;
    const aceKingOffsuit = [
      { id: '14-spades', rank: 14, suit: 'spades' },
      { id: '13-hearts', rank: 13, suit: 'hearts' },
    ] as const;
    let career = createCareer('玩家');
    career = recordHand(career, summary(10, { mode: 'STANDARD', playerHoleCards: [...aceKingSuited], result: 'WIN' }));
    career = recordHand(career, summary(11, { mode: 'STANDARD', playerHoleCards: [...aceKingSuited], result: 'SPLIT' }));
    career = recordHand(career, summary(12, { mode: 'STANDARD', playerHoleCards: [...aceKingSuited], result: 'FOLD' }));
    career = recordHand(career, summary(13, { mode: 'STANDARD', playerHoleCards: [...aceKingOffsuit], result: 'LOSS' }));
    career = recordHand(career, summary(14, { mode: 'SHORT_DECK', playerHoleCards: [...aceKingSuited], result: 'LOSS' }));

    expect(career.statistics.byStartingHand.STANDARD.AKs).toEqual({ hands: 3, wins: 1, splits: 1, losses: 1 });
    expect(career.statistics.byStartingHand.STANDARD.AKo).toEqual({ hands: 1, wins: 0, splits: 0, losses: 1 });
    expect(career.statistics.byStartingHand.SHORT_DECK.AKs).toEqual({ hands: 1, wins: 0, splits: 0, losses: 1 });
  });

  it('does not count a hand without two recorded hole cards', () => {
    const career = recordHand(createCareer('玩家'), summary(20));
    expect(Object.keys(career.statistics.byStartingHand.STANDARD)).toHaveLength(0);
    expect(Object.keys(career.statistics.byStartingHand.SHORT_DECK)).toHaveLength(0);
  });

  it('uses standard starting-hand notation for pocket tens and validates mode ranks', () => {
    const pocketTens = [
      { id: '10-spades', rank: 10, suit: 'spades' },
      { id: '10-hearts', rank: 10, suit: 'hearts' },
    ] as const;
    const invalidShortDeck = [
      { id: '5-spades', rank: 5, suit: 'spades' },
      { id: '14-hearts', rank: 14, suit: 'hearts' },
    ] as const;
    let career = createCareer('玩家');
    career = recordHand(career, summary(21, { mode: 'STANDARD', playerHoleCards: [...pocketTens] }));
    career = recordHand(career, summary(22, { mode: 'SHORT_DECK', playerHoleCards: [...invalidShortDeck] }));
    expect(career.statistics.byStartingHand.STANDARD.TT.hands).toBe(1);
    expect(career.statistics.byStartingHand.SHORT_DECK).toEqual({});
  });

  it('applies a hand id only once and keeps the newest 500 history entries', () => {
    let career = createCareer('玩家');
    career = recordHand(career, summary(1));
    career = recordHand(career, summary(1, { playerNet: 9_999 }));
    expect(career.statistics.overall.totalHands).toBe(1);
    expect(career.handHistory[0].playerNet).toBe(-100);
    for (let index = 2; index <= 501; index += 1) career = recordHand(career, summary(index));
    expect(career.handHistory).toHaveLength(500);
    expect(career.handHistory[0].handId).toBe('hand-501');
    expect(career.handHistory.at(-1)?.handId).toBe('hand-2');
  });

  it('preserves per-pot winners and awards for the previous-hand review', () => {
    const potResults = [{ amount: 120, winnerPlayerIds: ['hero'], awards: [{ playerId: 'hero', amount: 120 }] }];
    const career = recordHand(createCareer('玩家'), summary(2, { potResults }));
    expect(career.handHistory[0].potResults).toEqual(potResults);
  });
});
