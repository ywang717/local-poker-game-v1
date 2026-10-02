import { describe, expect, it } from 'vitest';
import { boardFeatures, boundedPublicEquity, decidePostflopV2 } from '../../src/ai/postflopStrategyV2';
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

  it('returns a value raise when a set faces a post-flop bet', () => {
    const action = decidePostflopV2({
      holeCards: [c(9, 'spades'), c(9, 'clubs')], board: [c(14, 'clubs'), c(9, 'diamonds'), c(4, 'hearts')],
      mode: 'STANDARD', potAmount: 100, toCall: 35, effectiveStack: 100, difficulty: 3, simulationBudget: 0,
      opponentCount: 1, legalActions: ['fold', 'call', 'raise-to'],
    });
    expect(action).toBe('RAISE');
  });

  it('folds river air facing a pot-sized bet and does not treat a shared board hand as private value', () => {
    expect(decidePostflopV2({
      holeCards: [c(3, 'spades'), c(6, 'hearts')],
      board: [c(14, 'clubs'), c(13, 'diamonds'), c(9, 'hearts'), c(7, 'clubs'), c(2, 'spades')],
      mode: 'STANDARD', potAmount: 100, toCall: 100, effectiveStack: 500,
      difficulty: 2, simulationBudget: 0, legalActions: ['fold', 'call', 'raise-to'],
    })).toBe('FOLD');
    expect(decidePostflopV2({
      holeCards: [c(2, 'spades'), c(3, 'hearts')],
      board: [c(14, 'clubs'), c(14, 'diamonds'), c(14, 'hearts'), c(13, 'clubs'), c(13, 'spades')],
      mode: 'STANDARD', potAmount: 100, toCall: 50, effectiveStack: 500,
      difficulty: 2, simulationBudget: 0, legalActions: ['fold', 'call', 'raise-to'],
    })).not.toBe('RAISE');
  });

  it('keeps composite board features instead of choosing one mutually exclusive texture', () => {
    expect(boardFeatures([c(8, 'spades'), c(8, 'hearts'), c(9, 'clubs')])).toMatchObject({ paired: true, connected: true });
    expect(boardFeatures([c(14, 'spades'), c(14, 'hearts'), c(7, 'clubs')])).toMatchObject({ paired: true, highCardHeavy: true });
    expect(boardFeatures([c(14, 'spades'), c(13, 'spades'), c(2, 'spades')])).toMatchObject({ monotone: true, twoTone: true });
    expect(boardFeatures([c(14, 'spades'), c(13, 'hearts'), c(2, 'clubs')]).connected).toBe(false);
  });
});
