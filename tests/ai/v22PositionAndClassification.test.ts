import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { positionForDetailed, positionInfoFor } from '../../src/ai/positionStrategy';
import { classifyPreflopSituation } from '../../src/ai/preflopStrategy';
import { toPublicContext } from '../../src/ai/publicContext';

describe('V2.2 canonical positions and preflop classification', () => {
  it('exposes heads-up button and blind roles from the same fixed position source', () => {
    const state = startHand(createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [
      { id: 'button', seat: 0, stack: 100 }, { id: 'bb', seat: 1, stack: 100 },
    ] }), createDeck('STANDARD'));
    expect(positionForDetailed(state, 'button')).toBe('HEADS_UP');
    expect(positionInfoFor(state, 'button')).toMatchObject({ detailedPosition: 'HEADS_UP', isButton: true, isSmallBlind: true, isBigBlind: false, inPosition: true });
    const context = toPublicContext(state, 'button');
    expect(context.self).toMatchObject({ detailedPosition: 'HEADS_UP', isButton: true, isSmallBlind: true, isBigBlind: false, inPosition: true });
    expect(context.opponents[0]).toMatchObject({ isBigBlind: true, isButton: false, isSmallBlind: false });
  });

  it('uses the current opener or aggressor for effective stack instead of an unrelated short seat', () => {
    const state = startHand(createTable({ mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [
      { id: 'ai', seat: 0, stack: 1_000 }, { id: 'opener', seat: 3, stack: 500 }, { id: 'short', seat: 4, stack: 10 },
    ] }), createDeck('STANDARD'));
    const context = toPublicContext({ ...state, actionHistory: [
      { playerId: 'opener', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 },
    ] }, 'ai');
    expect(classifyPreflopSituation(context)).toMatchObject({ situation: 'FACING_OPEN', openerId: 'opener', lastAggressorId: 'opener', effectiveStack: 500 });
  });

  it('keeps a short non-full all-in as a jam response without replacing the open count', () => {
    const state = startHand(createTable({ mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [
      { id: 'ai', seat: 0, stack: 1_000 }, { id: 'opener', seat: 3, stack: 500 }, { id: 'short', seat: 4, stack: 40 },
    ] }), createDeck('STANDARD'));
    const context = toPublicContext({ ...state, currentBet: 40, actionHistory: [
      { playerId: 'opener', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 },
      { playerId: 'short', street: 'PRE_FLOP', action: 'all-in', amount: 40, totalTo: 40, isFullRaise: false },
    ] }, 'ai');
    expect(classifyPreflopSituation(context)).toMatchObject({ situation: 'FACING_ALL_IN', raiseCount: 1, openerId: 'opener', lastAggressorId: 'opener', effectiveStack: 40 });
  });

  it('does not classify an all-in call as a jam and preserves the opener stack', () => {
    const state = startHand(createTable({ mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [
      { id: 'ai', seat: 0, stack: 1_000 }, { id: 'opener', seat: 3, stack: 500 }, { id: 'short', seat: 4, stack: 20 },
    ] }), createDeck('STANDARD'));
    const context = toPublicContext({ ...state, currentBet: 30, actionHistory: [
      { playerId: 'opener', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30, stackBeforeAction: 500, previousBet: 10, increase: 20, isAggressiveRaise: true, isFullRaise: true },
      { playerId: 'short', street: 'PRE_FLOP', action: 'all-in', amount: 20, totalTo: 30, stackBeforeAction: 20, previousBet: 30, increase: 0, isAllInCall: true, isAggressiveRaise: false, isFullRaise: false },
    ] }, 'ai');
    expect(classifyPreflopSituation(context)).toMatchObject({ situation: 'FACING_OPEN', jamAggressorId: undefined, jamIsCall: true, effectiveStack: 500 });
  });

  it('uses the stack before the action when classifying a jam', () => {
    const state = startHand(createTable({ mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [
      { id: 'ai', seat: 0, stack: 1_000 }, { id: 'jammer', seat: 3, stack: 100 },
    ] }), createDeck('STANDARD'));
    const context = toPublicContext({ ...state, currentBet: 100, actionHistory: [
      { playerId: 'jammer', street: 'PRE_FLOP', action: 'all-in', amount: 100, totalTo: 100, stackBeforeAction: 100, previousBet: 10, increase: 90, isAllInCall: false, isAggressiveRaise: true, isFullRaise: true },
    ] }, 'ai');
    expect(classifyPreflopSituation(context)).toMatchObject({ situation: 'FACING_ALL_IN', jamAggressorId: 'jammer', effectiveStack: 100, jamIsFullRaise: true, jamIncrement: 90 });
  });
});
