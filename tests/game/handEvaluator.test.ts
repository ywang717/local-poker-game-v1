import { describe, expect, it } from 'vitest';
import { evaluateHand, compareEvaluations } from '../../src/game/handEvaluator';
import { c } from './cards.test';

describe('standard hand evaluator', () => {
  const cases = [
    ['ROYAL_FLUSH', [c(14, 'spades'), c(13, 'spades')], [c(12, 'spades'), c(11, 'spades'), c(10, 'spades'), c(2, 'clubs'), c(3, 'diamonds')]],
    ['STRAIGHT_FLUSH', [c(9, 'spades'), c(8, 'spades')], [c(7, 'spades'), c(6, 'spades'), c(5, 'spades'), c(2, 'clubs'), c(3, 'diamonds')]],
    ['FOUR_OF_A_KIND', [c(14, 'hearts'), c(14, 'diamonds')], [c(14, 'clubs'), c(14, 'spades'), c(2, 'diamonds'), c(3, 'clubs'), c(4, 'hearts')]],
    ['FULL_HOUSE', [c(14, 'hearts'), c(14, 'diamonds')], [c(14, 'clubs'), c(13, 'spades'), c(13, 'diamonds'), c(2, 'clubs'), c(3, 'hearts')]],
    ['FLUSH', [c(14, 'hearts'), c(2, 'hearts')], [c(7, 'hearts'), c(9, 'hearts'), c(11, 'hearts'), c(3, 'clubs'), c(4, 'diamonds')]],
    ['STRAIGHT', [c(5, 'clubs'), c(4, 'diamonds')], [c(14, 'spades'), c(2, 'hearts'), c(3, 'clubs'), c(9, 'diamonds'), c(13, 'clubs')]],
    ['THREE_OF_A_KIND', [c(14, 'hearts'), c(14, 'diamonds')], [c(14, 'clubs'), c(7, 'spades'), c(9, 'diamonds'), c(11, 'clubs'), c(2, 'hearts')]],
    ['TWO_PAIR', [c(14, 'hearts'), c(14, 'diamonds')], [c(13, 'clubs'), c(13, 'diamonds'), c(7, 'spades'), c(3, 'clubs'), c(2, 'hearts')]],
    ['ONE_PAIR', [c(14, 'hearts'), c(14, 'diamonds')], [c(7, 'spades'), c(9, 'diamonds'), c(11, 'clubs'), c(2, 'hearts'), c(3, 'clubs')]],
    ['HIGH_CARD', [c(14, 'hearts'), c(13, 'diamonds')], [c(9, 'spades'), c(7, 'diamonds'), c(4, 'clubs'), c(2, 'hearts'), c(3, 'clubs')]],
  ] as const;

  it.each(cases)('recognizes %s', (category, holeCards, board) => {
    expect(evaluateHand(holeCards, board, 'STANDARD').category).toBe(category);
  });

  it('compares kickers after the shared pair', () => {
    const board = [c(9, 'clubs'), c(9, 'diamonds'), c(2, 'spades'), c(4, 'hearts'), c(7, 'clubs')];
    const aceKing = evaluateHand([c(14, 'spades'), c(13, 'diamonds')], board, 'STANDARD');
    const aceQueen = evaluateHand([c(14, 'hearts'), c(12, 'diamonds')], board, 'STANDARD');
    expect(compareEvaluations(aceKing, aceQueen)).toBeGreaterThan(0);
  });

  it('uses the board as the best five cards when it is stronger', () => {
    const board = [c(14, 'spades'), c(13, 'spades'), c(12, 'spades'), c(11, 'spades'), c(10, 'spades')];
    const result = evaluateHand([c(2, 'clubs'), c(3, 'diamonds')], board, 'STANDARD');
    expect(result.category).toBe('ROYAL_FLUSH');
    expect(result.bestFive).toEqual(board);
  });
});

describe('short-deck evaluator', () => {
  it('recognizes A6789 as a straight', () => {
    const result = evaluateHand(
      [c(14, 'spades'), c(6, 'diamonds')],
      [c(7, 'clubs'), c(8, 'hearts'), c(9, 'spades'), c(13, 'clubs'), c(12, 'diamonds')],
      'SHORT_DECK',
    );
    expect(result.category).toBe('STRAIGHT');
    expect(result.rankVector[0]).toBe(9);
  });

  it('ranks a flush above a full house', () => {
    const flush = evaluateHand(
      [c(14, 'hearts'), c(6, 'hearts')],
      [c(7, 'hearts'), c(9, 'hearts'), c(11, 'hearts'), c(12, 'clubs'), c(13, 'diamonds')],
      'SHORT_DECK',
    );
    const fullHouse = evaluateHand(
      [c(14, 'spades'), c(14, 'hearts')],
      [c(14, 'clubs'), c(13, 'spades'), c(13, 'clubs'), c(6, 'diamonds'), c(7, 'diamonds')],
      'SHORT_DECK',
    );
    expect(flush.category).toBe('FLUSH');
    expect(fullHouse.category).toBe('FULL_HOUSE');
    expect(compareEvaluations(flush, fullHouse, 'SHORT_DECK')).toBeGreaterThan(0);
  });

  it('keeps a full house above a flush in the standard game', () => {
    const flush = evaluateHand(
      [c(14, 'hearts'), c(2, 'hearts')],
      [c(7, 'hearts'), c(9, 'hearts'), c(11, 'hearts'), c(12, 'clubs'), c(13, 'diamonds')],
      'STANDARD',
    );
    const fullHouse = evaluateHand(
      [c(14, 'spades'), c(14, 'hearts')],
      [c(14, 'clubs'), c(13, 'spades'), c(13, 'clubs'), c(2, 'diamonds'), c(3, 'diamonds')],
      'STANDARD',
    );
    expect(compareEvaluations(fullHouse, flush, 'STANDARD')).toBeGreaterThan(0);
  });
});
