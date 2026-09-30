import { compareEvaluations, evaluateHand } from '../game/handEvaluator';
import { getRuleConfig, type GameMode } from '../game/rules';
import type { Card } from '../game/cards';

export type PostflopStrength = {
  strength: number;
  drawPotential: number;
  madeCategory: string | null;
};

function drawPotential(holeCards: readonly Card[], board: readonly Card[], mode: GameMode): number {
  if (board.length >= 5) return 0;
  const cards = [...holeCards, ...board];
  const rules = getRuleConfig(mode);
  const suits = new Map<string, number>();
  for (const card of cards) suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  const flushDraw = [...suits.entries()].some(([suit, count]) => count === 4 && holeCards.some((card) => card.suit === suit)) ? 0.28 : 0;
  const ranks = new Set(cards.map((card) => card.rank));
  const straightDraw = rules.straightWindows.some((window) => window.filter((rank) => ranks.has(rank)).length === 4
    && holeCards.some((card) => window.includes(card.rank))) ? 0.2 : 0;
  return Math.min(0.42, flushDraw + straightDraw);
}

function madeStrength(holeCards: readonly Card[], board: readonly Card[], mode: GameMode): number {
  const evaluation = evaluateHand(holeCards, board, mode);
  const category = evaluation.category;
  const strongestBoardRank = Math.max(...board.map((card) => card.rank));
  const pairRank = evaluation.rankVector[0] ?? 0;
  let strength: number;
  if (category === 'HIGH_CARD') strength = 0.18 + (Math.max(...holeCards.map((card) => card.rank)) / 14) * 0.1;
  else if (category === 'ONE_PAIR') {
    const personalPair = holeCards.some((card) => card.rank === pairRank) || holeCards.every((card) => card.rank === pairRank);
    strength = personalPair ? 0.47 + (pairRank / 14) * 0.14 + (pairRank >= strongestBoardRank ? 0.07 : 0) : 0.38;
  } else if (category === 'TWO_PAIR') strength = 0.73;
  else if (category === 'THREE_OF_A_KIND') strength = 0.82;
  else if (category === 'STRAIGHT') strength = 0.88;
  else if (category === 'FLUSH') strength = mode === 'SHORT_DECK' ? 0.95 : 0.92;
  else if (category === 'FULL_HOUSE') strength = mode === 'SHORT_DECK' ? 0.92 : 0.96;
  else if (category === 'FOUR_OF_A_KIND') strength = 0.985;
  else strength = 0.995;
  if (board.length === 5 && compareEvaluations(evaluation, evaluateHand([], board, mode), mode) === 0) {
    return Math.min(strength, 0.42);
  }
  return strength;
}

export function postflopStrength(
  holeCards: readonly Card[],
  board: readonly Card[],
  mode: GameMode,
): PostflopStrength {
  if (board.length < 3) throw new RangeError('Post-flop strength requires at least a flop');
  const evaluation = evaluateHand(holeCards, board, mode);
  return { strength: madeStrength(holeCards, board, mode), drawPotential: drawPotential(holeCards, board, mode), madeCategory: evaluation.category };
}
