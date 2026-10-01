import { describe, expect, it } from 'vitest';
import { runAIExperienceSimulation } from '../../src/simulation/aiExperienceSimulation';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { toPublicContext } from '../../src/ai/publicContext';
import { createExperienceAccumulator, observeExperienceAction } from '../../src/simulation/aiExperienceSimulation';

describe('AI experience baseline harness', () => {
  it('completes seeded hands and exposes deterministic numerator/denominator metrics', () => {
    const options = { mode: 'STANDARD' as const, tableSize: 3 as const, hands: 25, seed: 0x20261001, difficulty: 3 as const };
    const first = runAIExperienceSimulation(options);
    const second = runAIExperienceSimulation(options);
    expect(first.handsCompleted).toBe(25);
    expect(first.digest).toBe(second.digest);
    expect(first.metrics.vpip.denominator).toBeGreaterThan(0);
    expect(first.metrics.actions.denominator).toBe(first.actions);
  });

  it.each([
    ['blind-only', [], 'threeBet', 0],
    ['facing-open', [{ playerId: 'p3', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 }], 'threeBet', 1],
    ['facing-3bet', [
      { playerId: 'p3', street: 'PRE_FLOP', action: 'raise-to', amount: 20, totalTo: 30 },
      { playerId: 'p4', street: 'PRE_FLOP', action: 'raise-to', amount: 60, totalTo: 90 },
    ], 'fourBet', 1],
  ] as const)('counts the action against the prior situation for %s', (_name, history, metric, expected) => {
    const state = startHand(createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 })),
    }), createDeck('STANDARD'));
    const context = toPublicContext({ ...state, actionHistory: history.map((action) => ({ ...action })) }, 'p0');
    const accumulator = createExperienceAccumulator();
    observeExperienceAction(accumulator, context, { kind: 'raise-to', amount: 100 });
    expect(accumulator.metrics[metric].numerator).toBe(expected);
    expect(accumulator.metrics[metric].denominator).toBe(expected);
  });

  it.each([
    ['short all-in call', 0, 14, 0],
    ['short all-in raise that does not reopen', 30, 14, 0],
    ['full all-in raise', 30, 30, 1],
  ] as const)('counts only a full all-in as a 3-Bet: %s', (_name, contribution, stack, expected) => {
    const state = startHand(createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 })),
    }), createDeck('STANDARD'));
    const open = { playerId: 'p3', street: 'PRE_FLOP' as const, action: 'raise-to' as const, amount: 20, totalTo: 30 };
    const base = toPublicContext({ ...state, actionHistory: [open] }, 'p0');
    const context = {
      ...base,
      currentBet: 30,
      lastFullRaise: 20,
      self: { ...base.self, streetContribution: contribution, stack },
    };
    const accumulator = createExperienceAccumulator();
    observeExperienceAction(accumulator, context, { kind: 'all-in' });
    expect(accumulator.metrics.threeBet).toEqual({ numerator: expected, denominator: 1 });
  });
});
