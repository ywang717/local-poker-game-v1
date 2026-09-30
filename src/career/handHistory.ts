import type { Card } from '../game/cards';
import type { ActionRecord } from '../game/gameState';
import type { GameMode } from '../game/rules';
import type { TableLevelId } from './tableLevels';

export const HAND_HISTORY_LIMIT = 500;
export type HandResult = 'WIN' | 'LOSS' | 'SPLIT' | 'FOLD';
export type PotReview = {
  amount: number;
  winnerPlayerIds: string[];
  awards: { playerId: string; amount: number }[];
};

export type HandSummary = {
  handId: string;
  timestamp: string;
  mode: GameMode;
  tableLevel: TableLevelId;
  tableSize: 2 | 3 | 4 | 5 | 6 | 8 | 9;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  playerHoleCards: Card[];
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
};

export function appendHandHistory(history: readonly HandSummary[], entry: HandSummary): HandSummary[] {
  return [{
    ...entry,
    playerHoleCards: [...entry.playerHoleCards],
    communityCards: [...entry.communityCards],
    actionHistory: entry.actionHistory.map((record) => ({ ...record })),
    playerNames: entry.playerNames ? { ...entry.playerNames } : undefined,
    potResults: (entry.potResults ?? []).map((pot) => ({ ...pot, winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })),
  }, ...history].slice(0, HAND_HISTORY_LIMIT);
}
