import type { Card } from './cards';
import type { GameMode } from './rules';
import type { PotRefund } from './pot';
import type { MatchSession, MatchType } from '../match/matchTypes';
import type { TableLevelId } from '../career/tableLevels';
import type { TournamentState } from '../tournament/types';
import type { PersonalityId } from '../ai/personalities';

export const SUPPORTED_TABLE_SIZES = [2, 3, 4, 5, 6, 8, 9] as const;
export type TableSize = (typeof SUPPORTED_TABLE_SIZES)[number];
export type Street = 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'SETTLEMENT';
export type PlayerStatus = 'WAITING' | 'ACTIVE' | 'FOLDED' | 'ALL_IN';

export type TablePlayerConfig = {
  id: string;
  name?: string;
  seat: number;
  stack: number;
  isHuman?: boolean;
  /** Optional fixed AI style. Omitted legacy configs receive a deterministic default. */
  personalityId?: PersonalityId;
};

export type TableConfig = {
  mode: GameMode;
  tableSize: TableSize;
  smallBlind: number;
  bigBlind: number;
  players: readonly TablePlayerConfig[];
  dealerSeat?: number;
  sessionId?: string;
  matchType?: MatchType;
  tableLevel?: TableLevelId;
  session?: MatchSession;
};

export type PlayerState = {
  id: string;
  name: string;
  seat: number;
  stack: number;
  isHuman: boolean;
  /** Fixed for the lifetime of a cash session or tournament. */
  personalityId?: PersonalityId;
  holeCards: Card[];
  streetContribution: number;
  handContribution: number;
  folded: boolean;
  allIn: boolean;
  hasActedStreet: boolean;
  status: PlayerStatus;
};

export type PotState = {
  amount: number;
  eligiblePlayerIds: string[];
  winnerPlayerIds: string[];
  awards: { playerId: string; amount: number }[];
};

export type PlayerAction =
  | { kind: 'fold' }
  | { kind: 'check' }
  | { kind: 'call' }
  | { kind: 'bet-to'; amount: number }
  | { kind: 'raise-to'; amount: number }
  | { kind: 'all-in' };

export type LegalAction =
  | { kind: 'fold' | 'check' }
  | { kind: 'call'; amount: number }
  | { kind: 'bet-to' | 'raise-to'; minAmount: number; maxAmount: number }
  | { kind: 'all-in'; amount: number };

export type ActionRecord = {
  playerId: string;
  street: Exclude<Street, 'SHOWDOWN' | 'SETTLEMENT'>;
  action: PlayerAction['kind'];
  amount: number;
  totalTo: number;
  /** Optional metadata used by public AI observers; old records omit it. */
  isBlind?: boolean;
  isFullRaise?: boolean;
  /** Stack and price before this action; used to classify short/all-in actions. */
  stackBeforeAction?: number;
  previousBet?: number;
  increase?: number;
  isAllInCall?: boolean;
  isAggressiveRaise?: boolean;
  facingBet?: boolean;
};

export type GameState = {
  /** V2 session metadata; optional for source compatibility with hand fixtures. */
  sessionId?: string;
  matchType?: MatchType;
  tableLevel?: TableLevelId;
  /** Mini-tournament metadata; absent on legacy/cash snapshots. */
  tournamentBlindLevel?: number;
  tournamentHandsAtLevel?: number;
  tournamentPlayersRemaining?: number;
  /** Full tournament session metadata, persisted with the current hand. */
  tournamentState?: TournamentState;
  session?: MatchSession;
  handId: string | null;
  handNumber: number;
  mode: GameMode;
  tableSize: TableSize;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  /** Occupied seats when the hand began; folds and later seat filtering never alter this ring. */
  initialOccupiedSeats?: number[];
  smallBlindSeat: number | null;
  bigBlindSeat: number | null;
  street: Street;
  deck: Card[];
  deckIndex: number;
  burnCards: Card[];
  communityCards: Card[];
  players: PlayerState[];
  actingSeat: number | null;
  currentBet: number;
  lastFullRaise: number;
  pots: PotState[];
  /** Uncalled bet amounts returned at settlement. Optional for old snapshots. */
  refunds?: PotRefund[];
  actionHistory: ActionRecord[];
};

export type EngineError = { code: string; message: string };
export type TransitionResult = { ok: true; state: GameState } | { ok: false; state: GameState; error: EngineError };
