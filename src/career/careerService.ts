import type { GameMode } from '../game/rules';
import type { TableSize } from '../game/gameState';
import { appendHandHistory, type HandSummary } from './handHistory';
import { createEmptyStatistics, recordStatistics } from './statistics';
import { getTableLevel, TABLE_LEVELS, type TableLevel, type TableLevelId } from './tableLevels';
import type { CareerState } from './careerState';
import { createEmptyTournamentStatistics } from './tournamentStatistics';
import { syncActiveTableStack as syncCashTableStack } from './cashBuyInService';
import { startTournament } from '../tournament/tournamentEngine';
import type { TournamentState } from '../tournament/types';
import type { FinancialTransaction } from './transactionTypes';

const MINIMUM_FUNDS = 5_000;

function makeCashSessionId(): string {
  return `cash-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function appendTransaction(career: CareerState, transaction: FinancialTransaction): void {
  career.financialTransactions ??= [];
  if (!career.financialTransactions.some((entry) => entry.transactionId === transaction.transactionId)) {
    career.financialTransactions.push(transaction);
  }
}

function cloneCareer(career: CareerState): CareerState {
  return {
    ...career,
    unlockedLevels: [...career.unlockedLevels],
    statistics: {
      overall: { ...career.statistics.overall },
      byMode: { STANDARD: { ...career.statistics.byMode.STANDARD }, SHORT_DECK: { ...career.statistics.byMode.SHORT_DECK } },
      byStartingHand: {
        STANDARD: Object.fromEntries(Object.entries(career.statistics.byStartingHand.STANDARD).map(([hand, stats]) => [hand, { ...stats }])),
        SHORT_DECK: Object.fromEntries(Object.entries(career.statistics.byStartingHand.SHORT_DECK).map(([hand, stats]) => [hand, { ...stats }])),
      },
      byPlayerCount: Object.fromEntries(Object.entries(career.statistics.byPlayerCount).map(([key, value]) => [key, { ...value }])) as CareerState['statistics']['byPlayerCount'],
      byLevel: Object.fromEntries(Object.entries(career.statistics.byLevel).map(([key, value]) => [key, { ...value }])) as CareerState['statistics']['byLevel'],
    },
    handHistory: career.handHistory.map((entry) => ({ ...entry, playerHoleCards: [...entry.playerHoleCards], communityCards: [...entry.communityCards], actionHistory: entry.actionHistory.map((record) => ({ ...record })), playerNames: entry.playerNames ? { ...entry.playerNames } : undefined, potResults: (entry.potResults ?? []).map((pot) => ({ ...pot, winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })) })),
    recordedHandIds: [...career.recordedHandIds],
    financialTransactions: (career.financialTransactions ?? []).map((entry) => ({ ...entry })),
    pendingCashBuyIns: (career.pendingCashBuyIns ?? []).map((entry) => ({ ...entry })),
    tournamentStatistics: { ...(career.tournamentStatistics ?? createEmptyTournamentStatistics()) },
    recordedTournamentIds: [...(career.recordedTournamentIds ?? [])],
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
    saveVersion: 2,
    nickname: normalized,
    createdAt,
    currentFunds: 10_000,
    peakFunds: 10_000,
    lowestFunds: 10_000,
    activeTableStack: null,
    activeTableSessionId: null,
    defaultMode: 'STANDARD',
    defaultTableSize: 6,
    unlockedLevels: [1],
    bankruptcyCount: 0,
    statistics: createEmptyStatistics(10_000),
    handHistory: [],
    recordedHandIds: [],
    financialTransactions: [],
    pendingCashBuyIns: [],
    tournamentStatistics: createEmptyTournamentStatistics(),
    recordedTournamentIds: [],
  };
}

export type TournamentEntryResult = { career: CareerState; tournament: TournamentState };

/** Public career-service entry point; the Zustand store exposes the shorter UI method. */
export function enterTournament(career: CareerState, mode: GameMode, levelId: TableLevelId, tournamentId?: string): TournamentEntryResult {
  return enterTournamentForCareer(career, mode, levelId, tournamentId);
}

/** Enter a six-player mini tournament and charge its entry exactly once. */
export function enterTournamentForCareer(career: CareerState, mode: GameMode, levelId: TableLevelId, tournamentId?: string): TournamentEntryResult {
  const level = getTableLevel(levelId);
  if (!career.unlockedLevels.includes(levelId)) throw new Error('Table level is locked');
  if (career.activeTableStack !== null) throw new Error('Career is already seated at a table');
  const tournament = startTournament({ tournamentId, mode, tableLevel: levelId, entryFee: level.buyIn, humanId: 'human', humanName: career.nickname });
  const transactionId = `${tournament.tournamentId}:entry`;
  const next = cloneCareer(career);
  next.financialTransactions = next.financialTransactions ?? [];
  next.recordedTournamentIds = next.recordedTournamentIds ?? [];
  const existing = next.financialTransactions.find((entry) => entry.transactionId === transactionId);
  if (existing) {
    throw new Error('Tournament ID has already been used');
  }
  if (career.currentFunds < level.buyIn) throw new Error('Insufficient career funds for tournament entry');
  if (!existing) next.currentFunds -= tournament.entryFee;
  if (!existing) {
    const transaction: FinancialTransaction = { transactionId, sessionId: tournament.tournamentId, kind: 'TOURNAMENT_ENTRY', amount: tournament.entryFee, status: 'APPLIED', createdAt: new Date().toISOString() };
    next.financialTransactions.push(transaction);
  }
  tournament.entryTransactionId = transactionId;
  refreshFinancialMarkers(next);
  return { career: next, tournament };
}

/** Record the final tournament rank and reward once, without touching cash statistics. */
export function recordTournamentFinish(career: CareerState, state: TournamentState): CareerState {
  const next = cloneCareer(career);
  next.financialTransactions = next.financialTransactions ?? [];
  next.recordedTournamentIds = next.recordedTournamentIds ?? [];
  next.tournamentStatistics = next.tournamentStatistics ?? createEmptyTournamentStatistics();
  if (next.recordedTournamentIds.includes(state.tournamentId)) return applyBankruptcyProtection(next);
  const humanId = state.players.find((player) => player.isHuman)?.id
    ?? state.eliminations.find((entry) => !entry.playerId.startsWith('ai-'))?.playerId
    ?? state.rankings.find((entry) => !entry.playerId.startsWith('ai-'))?.playerId
    ?? 'human';
  const humanRank = state.rankings.find((ranking) => ranking.playerId === humanId)?.rank ?? (state.championId === humanId ? 1 : state.players.length + state.eliminations.length);
  const entryTransactionId = state.entryTransactionId ?? `${state.tournamentId}:entry`;
  if (!next.financialTransactions.some((entry) => entry.transactionId === entryTransactionId)) {
    next.currentFunds -= state.entryFee;
    next.financialTransactions.push({ transactionId: entryTransactionId, sessionId: state.tournamentId, kind: 'TOURNAMENT_ENTRY', amount: state.entryFee, status: 'APPLIED', createdAt: new Date().toISOString() });
  }
  const isChampion = state.championId === humanId;
  const reward = isChampion ? state.entryFee * 10 : 0;
  if (reward > 0 && !next.financialTransactions.some((entry) => entry.transactionId === `${state.tournamentId}:champion-reward`)) {
    next.currentFunds += reward;
    next.financialTransactions.push({ transactionId: `${state.tournamentId}:champion-reward`, sessionId: state.tournamentId, kind: 'TOURNAMENT_CHAMPION_REWARD', amount: reward, status: 'APPLIED', createdAt: new Date().toISOString() });
  }
  const stats = next.tournamentStatistics;
  stats.tournamentsPlayed += 1;
  stats.tournamentsWon += isChampion ? 1 : 0;
  stats.totalEntryFees += state.entryFee;
  stats.totalRewards += reward;
  stats.totalNet += reward - state.entryFee;
  stats.bestFinish = stats.bestFinish === null ? humanRank : Math.min(stats.bestFinish, humanRank);
  next.recordedTournamentIds.push(state.tournamentId);
  // Tournament entry fees are paid before the match starts.  If the player
  // loses with no cash left, use the same minimum-funds protection as a cash
  // table exit so the career can continue instead of becoming unusable.
  return applyBankruptcyProtection(refreshFinancialMarkers(next));
}

export type BuyInResult = {
  career: CareerState;
  tableStack: number;
  level: TableLevel;
  sessionId: string;
};

export function buyIn(career: CareerState, levelId: TableLevelId, requestedSessionId?: string): BuyInResult {
  const level = getTableLevel(levelId);
  if (!career.unlockedLevels.includes(level.id)) throw new Error('Table level is locked');
  if (career.activeTableStack !== null) throw new Error('Career is already seated at a table');
  if (career.currentFunds < level.buyIn) throw new Error('Insufficient career funds for buy-in');
  const sessionId = requestedSessionId ?? makeCashSessionId();
  if (!sessionId) throw new Error('Cash session ID is required');
  const initialTransactionId = `${sessionId}:initial-buy-in`;
  if (career.financialTransactions?.some((entry) => entry.transactionId === initialTransactionId)) throw new Error('Duplicate transaction ID');
  const next = cloneCareer(career);
  next.currentFunds -= level.buyIn;
  next.activeTableStack = level.buyIn;
  next.activeTableSessionId = sessionId;
  appendTransaction(next, {
    transactionId: initialTransactionId,
    sessionId,
    kind: 'INITIAL_BUY_IN',
    amount: level.buyIn,
    status: 'APPLIED',
    createdAt: new Date().toISOString(),
  });
  refreshFinancialMarkers(next);
  return { career: next, tableStack: level.buyIn, level, sessionId };
}

export function leaveTable(career: CareerState, tableStack: number, requestedSessionId?: string): CareerState {
  if (!Number.isSafeInteger(tableStack) || tableStack < 0) throw new Error('Table stack must be a non-negative integer');
  if (career.activeTableStack === null) {
    if (tableStack !== 0) throw new Error('Career is not seated at a table');
    return refreshFinancialMarkers(cloneCareer(career));
  }
  const next = cloneCareer(career);
  const sessionId = requestedSessionId
    ?? career.activeTableSessionId
    ?? career.financialTransactions?.find((entry) => entry.kind === 'INITIAL_BUY_IN' && entry.status === 'APPLIED')?.sessionId
    ?? `legacy-cash-${career.createdAt}`;
  const cashOutTransactionId = `${sessionId}:table-cash-out`;
  if (career.financialTransactions?.some((entry) => entry.transactionId === cashOutTransactionId)) {
    next.activeTableStack = null;
    next.activeTableSessionId = null;
    return refreshFinancialMarkers(next);
  }
  appendTransaction(next, {
    transactionId: cashOutTransactionId,
    sessionId,
    kind: 'TABLE_CASH_OUT',
    amount: tableStack,
    status: 'APPLIED',
    createdAt: new Date().toISOString(),
  });
  next.currentFunds += tableStack;
  next.activeTableStack = null;
  next.activeTableSessionId = null;
  return refreshFinancialMarkers(next);
}

export function recordHand(career: CareerState, summary: HandSummary): CareerState {
  if (!summary.handId) throw new Error('Hand id is required');
  if (career.recordedHandIds.includes(summary.handId)) return cloneCareer(career);
  const next = cloneCareer(career);
  if (summary.matchType !== 'MINI_TOURNAMENT') next.statistics = recordStatistics(next.statistics, summary);
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

/** Records the settled table stack without transferring it to career funds. */
export function syncActiveTableStack(career: CareerState, stack: number): CareerState {
  return syncCashTableStack(career, stack);
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
