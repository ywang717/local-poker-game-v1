import { describe, expect, it } from 'vitest';
import { boundedPublicEquity, decidePostflopV2 } from '../../src/ai/postflopStrategyV2';
import { c } from '../game/cards.test';

describe('V2 post-flop strategy', () => {
  it('keeps a weak board-only hand in pot control', () => {
    const action = decidePostflopV2({
      holeCards: [c(2, 'spades'), c(7, 'hearts')],
      board: [c(14, 'clubs'), c(9, 'diamonds'), c(4, 'hearts')],
      mode: 'STANDARD', potAmount: 40, toCall: 0, effectiveStack: 100, priorAggressor: 'OPPONENT', opponentCount: 1,
      difficulty: 3, canCheck: true, canCall: false, canBet: true, canRaise: false,
    });
    expect(action).toBe('CHECK');
  });

  it('lets board texture change a marginal made-hand decision', () => {
    const base = {
      holeCards: [c(9, 'spades'), c(13, 'hearts')], board: [c(14, 'clubs'), c(9, 'diamonds'), c(4, 'hearts')], mode: 'STANDARD' as const,
      potAmount: 40, toCall: 0, effectiveStack: 100, priorAggressor: 'OPPONENT' as const, opponentCount: 1, difficulty: 3 as const,
      canCheck: true, canCall: false, canBet: true, canRaise: false,
    };
    expect(decidePostflopV2({ ...base, boardTexture: 'DRY' })).toBe('BET');
    expect(decidePostflopV2({ ...base, boardTexture: 'WET' })).toBe('CHECK');
  });

  it('models every opponent in a multi-way equity sample', () => {
    const base = {
      holeCards: [c(14, 'hearts'), c(13, 'hearts')],
      board: [c(14, 'spades'), c(9, 'diamonds'), c(2, 'clubs')],
      mode: 'STANDARD' as const,
      potAmount: 100,
      toCall: 0,
      effectiveStack: 1_000,
      simulationBudget: 48,
    };
    const headsUp = boundedPublicEquity({ ...base, opponentCount: 1 }, 48);
    const threeWay = boundedPublicEquity({ ...base, opponentCount: 2 }, 48);
    const fourWay = boundedPublicEquity({ ...base, opponentCount: 3 }, 48);
    expect(headsUp).toBeGreaterThan(threeWay);
    expect(threeWay).toBeGreaterThanOrEqual(fourWay);
  });

  it('keeps a made nuts hand at full equity in heads-up and multi-way pots', () => {
    const base = {
      holeCards: [c(14, 'spades'), c(13, 'spades')],
      board: [c(12, 'spades'), c(11, 'spades'), c(10, 'spades')],
      mode: 'STANDARD' as const,
      potAmount: 100,
      toCall: 0,
      effectiveStack: 1_000,
      simulationBudget: 32,
    };
    expect(boundedPublicEquity({ ...base, opponentCount: 1 }, 32)).toBe(1);
    expect(boundedPublicEquity({ ...base, opponentCount: 3 }, 32)).toBe(1);
  });
});
