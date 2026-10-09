import type { CareerState } from './careerState';
import type { GameMode } from '../game/rules';
import type { TableLevelId } from './tableLevels';
import { applyStartingHand, type StartingHandStats } from './statistics';

export const TOURNAMENT_HISTORY_LIMIT = 500;
export type TournamentRecord = {
  tournamentId: string;
  mode: GameMode;
  tableLevel: TableLevelId;
  startedAt: string;
  finishedAt: string;
  humanRank: number;
  entryFee: number;
  reward: number;
  net: number;
  status: 'COMPLETED' | 'EXITED';
  championName?: string;
};

export type TournamentStatistics = {
  tournamentsPlayed: number;
  tournamentsWon: number;
  topThreeFinishes: number;
  totalEntryFees: number;
  totalRewards: number;
  totalNet: number;
  bestFinish: number | null;
  byStartingHand: Record<GameMode, Record<string, StartingHandStats>>;
  /** Top-three finishes and individual match records start at feature adoption. */
  trackingStartedAt: string;
  /** Additive migration; does not change the poker snapshot format. */
  startingHandMigrationVersion: number;
};
export function createEmptyTournamentStatistics(trackingStartedAt = new Date().toISOString()): TournamentStatistics {
  return {
    tournamentsPlayed: 0, tournamentsWon: 0, topThreeFinishes: 0,
    totalEntryFees: 0, totalRewards: 0, totalNet: 0, bestFinish: null,
    byStartingHand: { STANDARD: {}, SHORT_DECK: {} },
    trackingStartedAt, startingHandMigrationVersion: 1,
  };
}

/** Backfill only after the authoritative local history has been loaded. */
export function initializeTournamentCareer(career: CareerState): CareerState {
  if (career.tournamentStatistics.startingHandMigrationVersion === 1) return career;
  const next = structuredClone(career);
  const seen = new Set<string>();
  for (const summary of next.handHistory) {
    if (summary.matchType !== 'MINI_TOURNAMENT' || !summary.handId || seen.has(summary.handId)) continue;
    seen.add(summary.handId);
    const hands = next.tournamentStatistics.byStartingHand;
    hands[summary.mode] = applyStartingHand(hands[summary.mode], summary);
  }
  next.recordedHandIds = [...new Set([...next.recordedHandIds, ...seen])];
  next.tournamentStatistics.startingHandMigrationVersion = 1;
  next.tournamentStatistics.trackingStartedAt ||= new Date().toISOString();
  return next;
}
