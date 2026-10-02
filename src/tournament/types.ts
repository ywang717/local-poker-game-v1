import type { GameMode } from '../game/rules';
import type { TableLevelId } from '../career/tableLevels';
import type { PersonalityId } from '../ai/personalities';

export type TournamentPlayer = {
  id: string;
  name: string;
  seat: number;
  isHuman: boolean;
  stack: number;
  startingStack: number;
  /** Fixed AI style; optional for old tournament snapshots. */
  personalityId?: PersonalityId;
};

export type TournamentElimination = {
  playerId: string;
  /** Preserved so the spectator and result views can show the player's name after removal. */
  playerName?: string;
  rank: number;
  handNumber: number;
  stackBeforeHand: number;
  seat: number;
};

export type TournamentRanking = {
  playerId: string;
  rank: number;
};

export type TournamentState = {
  tournamentId: string;
  mode: GameMode;
  tableLevel: TableLevelId;
  entryFee: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  blindLevel: number;
  handsAtLevel: number;
  handNumber: number;
  players: TournamentPlayer[];
  eliminations: TournamentElimination[];
  rankings: TournamentRanking[];
  championId?: string;
  rewardPaid: boolean;
  spectator: boolean;
  /** The current button marker; retained in pure state so hand starts rotate deterministically. */
  dealerSeat: number;
  /** Ledger identity for the one-time entry charge. */
  entryTransactionId?: string;
};

export type StartTournamentInput = {
  [key: string]: unknown;
  tournamentId?: string;
  mode?: GameMode;
  tableLevel?: TableLevelId;
  entryFee?: number;
  humanId?: string;
  humanPlayerId?: string;
  humanName?: string;
  human?: { id: string; name?: string };
  playerId?: string;
};

export type TournamentRewardTransaction = {
  transactionId: string;
  sessionId: string;
  kind: 'TOURNAMENT_CHAMPION_REWARD';
  amount: number;
  status: 'APPLIED';
  createdAt: string;
};

export type TournamentFinishResult = {
  state: TournamentState;
  championId: string;
  rewardTransaction?: TournamentRewardTransaction;
};
