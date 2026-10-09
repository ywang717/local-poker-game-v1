import type { GameMode } from '../game/rules';
import type { Card } from '../game/cards';
import type { TableSize } from '../game/gameState';
import type { HandSummary } from './handHistory';
import { TABLE_LEVELS, type TableLevelId } from './tableLevels';

export type SegmentStats = {
  totalHands: number;
  wonHands: number;
  totalProfit: number;
  largestPot: number;
};

export type StartingHandStats = {
  hands: number;
  wins: number;
  splits: number;
  losses: number;
};

export type OverallStats = SegmentStats & {
  peakFunds: number;
  lowestFunds: number;
  maxSingleHandProfit: number;
  maxSingleHandLoss: number;
  allInCount: number;
  allInWins: number;
  vpipHands: number;
  pfrHands: number;
  threeBetHands: number;
};

export type CareerStatistics = {
  overall: OverallStats;
  byMode: Record<GameMode, SegmentStats>;
  byStartingHand: Record<GameMode, Record<string, StartingHandStats>>;
  byPlayerCount: Record<TableSize, SegmentStats>;
  byLevel: Record<TableLevelId, SegmentStats>;
};

function emptySegment(): SegmentStats {
  return { totalHands: 0, wonHands: 0, totalProfit: 0, largestPot: 0 };
}

function cloneSegment(segment: SegmentStats): SegmentStats {
  return { ...segment };
}

function startingHandNotation(cards: readonly Card[], mode: GameMode): string | null {
  if (cards.length !== 2) return null;
  const rankSet = new Set(mode === 'SHORT_DECK'
    ? [6, 7, 8, 9, 10, 11, 12, 13, 14]
    : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  if (cards.some((card) => !rankSet.has(card.rank))) return null;
  const rankLabel = (rank: number): string => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' }[rank] ?? String(rank));
  const high = Math.max(cards[0].rank, cards[1].rank);
  const low = Math.min(cards[0].rank, cards[1].rank);
  if (high === low) return `${rankLabel(high)}${rankLabel(low)}`;
  return `${rankLabel(high)}${rankLabel(low)}${cards[0].suit === cards[1].suit ? 's' : 'o'}`;
}

export function applyStartingHand(stats: Record<string, StartingHandStats>, summary: HandSummary): Record<string, StartingHandStats> {
  const notation = startingHandNotation(summary.playerHoleCards, summary.mode);
  if (!notation) return { ...stats };
  const previous = stats[notation] ?? { hands: 0, wins: 0, splits: 0, losses: 0 };
  return {
    ...stats,
    [notation]: {
      hands: previous.hands + 1,
      wins: previous.wins + (summary.result === 'WIN' ? 1 : 0),
      splits: previous.splits + (summary.result === 'SPLIT' ? 1 : 0),
      losses: previous.losses + (summary.result === 'WIN' || summary.result === 'SPLIT' ? 0 : 1),
    },
  };
}

export function createEmptyStatistics(initialFunds = 10_000): CareerStatistics {
  return {
    overall: {
      ...emptySegment(),
      peakFunds: initialFunds,
      lowestFunds: initialFunds,
      maxSingleHandProfit: 0,
      maxSingleHandLoss: 0,
      allInCount: 0,
      allInWins: 0,
      vpipHands: 0,
      pfrHands: 0,
      threeBetHands: 0,
    },
    byMode: { STANDARD: emptySegment(), SHORT_DECK: emptySegment() },
    byStartingHand: { STANDARD: {}, SHORT_DECK: {} },
    byPlayerCount: { 2: emptySegment(), 3: emptySegment(), 4: emptySegment(), 5: emptySegment(), 6: emptySegment(), 8: emptySegment(), 9: emptySegment() },
    byLevel: Object.fromEntries(TABLE_LEVELS.map((level) => [level.id, emptySegment()])) as Record<TableLevelId, SegmentStats>,
  };
}

function applySegment(segment: SegmentStats, summary: HandSummary): SegmentStats {
  return {
    totalHands: segment.totalHands + 1,
    wonHands: segment.wonHands + (summary.result === 'WIN' ? 1 : 0),
    totalProfit: segment.totalProfit + summary.playerNet,
    largestPot: Math.max(segment.largestPot, summary.finalPot),
  };
}

export function recordStatistics(statistics: CareerStatistics, summary: HandSummary): CareerStatistics {
  const overallSegment = applySegment(statistics.overall, summary);
  const overall: OverallStats = {
    ...statistics.overall,
    ...overallSegment,
    peakFunds: statistics.overall.peakFunds,
    lowestFunds: statistics.overall.lowestFunds,
    maxSingleHandProfit: Math.max(statistics.overall.maxSingleHandProfit, summary.playerNet),
    maxSingleHandLoss: Math.min(statistics.overall.maxSingleHandLoss, summary.playerNet),
    allInCount: statistics.overall.allInCount + (summary.allIn ? 1 : 0),
    allInWins: statistics.overall.allInWins + (summary.allIn && summary.allInWon ? 1 : 0),
    vpipHands: statistics.overall.vpipHands + (summary.vpip ? 1 : 0),
    pfrHands: statistics.overall.pfrHands + (summary.pfr ? 1 : 0),
    threeBetHands: statistics.overall.threeBetHands + (summary.threeBet ? 1 : 0),
  };
  return {
    overall,
    byMode: {
      STANDARD: summary.mode === 'STANDARD' ? applySegment(statistics.byMode.STANDARD, summary) : cloneSegment(statistics.byMode.STANDARD),
      SHORT_DECK: summary.mode === 'SHORT_DECK' ? applySegment(statistics.byMode.SHORT_DECK, summary) : cloneSegment(statistics.byMode.SHORT_DECK),
    },
    byStartingHand: {
      STANDARD: summary.mode === 'STANDARD' ? applyStartingHand(statistics.byStartingHand.STANDARD, summary) : { ...statistics.byStartingHand.STANDARD },
      SHORT_DECK: summary.mode === 'SHORT_DECK' ? applyStartingHand(statistics.byStartingHand.SHORT_DECK, summary) : { ...statistics.byStartingHand.SHORT_DECK },
    },
    byPlayerCount: Object.fromEntries(Object.entries(statistics.byPlayerCount).map(([key, segment]) => [
      key,
      Number(key) === summary.tableSize ? applySegment(segment, summary) : cloneSegment(segment),
    ])) as Record<TableSize, SegmentStats>,
    byLevel: Object.fromEntries(Object.entries(statistics.byLevel).map(([key, segment]) => [
      key,
      Number(key) === summary.tableLevel ? applySegment(segment, summary) : cloneSegment(segment),
    ])) as Record<TableLevelId, SegmentStats>,
  };
}
