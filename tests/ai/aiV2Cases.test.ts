import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai/aiEngine';
import { PERSONALITIES } from '../../src/ai/personalities';
import type { PublicTableContext } from '../../src/ai/publicContext';
import { c } from '../game/cards.test';

function context(cards: Parameters<typeof c>[], position: PublicTableContext['position'], history: PublicTableContext['actionHistory']): PublicTableContext {
  const self = { id: 'ai', name: 'AI', seat: 0, stack: 1000, isHuman: false, streetContribution: 0, handContribution: 0, folded: false, allIn: false, hasActedStreet: false, status: 'ACTIVE' as const, holeCards: cards.map(([rank, suit]) => c(rank as never, suit as never)) };
  return { aiPlayerId: 'ai', aiSeat: 0, mode: 'STANDARD', tableSize: 6, street: 'PRE_FLOP', dealerSeat: 4, smallBlindSeat: 5, bigBlindSeat: 0, smallBlind: 5, bigBlind: 10, actingSeat: 0, currentBet: 30, lastFullRaise: 20, potAmount: 65, toCall: 30, position, detailedPosition: position === 'LATE' ? 'BTN' : 'UTG', communityCards: [], self, players: [self], opponents: [], sidePots: [], actionHistory: history, legalActions: [{ kind: 'fold' }, { kind: 'call', amount: 30 }, { kind: 'raise-to', minAmount: 50, maxAmount: 1000 }, { kind: 'all-in', amount: 1000 }], opponentModels: {} };
}

describe('V2 deterministic pre-flop cases', () => {
  it('does not routine 3-bet 72o from BTN against UTG', () => {
    const action = chooseAction(context([[7, 'spades'], [2, 'hearts']], 'LATE', [{ playerId: 'utg', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 }]), 5, PERSONALITIES.BALANCED, () => 0.01);
    expect(action.kind).not.toBe('raise-to');
    expect(action.kind).not.toBe('all-in');
  });
});
