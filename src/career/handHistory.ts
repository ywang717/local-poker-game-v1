import type { Card } from '../game/cards';
import type { ActionRecord } from '../game/gameState';
import type { GameMode } from '../game/rules';
import type { TableLevelId } from './tableLevels';
import type { MatchType } from '../match/matchTypes';

/** Full hand reviews are retained separately from compact lifetime statistics. */
export const HAND_HISTORY_LIMIT = 10_000;
export type HandResult = 'WIN' | 'LOSS' | 'SPLIT' | 'FOLD' | 'PARTIAL_WIN';
export type PotReview = {
  amount: number;
  eligiblePlayerIds?: string[];
  winnerPlayerIds: string[];
  awards: { playerId: string; amount: number }[];
};

export type HandSummary = {
  handId: string;
  /** Absent from legacy cash histories. Tournament chips are never cash profit. */
  matchType?: MatchType;
  tournamentId?: string;
  timestamp: string;
  mode: GameMode;
  tableLevel: TableLevelId;
  tableSize: 2 | 3 | 4 | 5 | 6 | 8 | 9;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  playerHoleCards: Card[];
  /** The human player ID used in action/pot records; legacy summaries default to human. */
  playerId?: string;
  playerSeat?: number;
  playerPosition?: import('../ai/positionStrategy').DetailedPosition;
  initialPlayerStack?: number;
  effectiveStackBB?: number;
  communityCards: Card[];
  finalCategory: string | null;
  finalPot: number;
  playerContribution: number;
  playerNet: number;
  result: HandResult;
  actionHistory: ActionRecord[];
  /** Names captured at settlement so history remains readable after the table closes. */
  playerNames?: Record<string, string>;
  potResults?: PotReview[];
  allIn?: boolean;
  allInWon?: boolean;
  vpip?: boolean;
  pfr?: boolean;
  threeBet?: boolean;
  threeBetOpportunity?: boolean;
  fourBet?: boolean;
  fourBetOpportunity?: boolean;
  foldPreflop?: boolean;
  allInCall?: boolean;
  sawFlop?: boolean;
  sawTurn?: boolean;
  sawRiver?: boolean;
  trueShowdown?: boolean;
  wonWithoutShowdown?: boolean;
};

export function appendHandHistory(history: readonly HandSummary[], entry: HandSummary): HandSummary[] {
  return [{
    ...entry,
    playerHoleCards: [...entry.playerHoleCards],
    communityCards: [...entry.communityCards],
    actionHistory: entry.actionHistory.map((record) => ({ ...record })),
    playerNames: entry.playerNames ? { ...entry.playerNames } : undefined,
    potResults: (entry.potResults ?? []).map((pot) => ({ ...pot, eligiblePlayerIds: pot.eligiblePlayerIds ? [...pot.eligiblePlayerIds] : undefined, winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })),
  }, ...history].slice(0, HAND_HISTORY_LIMIT);
}
