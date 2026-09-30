import type { GameMode } from '../game/rules';
import type { TableSize } from '../game/gameState';
import { appendHandHistory, type HandSummary } from './handHistory';
import { createEmptyStatistics, recordStatistics } from './statistics';
import { getTableLevel, TABLE_LEVELS, type TableLevel, type TableLevelId } from './tableLevels';
import type { CareerState } from './careerState';

const MINIMUM_FUNDS = 5_000;

function cloneCareer(career: CareerState): CareerState {
  return {
    ...career,
    unlockedLevels: [...career.unlockedLevels],
    statistics: {
      overall: { ...career.statistics.overall },
      byMode: { STANDARD: { ...career.statistics.byMode.STANDARD }, SHORT_DECK: { ...career.statistics.byMode.SHORT_DECK } },
      byPlayerCount: Object.fromEntries(Object.entries(career.statistics.byPlayerCount).map(([key, value]) => [key, { ...value }])) as CareerState['statistics']['byPlayerCount'],
      byLevel: Object.fromEntries(Object.entries(career.statistics.byLevel).map(([key, value]) => [key, { ...value }])) as CareerState['statistics']['byLevel'],
    },
    handHistory: career.handHistory.map((entry) => ({ ...entry, playerHoleCards: [...entry.playerHoleCards], communityCards: [...entry.communityCards], actionHistory: entry.actionHistory.map((record) => ({ ...record })), playerNames: entry.playerNames ? { ...entry.playerNames } : undefined, potResults: (entry.potResults ?? []).map((pot) => ({ ...pot, winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })) })),
    recordedHandIds: [...career.recordedHandIds],
  };
}

function refreshFinancialMarkers(career: CareerState): CareerState {
  const next = career;
  next.peakFunds = Math.max(next.peakFunds, next.currentFunds);
  next.lowestFunds = Math.min(next.lowestFunds, next.currentFunds);
  const unlocked = new Set(next.unlockedLevels);
  for (const level of TABLE_LEVELS) if (next.peakFunds >= level.unlockAt) unlocked.add(level.id);
  next.unlockedLevels = TABLE_LEVELS.filter((level) => unlocked.has(level.id)).map((level) => level.id);
  next.statistics.overall.peakFunds = Math.max(next.statistics.overall.peakFunds, next.peakFunds);
  next.statistics.overall.lowestFunds = Math.min(next.statistics.overall.lowestFunds, next.lowestFunds);
  return next;
}

export function createCareer(nickname: string): CareerState {
  const normalized = nickname.trim();
  if (!normalized) throw new Error('Nickname is required');
  const createdAt = new Date().toISOString();
  return {
    saveVersion: 1,
    nickname: normalized,
    createdAt,
    currentFunds: 10_000,
    peakFunds: 10_000,
    lowestFunds: 10_000,
    activeTableStack: null,
    defaultMode: 'STANDARD',
    defaultTableSize: 6,
    unlockedLevels: [1],
    bankruptcyCount: 0,
    statistics: createEmptyStatistics(10_000),
    handHistory: [],
    recordedHandIds: [],
  };
}

export type BuyInResult = {
  career: CareerState;
  tableStack: number;
  level: TableLevel;
};

export function buyIn(career: CareerState, levelId: TableLevelId): BuyInResult {
  const level = getTableLevel(levelId);
  if (!career.unlockedLevels.includes(level.id)) throw new Error('Table level is locked');
  if (career.activeTableStack !== null) throw new Error('Career is already seated at a table');
  if (career.currentFunds < level.buyIn) throw new Error('Insufficient career funds for buy-in');
  const next = cloneCareer(career);
  next.currentFunds -= level.buyIn;
  next.activeTableStack = level.buyIn;
  refreshFinancialMarkers(next);
  return { career: next, tableStack: level.buyIn, level };
}

export function leaveTable(career: CareerState, tableStack: number): CareerState {
  if (!Number.isSafeInteger(tableStack) || tableStack < 0) throw new Error('Table stack must be a non-negative integer');
  if (career.activeTableStack === null) {
    if (tableStack !== 0) throw new Error('Career is not seated at a table');
    return refreshFinancialMarkers(cloneCareer(career));
  }
  const next = cloneCareer(career);
  next.currentFunds += tableStack;
  next.activeTableStack = null;
  return refreshFinancialMarkers(next);
}

export function recordHand(career: CareerState, summary: HandSummary): CareerState {
  if (!summary.handId) throw new Error('Hand id is required');
  if (career.recordedHandIds.includes(summary.handId)) return cloneCareer(career);
  const next = cloneCareer(career);
  next.statistics = recordStatistics(next.statistics, summary);
  next.handHistory = appendHandHistory(next.handHistory, summary);
  next.recordedHandIds.push(summary.handId);
  return next;
}

export function applyBankruptcyProtection(career: CareerState): CareerState {
  const totalFunds = career.currentFunds + (career.activeTableStack ?? 0);
  if (totalFunds >= MINIMUM_FUNDS) return cloneCareer(career);
  const next = cloneCareer(career);
  next.currentFunds += MINIMUM_FUNDS - totalFunds;
  next.bankruptcyCount += 1;
  return refreshFinancialMarkers(next);
}

export type TableAvailability = {
  level: TableLevel;
  unlocked: boolean;
  affordable: boolean;
  canEnter: boolean;
};

export function getTableAvailability(career: CareerState): TableAvailability[] {
  return TABLE_LEVELS.map((level) => {
    const unlocked = career.unlockedLevels.includes(level.id);
    const affordable = career.currentFunds >= level.buyIn;
    return { level, unlocked, affordable, canEnter: unlocked && affordable && career.activeTableStack === null };
  });
}

export type { CareerState } from './careerState';
