import { describe, expect, it } from 'vitest';
import { analyzePostflopV2, decidePostflopV2 } from '../../src/ai/postflopStrategyV2';
import { PERSONALITIES } from '../../src/ai/personalities';
import { c } from '../game/cards.test';

describe('V2.2 postflop personality boundaries', () => {
  const base = {
    holeCards: [c(9, 'spades'), c(8, 'spades')],
    board: [c(14, 'clubs'), c(9, 'diamonds'), c(4, 'hearts')],
    mode: 'STANDARD' as const,
    potAmount: 100,
    toCall: 35,
    effectiveStack: 100,
    difficulty: 3 as const,
    simulationBudget: 0,
    opponentCount: 1,
    legalActions: ['fold', 'call', 'raise-to'],
  };

  it('allows personality to change marginal call decisions without changing math inputs', () => {
    const tight = decidePostflopV2({ ...base, personality: PERSONALITIES.TIGHT });
    const calling = decidePostflopV2({ ...base, personality: PERSONALITIES.CALLING });
    expect(['FOLD', 'CALL']).toContain(tight);
    expect(['CALL', 'RAISE', 'BET']).toContain(calling);
  });

  it('keeps strong value and pure air boundaries stable across personalities', () => {
    const valueBase = { ...base, holeCards: [c(9, 'spades'), c(9, 'clubs')], board: [c(14, 'clubs'), c(9, 'diamonds'), c(4, 'hearts')], toCall: 0, legalActions: ['check', 'bet-to'] };
    const airBase = { ...base, holeCards: [c(2, 'spades'), c(7, 'hearts')], toCall: 80, legalActions: ['fold', 'call'] };
    for (const personality of Object.values(PERSONALITIES)) {
      expect(['BET', 'RAISE', 'CHECK']).toContain(decidePostflopV2({ ...valueBase, personality }));
      expect(decidePostflopV2({ ...airBase, personality })).toBe('FOLD');
    }
  });

  it('does not let personality alter public equity, pot odds, or SPR', () => {
    const balanced = analyzePostflopV2({ ...base, personality: PERSONALITIES.BALANCED });
    const lag = analyzePostflopV2({ ...base, personality: PERSONALITIES.LOOSE_AGGRESSIVE });
    expect(lag.estimatedEquity).toBe(balanced.estimatedEquity);
    expect(lag.potOdds).toBe(balanced.potOdds);
    expect(lag.spr).toBe(balanced.spr);
    expect(lag.opponentCount).toBe(balanced.opponentCount);
  });
});
