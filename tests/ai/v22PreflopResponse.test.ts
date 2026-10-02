import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai/aiEngine';
import { PERSONALITIES } from '../../src/ai/personalities';
import type { PublicTableContext } from '../../src/ai/publicContext';
import { c } from '../game/cards.test';

function context(overrides: Partial<PublicTableContext> = {}): PublicTableContext {
  const self = { id: 'ai', name: 'AI', seat: 0, stack: 1_000, isHuman: false, streetContribution: 80, handContribution: 80, folded: false, allIn: false, hasActedStreet: false, status: 'ACTIVE' as const, holeCards: [c(10, 'spades'), c(9, 'spades')] };
  const opener = { id: 'opener', name: 'Opener', seat: 3, stack: 500, isHuman: false, streetContribution: 80, handContribution: 80, folded: false, allIn: false, hasActedStreet: true, status: 'ACTIVE' as const, detailedPosition: 'UTG' as const };
  return { aiPlayerId: 'ai', aiSeat: 0, mode: 'STANDARD', tableSize: 6, street: 'PRE_FLOP', dealerSeat: 0, smallBlindSeat: 1, bigBlindSeat: 2, smallBlind: 5, bigBlind: 10, actingSeat: 0, currentBet: 80, lastFullRaise: 50, potAmount: 170, toCall: 80, position: 'LATE', detailedPosition: 'BTN', communityCards: [], self, players: [self, opener], opponents: [opener], sidePots: [], actionHistory: [{ playerId: 'opener', street: 'PRE_FLOP', action: 'raise-to', amount: 70, totalTo: 80 }], legalActions: [{ kind: 'fold' }, { kind: 'call', amount: 80 }, { kind: 'raise-to', minAmount: 160, maxAmount: 1_000 }, { kind: 'all-in', amount: 1_000 }], opponentModels: {}, ...overrides };
}

describe('V2.2 preflop response tree', () => {
  it('allows a medium hand to call a large open price without a fixed pot-ratio gate', () => {
    expect(chooseAction(context(), 3, PERSONALITIES.BALANCED, () => 0.99)).toEqual({ kind: 'call' });
  });

  it('maps a value raise through the legal action set', () => {
    const action = chooseAction(context({ self: { ...context().self, holeCards: [c(14, 'spades'), c(14, 'hearts')] }, legalActions: [{ kind: 'fold' }, { kind: 'call', amount: 80 }, { kind: 'all-in', amount: 1_000 }] }), 5, PERSONALITIES.BALANCED, () => 0.5);
    expect(action).toEqual({ kind: 'all-in' });
  });

  it('keeps personality differences directional without widening trash', () => {
    const marginal = context({ self: { ...context().self, holeCards: [c(9, 'spades'), c(9, 'hearts')] } });
    const counts = (personality: keyof typeof PERSONALITIES) => {
      const result = { call: 0, raise: 0, fold: 0 };
      for (let seed = 1; seed <= 80; seed += 1) {
        const action = chooseAction(marginal, 4, PERSONALITIES[personality], () => ((seed * 1103515245 + 12345) >>> 0) / 0x1_0000_0000);
        if (action.kind === 'call') result.call += 1;
        else if (action.kind === 'raise-to' || action.kind === 'bet-to' || action.kind === 'all-in') result.raise += 1;
        else result.fold += 1;
      }
      return result;
    };
    const calling = counts('CALLING');
    const tight = counts('TIGHT');
    const lag = counts('LOOSE_AGGRESSIVE');
    expect(calling.call).toBeGreaterThanOrEqual(tight.call);
    expect(lag.raise).toBeGreaterThanOrEqual(tight.raise);
    const trash = context({ self: { ...context().self, holeCards: [c(7, 'spades'), c(2, 'hearts')] } });
    for (const personality of Object.values(PERSONALITIES)) {
      expect(chooseAction(trash, 5, personality, () => 0.01).kind).not.toBe('raise-to');
    }
  });
});
