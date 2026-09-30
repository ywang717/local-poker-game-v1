import type { Card } from '../game/cards';
import { getRuleConfig, type GameMode } from '../game/rules';
import type { AIDifficulty } from './difficulty';

export type Position = 'HEADS_UP' | 'EARLY' | 'MIDDLE' | 'LATE' | 'BLINDS';

export type PreflopProfile = {
  mode: GameMode;
  tableSize: number;
  position: Position;
  openThreshold: number;
  threeBetThreshold: number;
  pairBonus: number;
  connectedBonus: number;
  suitedBonus: number;
  highCardBonus: number;
};

export type PreflopDecisionContext = {
  tableSize: number;
  position: Position;
  difficulty: AIDifficulty;
};

const positionAdjustment: Readonly<Record<Position, number>> = {
  HEADS_UP: -0.12,
  EARLY: 0.1,
  MIDDLE: 0.02,
  LATE: -0.06,
  BLINDS: 0.04,
};

export function getPreflopProfile(
  mode: GameMode,
  tableSize: number,
  position: Position,
  difficulty: AIDifficulty,
): PreflopProfile {
  const base = 0.56 - difficulty * 0.018;
  const shortDeck = mode === 'SHORT_DECK';
  return {
    mode,
    tableSize,
    position,
    openThreshold: Math.max(0.2, Math.min(0.9, base + positionAdjustment[position] - (tableSize <= 2 ? 0.02 : 0))),
    threeBetThreshold: Math.min(0.96, base + 0.2 + positionAdjustment[position] / 2),
    pairBonus: shortDeck ? 0.15 : 0.1,
    connectedBonus: shortDeck ? 0.1 : 0.06,
    suitedBonus: shortDeck ? 0.08 : 0.05,
    highCardBonus: shortDeck ? 0.08 : 0.05,
  };
}

export function preflopStrength(
  holeCards: readonly Card[],
  mode: GameMode,
  context: PreflopDecisionContext = { tableSize: 6, position: 'MIDDLE', difficulty: 3 },
): number {
  if (holeCards.length !== 2) throw new RangeError('Pre-flop strength requires two hole cards');
  const [high, low] = [...holeCards].sort((left, right) => right.rank - left.rank).map((card) => card.rank);
  const config = getPreflopProfile(mode, context.tableSize, context.position, context.difficulty);
  let strength = 0.22 + ((high - 6) / 8) * 0.27 + ((low - 6) / 8) * 0.12;
  if (high === low) strength = 0.53 + ((high - 6) / 8) * 0.32 + config.pairBonus;
  if (holeCards[0].suit === holeCards[1].suit) strength += config.suitedBonus;
  if (Math.abs(high - low) <= 2) strength += config.connectedBonus;
  if (high >= 12) strength += config.highCardBonus;
  if (high === 14 && low >= 10) strength += 0.09;
  strength += (0.62 - config.openThreshold) * 0.25;
  return Math.max(0, Math.min(1, strength));
}
