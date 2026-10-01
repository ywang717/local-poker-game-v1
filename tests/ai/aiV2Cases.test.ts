import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai/aiEngine';
import { PERSONALITIES } from '../../src/ai/personalities';
import { getPersonality } from '../../src/ai/personalities';
import type { PublicTableContext } from '../../src/ai/publicContext';
import { c } from '../game/cards.test';

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
function context(cards: [[number, Suit], [number, Suit]], position: PublicTableContext['position'], detailedPosition: NonNullable<PublicTableContext['detailedPosition']>, history: PublicTableContext['actionHistory'] = [], overrides: Partial<PublicTableContext> = {}): PublicTableContext {
  const self = { id: 'ai', name: 'AI', seat: 0, stack: 1000, isHuman: false, streetContribution: 0, handContribution: 0, folded: false, allIn: false, hasActedStreet: false, status: 'ACTIVE' as const, holeCards: [c(cards[0][0] as never, cards[0][1]), c(cards[1][0] as never, cards[1][1])] };
  const opener = { id: 'utg', name: 'UTG', seat: 3, stack: 1000, isHuman: false, streetContribution: 30, handContribution: 30, folded: false, allIn: false, hasActedStreet: true, status: 'ACTIVE' as const };
  return { aiPlayerId: 'ai', aiSeat: 0, mode: 'STANDARD', tableSize: 6, street: 'PRE_FLOP', dealerSeat: 0, smallBlindSeat: 1, bigBlindSeat: 2, smallBlind: 5, bigBlind: 10, actingSeat: 0, currentBet: 30, lastFullRaise: 20, potAmount: 65, toCall: 30, position, detailedPosition, communityCards: [], self, players: [self, opener], opponents: [opener], sidePots: [], actionHistory: history, legalActions: [{ kind: 'fold' }, { kind: 'call', amount: 30 }, { kind: 'raise-to', minAmount: 50, maxAmount: 1000 }, { kind: 'all-in', amount: 1000 }], opponentModels: {}, ...overrides };
}
const facingOpen = [{ playerId: 'utg', street: 'PRE_FLOP' as const, action: 'raise-to' as const, amount: 20, totalTo: 30 }];
const facing3Bet = [...facingOpen, { playerId: 'villain', street: 'PRE_FLOP' as const, action: 'raise-to' as const, amount: 60, totalTo: 90 }];

describe('V2 deterministic pre-flop matrix', () => {
  it.each([
    ['AA', [[14, 'spades'], [14, 'hearts']] as [[number, Suit], [number, Suit]]],
    ['KK', [[13, 'spades'], [13, 'hearts']] as [[number, Suit], [number, Suit]]],
    ['QQ', [[12, 'spades'], [12, 'hearts']] as [[number, Suit], [number, Suit]]],
    ['JJ', [[11, 'spades'], [11, 'hearts']] as [[number, Suit], [number, Suit]]],
    ['AKs', [[14, 'spades'], [13, 'spades']] as [[number, Suit], [number, Suit]]],
    ['AQs', [[14, 'spades'], [12, 'spades']] as [[number, Suit], [number, Suit]]],
  ])('%s value 3-bets facing an UTG open', (_name, cards) => {
    const action = chooseAction(context(cards, 'LATE', 'BTN', facingOpen), 4, PERSONALITIES.BALANCED, () => 0.5);
    expect(['raise-to', 'bet-to', 'all-in']).toContain(action.kind);
  });

  it('keeps A5s as a bounded bluff and folds 87o/72o against UTG', () => {
    const bluff = chooseAction(context([[14, 'spades'], [5, 'spades']], 'LATE', 'BTN', facingOpen), 5, PERSONALITIES.BALANCED, () => 0);
    expect(['raise-to', 'bet-to']).toContain(bluff.kind);
    for (const cards of [[[8, 'spades'], [7, 'hearts']], [[7, 'spades'], [2, 'hearts']]] as [[number, Suit], [number, Suit]][]) {
      const action = chooseAction(context(cards, 'LATE', 'BTN', facingOpen), 5, PERSONALITIES.BALANCED, () => 0.99);
      expect(action.kind).not.toBe('raise-to'); expect(action.kind).not.toBe('bet-to'); expect(action.kind).not.toBe('all-in');
    }
  });

  it.each(['CO', 'BTN', 'BB'] as const)('uses position-specific behavior for %s', (position) => {
    const action = chooseAction(context([[14, 'spades'], [5, 'spades']], position === 'BB' ? 'BLINDS' : 'LATE', position, facingOpen), 4, PERSONALITIES.BALANCED, () => 0);
    if (position === 'CO' || position === 'BTN') expect(['raise-to', 'bet-to']).toContain(action.kind);
    else expect(action.kind).toBe('call');
  });

  it('uses an independent 4-Bet branch and allows a bounded A5s bluff', () => {
    const options = { currentBet: 90, toCall: 90, lastFullRaise: 60, potAmount: 150, legalActions: [{ kind: 'fold' as const }, { kind: 'call' as const, amount: 90 }, { kind: 'raise-to' as const, minAmount: 150, maxAmount: 1000 }, { kind: 'all-in' as const, amount: 1000 }] };
    const value = chooseAction(context([[14, 'spades'], [14, 'hearts']], 'LATE', 'BTN', facing3Bet, options), 5, PERSONALITIES.BALANCED, () => 0.5);
    expect(['raise-to', 'bet-to', 'all-in']).toContain(value.kind);
    const bluff = chooseAction(context([[14, 'spades'], [5, 'spades']], 'LATE', 'BTN', facing3Bet, options), 5, PERSONALITIES.BALANCED, () => 0);
    expect(['call', 'raise-to', 'bet-to']).toContain(bluff.kind);
  });

  it('never folds a free BB check', () => {
    const table = context([[7, 'spades'], [2, 'hearts']], 'BLINDS', 'BB', [], { currentBet: 0, toCall: 0, potAmount: 15, legalActions: [{ kind: 'fold' }, { kind: 'check' }, { kind: 'bet-to', minAmount: 10, maxAmount: 1000 }, { kind: 'all-in', amount: 1000 }] });
    expect(chooseAction(table, 2, PERSONALITIES.BALANCED, () => 0.99)).toEqual({ kind: 'check' });
  });

  it('gates deep-stack and effective-stack All-ins', () => {
    const deep = chooseAction(context([[14, 'spades'], [14, 'hearts']], 'LATE', 'BTN', facingOpen), 5, PERSONALITIES.BALANCED, () => 0);
    expect(deep.kind).not.toBe('all-in');
    const base = context([[14, 'spades'], [14, 'hearts']], 'LATE', 'BTN', facingOpen);
    const shortOpponent = { ...base.players[1], stack: 100 };
    const shortEffective = chooseAction({ ...base, players: [base.players[0], shortOpponent], opponents: [shortOpponent] }, 5, PERSONALITIES.BALANCED, () => 0);
    expect(shortEffective.kind).toBe('all-in');
  });

  it('uses explicit tournament pressure independently of blind size', () => {
    const table = context([[13, 'spades'], [11, 'hearts']], 'LATE', 'BTN', facingOpen, { potAmount: 100 });
    const cash = chooseAction(table, 3, PERSONALITIES.BALANCED, () => 0.5, { matchType: 'CASH' });
    const tournament = chooseAction(table, 3, PERSONALITIES.BALANCED, () => 0.5, { matchType: 'MINI_TOURNAMENT', tournament: { effectiveStackBB: 100, pressure: 0.2, playersRemaining: 3 } });
    expect(cash.kind).toBe('call');
    expect(tournament.kind).toBe('fold');
    const staged = chooseAction(table, 3, PERSONALITIES.BALANCED, () => 0.5, { matchType: 'MINI_TOURNAMENT', tournament: { effectiveStackBB: 100, blindLevel: 5, handsAtLevel: 8, playersRemaining: 2 } });
    expect(staged.kind).toBe('fold');
  });

  it('calls a short non-reopening all-in instead of raising it', () => {
    const shortAllIn = [...facingOpen, { playerId: 'short', street: 'PRE_FLOP' as const, action: 'all-in' as const, amount: 10, totalTo: 40, isFullRaise: false }];
    const table = context([[14, 'spades'], [14, 'hearts']], 'LATE', 'BTN', shortAllIn, { currentBet: 40, toCall: 40, lastFullRaise: 20, legalActions: [{ kind: 'fold' }, { kind: 'call', amount: 40 }, { kind: 'all-in', amount: 1000 }] });
    expect(chooseAction(table, 5, PERSONALITIES.BALANCED, () => 0)).toEqual({ kind: 'call' });
  });

  it('keeps personality adjustments bounded', () => {
    const extreme = getPersonality({ id: 'TIGHT', label: 'x', looseness: 9, aggression: -9, callBias: 9, bluffFrequency: -9 });
    expect(extreme.looseness).toBeLessThanOrEqual(0.12);
    expect(extreme.aggression).toBeGreaterThanOrEqual(-0.12);
    expect(extreme.callBias).toBeLessThanOrEqual(0.12);
    expect(extreme.bluffFrequency).toBeGreaterThanOrEqual(-0.1);
  });
});
