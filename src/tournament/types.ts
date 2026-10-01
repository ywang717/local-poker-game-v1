import type { GameMode } from '../game/rules';
import type { TableLevelId } from '../career/tableLevels';

export type TournamentPlayer = {
  id: string;
  name: string;
  seat: number;
  isHuman: boolean;
  stack: number;
  startingStack: number;
};

export type TournamentElimination = {
  playerId: string;
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
