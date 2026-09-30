import type { GameMode } from '../game/rules';
import type { TableSize } from '../game/gameState';
import type { HandSummary } from './handHistory';
import { TABLE_LEVELS, type TableLevelId } from './tableLevels';

export type SegmentStats = {
  totalHands: number;
  wonHands: number;
  totalProfit: number;
  largestPot: number;
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
  byPlayerCount: Record<TableSize, SegmentStats>;
  byLevel: Record<TableLevelId, SegmentStats>;
};

function emptySegment(): SegmentStats {
  return { totalHands: 0, wonHands: 0, totalProfit: 0, largestPot: 0 };
}

function cloneSegment(segment: SegmentStats): SegmentStats {
  return { ...segment };
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
