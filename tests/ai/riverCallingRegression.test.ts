import { describe, expect, it } from 'vitest';
import { classifyRiverHand, decidePostflopV2 } from '../../src/ai/postflopStrategyV2';
import { PERSONALITIES } from '../../src/ai/personalities';
import { c } from '../game/cards.test';

const standardBoard = [c(14, 'clubs'), c(13, 'diamonds'), c(9, 'hearts'), c(5, 'clubs'), c(2, 'spades')];
const shortDeckBoard = [c(13, 'clubs'), c(12, 'diamonds'), c(9, 'hearts'), c(7, 'clubs'), c(6, 'spades')];

describe('river hand quality and facing-bet response', () => {
  it('classifies board-only, weak, middle, top-pair kicker, overpair and two-pair-plus hands', () => {
    expect(classifyRiverHand([c(6, 'hearts'), c(8, 'hearts')], standardBoard, 'STANDARD')).toBe('AIR');
    expect(classifyRiverHand([c(3, 'hearts'), c(4, 'hearts')], [c(14, 'clubs'), c(14, 'diamonds'), c(13, 'hearts'), c(9, 'clubs'), c(8, 'spades')], 'STANDARD')).toBe('BOARD_ONLY_PAIR');
    expect(classifyRiverHand([c(3, 'hearts'), c(4, 'hearts')], [c(14, 'clubs'), c(13, 'diamonds'), c(12, 'hearts'), c(9, 'clubs'), c(8, 'spades')], 'STANDARD')).toBe('AIR');
    expect(classifyRiverHand([c(5, 'diamonds'), c(7, 'hearts')], standardBoard, 'STANDARD')).toBe('WEAK_PAIR');
    expect(classifyRiverHand([c(13, 'spades'), c(7, 'hearts')], standardBoard, 'STANDARD')).toBe('MIDDLE_PAIR');
    expect(classifyRiverHand([c(14, 'hearts'), c(12, 'hearts')], standardBoard, 'STANDARD')).toBe('TOP_PAIR_GOOD_KICKER');
    expect(classifyRiverHand([c(14, 'hearts'), c(4, 'hearts')], standardBoard, 'STANDARD')).toBe('TOP_PAIR_WEAK_KICKER');
    expect(classifyRiverHand([c(10, 'hearts'), c(10, 'diamonds')], [c(9, 'clubs'), c(8, 'diamonds'), c(5, 'hearts'), c(3, 'clubs'), c(2, 'spades')], 'STANDARD')).toBe('OVERPAIR');
    expect(classifyRiverHand([c(14, 'hearts'), c(13, 'hearts')], standardBoard, 'STANDARD')).toBe('TWO_PAIR_PLUS');
  });

  it.each([
    ['STANDARD', standardBoard],
    ['SHORT_DECK', shortDeckBoard],
  ] as const)('%s keeps air folded and weak-pair calls selective across bet sizes and personalities', (mode, board) => {
    const weakPair = mode === 'STANDARD'
      ? [c(5, 'diamonds'), c(7, 'hearts')]
      : [c(7, 'diamonds'), c(8, 'hearts')];
    const air = mode === 'STANDARD'
      ? [c(6, 'spades'), c(8, 'hearts')]
      : [c(14, 'spades'), c(11, 'hearts')];
    for (const personality of Object.values(PERSONALITIES)) {
      for (const difficulty of [1, 2, 3, 4, 5] as const) {
        const input = {
          mode, board, potAmount: 100, effectiveStack: 1_000,
          difficulty, simulationBudget: 0, personality,
          legalActions: ['fold', 'call', 'raise-to'],
        };
        for (const fraction of [0.33, 0.66, 1, 1.5]) {
          const toCall = Math.round(100 * fraction);
          expect(decidePostflopV2({ ...input, holeCards: air, toCall })).toBe('FOLD');
          if (fraction >= 1) {
            expect(decidePostflopV2({ ...input, holeCards: weakPair, toCall })).toBe('FOLD');
          }
        }
      }
    }
  });

  it('keeps top pair with a strong kicker in at a small price and protects strong made hands', () => {
    const common = {
      mode: 'STANDARD' as const, board: standardBoard, potAmount: 100, toCall: 33,
      effectiveStack: 1_000, simulationBudget: 0, difficulty: 3 as const,
      legalActions: ['fold', 'call', 'raise-to'],
    };
    for (const personality of Object.values(PERSONALITIES)) {
      expect(decidePostflopV2({ ...common, holeCards: [c(14, 'hearts'), c(12, 'hearts')], personality })).not.toBe('FOLD');
      expect(decidePostflopV2({ ...common, holeCards: [c(14, 'hearts'), c(13, 'hearts')], personality })).not.toBe('FOLD');
    }
  });

  it('keeps strong made hands in across both rule modes, all difficulties and river bet sizes', () => {
    const scenarios = [
      { mode: 'STANDARD' as const, board: standardBoard, holeCards: [c(14, 'hearts'), c(13, 'hearts')] },
      { mode: 'SHORT_DECK' as const, board: shortDeckBoard, holeCards: [c(13, 'hearts'), c(12, 'hearts')] },
    ];
    for (const scenario of scenarios) {
      for (const personality of Object.values(PERSONALITIES)) {
        for (const difficulty of [1, 2, 3, 4, 5] as const) {
          for (const fraction of [0.33, 0.66, 1, 1.5]) {
            expect(decidePostflopV2({
              ...scenario, potAmount: 100, toCall: Math.round(100 * fraction), effectiveStack: 1_000,
              simulationBudget: 0, difficulty, personality, legalActions: ['fold', 'call', 'raise-to'],
            })).not.toBe('FOLD');
          }
        }
      }
    }
  });

  it('tightens weak-pair continuation when more than one opponent remains', () => {
    const base = {
      holeCards: [c(5, 'diamonds'), c(7, 'hearts')], board: standardBoard,
      mode: 'STANDARD' as const, potAmount: 100, toCall: 33, effectiveStack: 1_000,
      simulationBudget: 0, difficulty: 3 as const, personality: 'BALANCED' as const,
      legalActions: ['fold', 'call', 'raise-to'],
    };
    const headsUp = decidePostflopV2({ ...base, opponentCount: 1 });
    const multiway = decidePostflopV2({ ...base, opponentCount: 3 });
    expect(headsUp).toBe('CALL');
    expect(multiway).toBe('FOLD');
  });

  it('uses the public river aggression line to tighten a marginal bluff-catch', () => {
    const base = {
      holeCards: [c(5, 'diamonds'), c(7, 'hearts')], board: standardBoard,
      mode: 'STANDARD' as const, potAmount: 100, toCall: 40, effectiveStack: 1_000,
      simulationBudget: 0, difficulty: 3 as const, personality: 'BALANCED' as const,
      opponentCount: 1, legalActions: ['fold', 'call', 'raise-to'],
    };
    expect(decidePostflopV2({ ...base, riverAggressiveActionCount: 1 })).toBe('CALL');
    expect(decidePostflopV2({ ...base, riverAggressiveActionCount: 3 })).toBe('FOLD');
  });

  it('does not let a uniform random-opponent sample override the river bet-line response', () => {
    const base = {
      holeCards: [c(5, 'diamonds'), c(7, 'hearts')], board: standardBoard,
      mode: 'STANDARD' as const, potAmount: 100, toCall: 40, effectiveStack: 1_000,
      difficulty: 3 as const, personality: 'BALANCED' as const, opponentCount: 1,
      legalActions: ['fold', 'call', 'raise-to'],
    };
    expect(decidePostflopV2({ ...base, simulationBudget: 0 })).toBe('CALL');
    expect(decidePostflopV2({ ...base, simulationBudget: 48 })).toBe('CALL');
  });

  it('treats a short-stack all-in as a call but will not turn a river call intent into an all-in raise', () => {
    const base = {
      holeCards: [c(14, 'hearts'), c(13, 'hearts')], board: standardBoard,
      mode: 'STANDARD' as const, potAmount: 100, toCall: 100, effectiveStack: 500,
      simulationBudget: 0, difficulty: 3 as const, personality: 'BALANCED' as const,
    };
    expect(decidePostflopV2({ ...base, selfStack: 50, legalActions: ['fold', 'all-in'] })).toBe('ALL_IN');
    expect(decidePostflopV2({ ...base, selfStack: 150, legalActions: ['fold', 'all-in'] })).toBe('FOLD');
  });

  it('preserves a strong-value river jam when the effective stack is committed', () => {
    expect(decidePostflopV2({
      holeCards: [c(14, 'hearts'), c(13, 'hearts')], board: standardBoard,
      mode: 'STANDARD', potAmount: 100, toCall: 25, effectiveStack: 50,
      effectiveStackBehindAfterCall: 25, selfStack: 100, simulationBudget: 0, difficulty: 3,
      personality: 'BALANCED', legalActions: ['fold', 'call', 'all-in'],
    })).toBe('ALL_IN');
  });
});
