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
  it('recognizes A6789 when the Ace is on the board', () => {
    const result = evaluateHand(
      [c(6, 'diamonds'), c(13, 'clubs')],
      [c(14, 'spades'), c(7, 'clubs'), c(8, 'hearts'), c(9, 'spades'), c(12, 'diamonds')],
      'SHORT_DECK',
    );
    expect(result.category).toBe('STRAIGHT');
    expect(result.rankVector[0]).toBe(9);
  });

  it('does not use a hole-card Ace as the low Ace for A6789', () => {
    const result = evaluateHand(
      [c(14, 'spades'), c(6, 'diamonds')],
      [c(7, 'clubs'), c(8, 'hearts'), c(9, 'spades'), c(13, 'clubs'), c(12, 'diamonds')],
      'SHORT_DECK',
    );

    expect(result.category).toBe('HIGH_CARD');
    expect(result.rankVector[0]).toBe(14);
  });

  it('keeps Ace high outside the A6789 low-Ace straight', () => {
    const board = [c(6, 'clubs'), c(8, 'diamonds'), c(10, 'hearts'), c(12, 'clubs'), c(7, 'spades')];
    const aceHigh = evaluateHand([c(14, 'spades'), c(11, 'hearts')], board, 'SHORT_DECK');
    const kingHigh = evaluateHand([c(13, 'diamonds'), c(11, 'clubs')], board, 'SHORT_DECK');

    expect(aceHigh.category).toBe('HIGH_CARD');
    expect(aceHigh.rankVector[0]).toBe(14);
    expect(compareEvaluations(aceHigh, kingHigh, 'SHORT_DECK')).toBeGreaterThan(0);
  });

  it('ranks a pair of Aces above a pair of Kings in short deck', () => {
    const board = [c(6, 'clubs'), c(7, 'hearts'), c(8, 'spades'), c(10, 'diamonds'), c(11, 'clubs')];
    const aces = evaluateHand([c(14, 'spades'), c(14, 'hearts')], board, 'SHORT_DECK');
    const kings = evaluateHand([c(13, 'spades'), c(13, 'hearts')], board, 'SHORT_DECK');

    expect(aces.category).toBe('ONE_PAIR');
    expect(aces.rankVector[0]).toBe(14);
    expect(compareEvaluations(aces, kings, 'SHORT_DECK')).toBeGreaterThan(0);
  });

  it('ranks A6789 below a 6789T straight in short deck', () => {
    const board = [c(14, 'clubs'), c(7, 'hearts'), c(8, 'spades'), c(9, 'diamonds'), c(12, 'clubs')];
    const aceLow = evaluateHand([c(6, 'spades'), c(13, 'diamonds')], board, 'SHORT_DECK');
    const tenBoard = [c(6, 'clubs'), c(7, 'hearts'), c(8, 'spades'), c(9, 'diamonds'), c(12, 'clubs')];
    const tenHigh = evaluateHand([c(10, 'spades'), c(13, 'hearts')], tenBoard, 'SHORT_DECK');

    expect(aceLow.rankVector[0]).toBe(9);
    expect(tenHigh.rankVector[0]).toBe(10);
    expect(compareEvaluations(tenHigh, aceLow, 'SHORT_DECK')).toBeGreaterThan(0);
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
