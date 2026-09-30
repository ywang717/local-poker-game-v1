import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { classifyPreflopSituation, normalizeHandClass, weightedPreflopRange } from '../../src/ai/preflopStrategy';
import { toPublicContext } from '../../src/ai/publicContext';

describe('preflop situation and ranges', () => {
  it.each([
    ['UNOPENED', []],
    ['LIMPED', [{ playerId: 'p3', street: 'PRE_FLOP', action: 'call', amount: 10, totalTo: 10 }]],
    ['FACING_OPEN', [{ playerId: 'p3', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 }]],
    ['FACING_3BET', [
      { playerId: 'p3', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 },
      { playerId: 'p4', street: 'PRE_FLOP', action: 'raise-to', amount: 60, totalTo: 90 },
    ]],
    ['FACING_4BET_PLUS', [
      { playerId: 'p3', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 },
      { playerId: 'p4', street: 'PRE_FLOP', action: 'raise-to', amount: 60, totalTo: 90 },
      { playerId: 'p5', street: 'PRE_FLOP', action: 'raise-to', amount: 120, totalTo: 210 },
    ]],
  ] as const)('classifies %s', (expected, actions) => {
    const state = startHand(createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 })),
    }), createDeck('STANDARD'));
    const context = toPublicContext({ ...state, actionHistory: actions.map((action) => ({ ...action })) }, 'p0');
    expect(classifyPreflopSituation(context).situation).toBe(expected);
  });

  it('does not count a short all-in as a new full raise', () => {
    const state = startHand(createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 })),
    }), createDeck('STANDARD'));
    const context = toPublicContext({ ...state, actionHistory: [
      { playerId: 'p3', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 },
      { playerId: 'p4', street: 'PRE_FLOP', action: 'all-in', amount: 14, totalTo: 44 },
    ] }, 'p0');
    expect(classifyPreflopSituation(context)).toMatchObject({ situation: 'FACING_ALL_IN', raiseCount: 1, openerId: 'p3', lastAggressorId: 'p3' });
  });

  it('normalizes standard and short-deck classes and widens only justified ranges', () => {
    const cards = [{ rank: 14, suit: 'spades', id: 'as' }, { rank: 14, suit: 'hearts', id: 'ah' }] as const;
    expect(normalizeHandClass(cards, 'STANDARD')).toMatchObject({ notation: 'AA', category: 'PAIR' });
    expect(normalizeHandClass(cards, 'SHORT_DECK')).toMatchObject({ notation: 'AA', category: 'PAIR' });
    const conservative = weightedPreflopRange({ mode: 'STANDARD', difficulty: 2, position: 'UTG', situation: 'FACING_OPEN' });
    const wide = weightedPreflopRange({ mode: 'STANDARD', difficulty: 5, position: 'BTN', situation: 'UNOPENED' });
    expect(conservative.classes.length).toBe(169);
    expect(wide.classes.length).toBe(169);
    expect(wide.classes.filter((entry) => entry.weight > 0).length).toBeGreaterThan(conservative.classes.filter((entry) => entry.weight > 0).length);
  });
});
