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
