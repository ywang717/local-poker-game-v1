import { describe, expect, it } from 'vitest';
import { normalizeHandClass } from '../../src/ai/preflopStrategy';
import { c } from '../game/cards.test';

describe('V2.2 standard hand notation', () => {
  it('uses T for ten in range labels without changing card ranks', () => {
    expect(normalizeHandClass([c(10, 'spades'), c(10, 'hearts')]).notation).toBe('TT');
    expect(normalizeHandClass([c(14, 'spades'), c(10, 'spades')]).notation).toBe('ATs');
    expect(normalizeHandClass([c(10, 'spades'), c(9, 'spades')]).notation).toBe('T9s');
    expect(normalizeHandClass([c(11, 'spades'), c(10, 'hearts')]).notation).toBe('JTo');
  });
});
