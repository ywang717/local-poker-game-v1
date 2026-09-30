import { describe, expect, it } from 'vitest';
import { postflopStrength } from '../../src/ai/postflop';
import { c } from '../game/cards.test';

describe('postflop training signals', () => {
  it('values two pair above one pair and does not treat a board pair as a strong made hand', () => {
    const board = [c(14, 'spades'), c(9, 'hearts'), c(4, 'clubs')];
    const twoPair = postflopStrength([c(14, 'hearts'), c(9, 'clubs')], board, 'STANDARD');
    const topPair = postflopStrength([c(14, 'hearts'), c(13, 'clubs')], board, 'STANDARD');
    const weakPair = postflopStrength([c(4, 'hearts'), c(7, 'clubs')], board, 'STANDARD');
    expect(twoPair.strength).toBeGreaterThan(0.7);
    expect(twoPair.strength).toBeGreaterThan(topPair.strength);
    expect(topPair.strength).toBeGreaterThan(weakPair.strength);
  });

  it('counts a personal flush draw on the flop but not a board-only draw or river draw', () => {
    const flop = [c(6, 'spades'), c(8, 'spades'), c(12, 'hearts')];
    const suited = postflopStrength([c(14, 'spades'), c(10, 'spades')], flop, 'STANDARD');
    const offSuit = postflopStrength([c(14, 'hearts'), c(10, 'clubs')], flop, 'STANDARD');
    expect(suited.drawPotential).toBeGreaterThan(offSuit.drawPotential);
    const river = postflopStrength([c(14, 'spades'), c(10, 'spades')], [...flop, c(4, 'clubs'), c(2, 'diamonds')], 'STANDARD');
    expect(river.drawPotential).toBe(0);
  });

  it('recognizes the short-deck low-ace straight draw', () => {
    const draw = postflopStrength([c(14, 'clubs'), c(6, 'diamonds')], [c(7, 'hearts'), c(8, 'spades'), c(13, 'clubs')], 'SHORT_DECK');
    expect(draw.drawPotential).toBeGreaterThan(0);
  });
});
