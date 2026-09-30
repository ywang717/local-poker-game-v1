import { evaluateHand } from '../game/handEvaluator';
import { getRuleConfig, type GameMode } from '../game/rules';
import type { Card } from '../game/cards';

export type PostflopStrength = {
  strength: number;
  drawPotential: number;
  madeCategory: string | null;
};

function drawPotential(cards: readonly Card[], mode: GameMode): number {
  const rules = getRuleConfig(mode);
  const suits = new Map<string, number>();
  for (const card of cards) suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  const flushDraw = [...suits.values()].some((count) => count === 4) ? 0.2 : 0;
  const ranks = new Set(cards.map((card) => card.rank));
  const straightDraw = rules.straightWindows.some((window) => window.filter((rank) => ranks.has(rank)).length >= 4) ? 0.18 : 0;
  return Math.min(0.35, flushDraw + straightDraw);
}

export function postflopStrength(
  holeCards: readonly Card[],
  board: readonly Card[],
  mode: GameMode,
): PostflopStrength {
  if (board.length < 3) throw new RangeError('Post-flop strength requires at least a flop');
  const evaluation = evaluateHand(holeCards, board, mode);
  const rank = getRuleConfig(mode).categoryRank[evaluation.category];
  const strength = Math.min(1, 0.2 + (rank / 9) * 0.68 + (evaluation.rankVector[0] ?? 0) / 200);
  return { strength, drawPotential: drawPotential([...holeCards, ...board], mode), madeCategory: evaluation.category };
}
