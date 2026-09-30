import { getRuleConfig, type GameMode } from './rules';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Card = { rank: Rank; suit: Suit; id: string };
export type RandomSource = () => number;

const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export function createCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: `${rank}-${suit}` };
}

export function createDeck(mode: GameMode): Card[] {
  const ranks = getRuleConfig(mode).ranks;
  return ranks.flatMap((rank) => SUITS.map((suit) => createCard(rank, suit)));
}

export function shuffleDeck(deck: readonly Card[], rng: RandomSource = Math.random): Card[] {
  const result = [...deck];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = rng();
    const slot = Math.floor(Math.max(0, Math.min(0.999999999999, random)) * (index + 1));
    [result[index], result[slot]] = [result[slot], result[index]];
  }
  return result;
}
