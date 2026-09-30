import { describe, expect, it } from 'vitest';
import { calculatePotOdds, calculateSpr, selectBetFraction } from '../../src/ai/decisionFeatures';

describe('AI decision features', () => {
  it('calculates the call price against the resulting pot', () => {
    expect(calculatePotOdds(10, 90)).toBeCloseTo(0.1);
    expect(calculatePotOdds(0, 90)).toBe(0);
  });

  it('calculates effective stack to pot ratio without dividing by zero', () => {
    expect(calculateSpr(100, 50)).toBe(2);
    expect(calculateSpr(100, 0)).toBe(100);
  });

  it('uses recognizable training bet sizes for value, draw and bluff decisions', () => {
    expect(selectBetFraction({ street: 'FLOP', strength: 0.9, drawPotential: 0, spr: 5, intent: 'VALUE' })).toBe(0.66);
    expect(selectBetFraction({ street: 'TURN', strength: 0.45, drawPotential: 0.25, spr: 4, intent: 'SEMI_BLUFF' })).toBe(0.5);
    expect(selectBetFraction({ street: 'RIVER', strength: 0.2, drawPotential: 0, spr: 8, intent: 'BLUFF' })).toBe(0.33);
  });
});
