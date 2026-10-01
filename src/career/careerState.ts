import type { GameMode } from '../game/rules';
import type { TableSize } from '../game/gameState';
import type { HandSummary } from './handHistory';
import type { CareerStatistics } from './statistics';
import type { TableLevelId } from './tableLevels';
import type { FinancialTransaction, PendingCashBuyIn } from './transactionTypes';
import type { TournamentStatistics } from './tournamentStatistics';

export type CareerState = {
  saveVersion: number;
  nickname: string;
  createdAt: string;
  currentFunds: number;
  peakFunds: number;
  lowestFunds: number;
  activeTableStack: number | null;
  /** Stable identity for the currently seated cash table, when present. */
  activeTableSessionId?: string | null;
  defaultMode: GameMode;
  defaultTableSize: TableSize;
  unlockedLevels: TableLevelId[];
  bankruptcyCount: number;
  statistics: CareerStatistics;
  handHistory: HandSummary[];
  recordedHandIds: string[];
  financialTransactions: FinancialTransaction[];
  pendingCashBuyIns: PendingCashBuyIn[];
  tournamentStatistics: TournamentStatistics;
  /** Tournament IDs whose final result has already been recorded. */
  recordedTournamentIds: string[];
};
