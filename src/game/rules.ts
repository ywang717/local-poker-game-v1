import type { Rank } from './cards';

export type GameMode = 'STANDARD' | 'SHORT_DECK';
export type HandCategory =
  | 'HIGH_CARD'
  | 'ONE_PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

export type RuleConfig = {
  mode: GameMode;
  ranks: readonly Rank[];
  straightWindows: readonly (readonly Rank[])[];
  categoryRank: Readonly<Record<HandCategory, number>>;
  labels: Readonly<Record<HandCategory, { zh: string; en: string }>>;
};

const STANDARD_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SHORT_DECK_RANKS: readonly Rank[] = [6, 7, 8, 9, 10, 11, 12, 13, 14];

const labels: Readonly<Record<HandCategory, { zh: string; en: string }>> = {
  HIGH_CARD: { zh: '高牌', en: 'High Card' },
  ONE_PAIR: { zh: '一对', en: 'One Pair' },
  TWO_PAIR: { zh: '两对', en: 'Two Pair' },
  THREE_OF_A_KIND: { zh: '三条', en: 'Three of a Kind' },
  STRAIGHT: { zh: '顺子', en: 'Straight' },
  FLUSH: { zh: '同花', en: 'Flush' },
  FULL_HOUSE: { zh: '葫芦', en: 'Full House' },
  FOUR_OF_A_KIND: { zh: '四条', en: 'Four of a Kind' },
  STRAIGHT_FLUSH: { zh: '同花顺', en: 'Straight Flush' },
  ROYAL_FLUSH: { zh: '皇家同花顺', en: 'Royal Flush' },
};

function straightWindows(ranks: readonly Rank[]): readonly (readonly Rank[])[] {
  const windows: Rank[][] = [];
  for (let high = 14; high >= 6; high -= 1) {
    windows.push([high - 4, high - 3, high - 2, high - 1, high] as Rank[]);
  }
  const lowAceWindow = ranks.length === 9 ? [[14, 6, 7, 8, 9] as Rank[]] : [[14, 2, 3, 4, 5] as Rank[]];
  return [
    ...lowAceWindow,
    ...windows.filter((window) => window.every((rank) => ranks.includes(rank as Rank))),
  ];
}

const categoryRank: Readonly<Record<HandCategory, number>> = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
};

export function getRuleConfig(mode: GameMode): RuleConfig {
  const ranks = mode === 'SHORT_DECK' ? SHORT_DECK_RANKS : STANDARD_RANKS;
  const orderedCategoryRank = mode === 'SHORT_DECK'
    ? { ...categoryRank, FLUSH: 6, FULL_HOUSE: 5 }
    : categoryRank;
  return {
    mode,
    ranks,
    straightWindows: straightWindows(ranks),
    categoryRank: orderedCategoryRank,
    labels,
  };
}
