import { describe, expect, it } from 'vitest';
import { createDeck, shuffleDeck } from '../../src/game/cards';
import type { Card } from '../../src/game/cards';

describe('deck and shuffle', () => {
  it('creates a unique 52-card standard deck', () => {
    const deck = createDeck('STANDARD');
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
  });

  it('creates a unique 36-card short deck without ranks 2 through 5', () => {
    const deck = createDeck('SHORT_DECK');
    expect(deck).toHaveLength(36);
    expect(new Set(deck.map((card) => card.id)).size).toBe(36);
    expect(deck.every((card) => card.rank >= 6)).toBe(true);
  });

  it('uses injected randomness for a deterministic Fisher-Yates permutation', () => {
    const deck = createDeck('STANDARD');
    const values = [0.11, 0.82, 0.37, 0.94, 0.23, 0.61, 0.48, 0.75];
    const next = () => values.shift() ?? 0.5;
    const first = shuffleDeck(deck, next);
    const second = shuffleDeck(deck, (() => {
      const copy = [0.11, 0.82, 0.37, 0.94, 0.23, 0.61, 0.48, 0.75];
      return () => copy.shift() ?? 0.5;
    })());
    expect(first.map((card) => card.id)).toEqual(second.map((card) => card.id));
    expect(first.map((card) => card.id).sort()).toEqual(deck.map((card) => card.id).sort());
    expect(first).not.toEqual(deck);
  });
});

export function c(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}
