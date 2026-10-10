import { describe, expect, it } from 'vitest';
import { createCard } from '../../src/game/cards';
import { aggregateHandStats, createHandStatsFact, startingHandClasses, startingHandNotation } from '../../src/career/handStats';
import type { HandSummary } from '../../src/career/handHistory';

function summary(overrides: Partial<HandSummary> = {}): HandSummary {
  return {
    handId: 'hand-1', matchType: 'CASH', timestamp: '2026-10-09T00:00:00.000Z', mode: 'STANDARD', tableLevel: 1, tableSize: 6,
    smallBlind: 25, bigBlind: 50, dealerSeat: 0, playerHoleCards: [createCard(14, 'spades'), createCard(13, 'spades')], communityCards: [],
    finalCategory: null, finalPot: 300, playerContribution: 100, playerNet: 200, result: 'WIN', actionHistory: [], ...overrides,
  };
}

describe('long-term starting hand facts', () => {
  it('uses standard and short-deck notation and exposes complete matrix sizes', () => {
    expect(startingHandNotation([createCard(10, 'spades'), createCard(10, 'hearts')], 'STANDARD')).toBe('TT');
    expect(startingHandNotation([createCard(14, 'spades'), createCard(6, 'hearts')], 'SHORT_DECK')).toBe('A6o');
    expect(startingHandClasses('STANDARD')).toHaveLength(169);
    expect(startingHandClasses('SHORT_DECK')).toHaveLength(81);
  });

  it('records win, split, partial win and preflop metrics idempotently', () => {
    const win = createHandStatsFact(summary(), 'career-1')!;
    const split = createHandStatsFact(summary({ handId: 'hand-2', result: 'SPLIT', playerNet: 0 }), 'career-1')!;
    const partial = createHandStatsFact(summary({ handId: 'hand-3', result: 'PARTIAL_WIN', playerNet: 20 }), 'career-1')!;
    const aggregate = aggregateHandStats([win, split, partial], ['AKs'])[0];
    expect(aggregate).toMatchObject({ hands: 3, wins: 1, splits: 1, partialWins: 1, losses: 0, totalProfitBB: 4.4 });
  });
});

it('uses per-metric coverage rather than inventing legacy zero values', () => {
  const fact = createHandStatsFact(summary(), 'legacy')!;
  expect(fact.initialStack).toBeNull();
  expect(fact.position).toBeNull();
  expect(fact.vpip).toBe(0);
  expect(fact.sawFlop).toBe(0);
  expect(aggregateHandStats([fact])[0].vpipOpportunities).toBe(0);
  expect(aggregateHandStats([fact])[0].streetOpportunities).toBe(0);
});
it('counts a short all-in raise as PFR but never as a full 3-bet', () => {
  const fact = createHandStatsFact(summary({ vpip: true, actionHistory: [{ playerId: 'human', street: 'PRE_FLOP', action: 'all-in', amount: 40, totalTo: 40, previousBet: 30, isAggressiveRaise: true, isFullRaise: false }] }), 'c')!;
  expect(fact.pfr).toBe(1);
  expect(fact.vpip).toBe(1);
  expect(fact.threeBet).toBe(0);
});
it('does not count an unopened pot as a 3-bet opportunity', () => {
  const fact = createHandStatsFact(summary({ actionHistory: [{ playerId: 'human', street: 'PRE_FLOP', action: 'raise-to', amount: 30, totalTo: 30, previousBet: 10, isAggressiveRaise: true, isFullRaise: true }] }), 'c')!;
  expect(fact.threeBetOpportunity).toBe(0);
});
it('keeps legacy result classification when eligible-player metadata is unavailable', () => {
  const fact = createHandStatsFact(summary({
    result: 'WIN',
    potResults: [{ amount: 100, winnerPlayerIds: ['human'], awards: [{ playerId: 'human', amount: 100 }] }],
  }), 'legacy-pot')!;
  expect(fact.result).toBe('WIN');
  expect(fact.wins).toBe(1);
});
