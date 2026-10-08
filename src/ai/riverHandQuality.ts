import type { Card } from '../game/cards';
import { compareEvaluations, evaluateHand } from '../game/handEvaluator';
import type { GameMode } from '../game/rules';

export type RiverHandQuality =
  | 'AIR'
  | 'BOARD_ONLY_PAIR'
  | 'BOARD_ONLY_HAND'
  | 'WEAK_PAIR'
  | 'MIDDLE_PAIR'
  | 'TOP_PAIR_WEAK_KICKER'
  | 'TOP_PAIR_GOOD_KICKER'
  | 'OVERPAIR'
  | 'TWO_PAIR_PLUS';

/** Classify a completed five-card board using only the hero's cards and board. */
export function classifyRiverHand(
  holeCards: readonly Card[],
  board: readonly Card[],
  mode: GameMode,
): RiverHandQuality {
  if (board.length !== 5) throw new RangeError('River hand quality requires five community cards');
  const evaluation = evaluateHand(holeCards, board, mode);
  if (evaluation.category === 'HIGH_CARD') return 'AIR';
  const boardEvaluation = evaluateHand([], board, mode);
  if (compareEvaluations(evaluation, boardEvaluation, mode) === 0) {
    return evaluation.category === 'ONE_PAIR' ? 'BOARD_ONLY_PAIR' : 'BOARD_ONLY_HAND';
  }
  if (evaluation.category !== 'ONE_PAIR') return 'TWO_PAIR_PLUS';

  const pairRank = (evaluation.rankVector[0] ?? 0) as Card['rank'];
  const boardRanks = [...new Set(board.map((card) => card.rank))].sort((left, right) => right - left);
  const pairPosition = boardRanks.indexOf(pairRank);
  const privatePairCards = holeCards.filter((card) => card.rank === pairRank);
  if (privatePairCards.length === 2) {
    if (pairRank > boardRanks[0]) return 'OVERPAIR';
    return pairPosition === 1 ? 'MIDDLE_PAIR' : 'WEAK_PAIR';
  }
  if (privatePairCards.length === 0) return 'BOARD_ONLY_PAIR';
  if (pairPosition === 0) {
    const kicker = Math.max(...holeCards.filter((card) => card.rank !== pairRank).map((card) => card.rank));
    return kicker >= 12 ? 'TOP_PAIR_GOOD_KICKER' : 'TOP_PAIR_WEAK_KICKER';
  }
  return pairPosition === 1 ? 'MIDDLE_PAIR' : 'WEAK_PAIR';
}
