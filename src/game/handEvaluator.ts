import { type Card } from './cards';
import { getRuleConfig, type GameMode, type HandCategory, type RuleConfig } from './rules';

export type HandEvaluation = {
  category: HandCategory;
  labelZh: string;
  labelEn: string;
  bestFive: Card[];
  rankVector: number[];
};

type RankedFive = Omit<HandEvaluation, 'bestFive' | 'labelZh' | 'labelEn'>;

function combinations<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];
  function visit(start: number): void {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index <= items.length - (size - current.length); index += 1) {
      current.push(items[index]);
      visit(index + 1);
      current.pop();
    }
  }
  visit(0);
  return result;
}

function compareRanked(left: RankedFive, right: RankedFive, rules: RuleConfig): number {
  const categoryDifference = rules.categoryRank[left.category] - rules.categoryRank[right.category];
  if (categoryDifference !== 0) return categoryDifference;
  const length = Math.max(left.rankVector.length, right.rankVector.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left.rankVector[index] ?? 0) - (right.rankVector[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function findStraightHigh(cards: readonly Card[], rules: RuleConfig, communityAceIds: ReadonlySet<string>): number | null {
  const unique = new Set(cards.map((card) => card.rank));
  for (const window of rules.straightWindows) {
    const isLowAceWindow = window[0] === 14;
    const hasCommunityAce = cards.some((card) => communityAceIds.has(card.id));
    if (isLowAceWindow && rules.lowAceRequiresCommunityAce && !hasCommunityAce) continue;
    if (window.every((rank) => unique.has(rank))) {
      // The low-Ace window starts with Ace, but Ace itself is not demoted to
      // another card rank. Only the straight's comparison high card changes:
      // 5 for A2345, or 9 for A6789 in short deck.
      return isLowAceWindow ? rules.lowAceStraightHighCard : window[window.length - 1];
    }
  }
  return null;
}

function evaluateFive(cards: readonly Card[], rules: RuleConfig, communityAceIds: ReadonlySet<string>): RankedFive {
  const ranks = cards.map((card) => card.rank).sort((left, right) => right - left);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = findStraightHigh(cards, rules, communityAceIds);

  if (flush && straightHigh !== null) {
    return {
      category: straightHigh === 14 && ranks.includes(10) ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH',
      rankVector: [straightHigh],
    };
  }
  if (groups[0][1] === 4) {
    return { category: 'FOUR_OF_A_KIND', rankVector: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1][1] >= 2) {
    return { category: 'FULL_HOUSE', rankVector: [groups[0][0], groups[1][0]] };
  }
  if (flush) return { category: 'FLUSH', rankVector: ranks };
  if (straightHigh !== null) return { category: 'STRAIGHT', rankVector: [straightHigh] };
  if (groups[0][1] === 3) {
    return { category: 'THREE_OF_A_KIND', rankVector: [groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return { category: 'TWO_PAIR', rankVector: [pairs[0], pairs[1], groups[2][0]] };
  }
  if (groups[0][1] === 2) {
    return { category: 'ONE_PAIR', rankVector: [groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)] };
  }
  return { category: 'HIGH_CARD', rankVector: ranks };
}

export function evaluateHand(
  holeCards: readonly Card[],
  board: readonly Card[],
  mode: GameMode,
): HandEvaluation {
  const cards = [...holeCards, ...board];
  if (cards.length < 5 || cards.length > 7) {
    throw new RangeError(`Texas Hold'em evaluation requires 5-7 cards, received ${cards.length}`);
  }
  const ids = new Set(cards.map((card) => card.id));
  if (ids.size !== cards.length) throw new Error('Duplicate cards cannot be evaluated');
  const rules = getRuleConfig(mode);
  if (cards.some((card) => !rules.ranks.includes(card.rank))) {
    throw new Error(`Card rank is not valid for ${mode}`);
  }
  const communityAceIds = new Set(board.filter((card) => card.rank === 14).map((card) => card.id));
  const candidates = combinations(cards, 5);
  let best: { cards: Card[]; ranked: RankedFive } | null = null;
  for (const candidate of candidates) {
    const ranked = evaluateFive(candidate, rules, communityAceIds);
    if (!best || compareRanked(ranked, best.ranked, rules) > 0) best = { cards: candidate, ranked };
  }
  if (!best) throw new Error('No five-card combination available');
  const labels = rules.labels[best.ranked.category];
  return {
    category: best.ranked.category,
    labelZh: labels.zh,
    labelEn: labels.en,
    bestFive: best.cards,
    rankVector: best.ranked.rankVector,
  };
}

export function compareEvaluations(left: HandEvaluation, right: HandEvaluation, mode: GameMode = 'STANDARD'): number {
  return compareRanked(left, right, getRuleConfig(mode));
}
