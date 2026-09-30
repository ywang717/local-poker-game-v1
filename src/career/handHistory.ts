import type { Card } from '../game/cards';
import type { ActionRecord } from '../game/gameState';
import type { GameMode } from '../game/rules';
import type { TableLevelId } from './tableLevels';

export const HAND_HISTORY_LIMIT = 500;
export type HandResult = 'WIN' | 'LOSS' | 'SPLIT' | 'FOLD';

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
  }, ...history].slice(0, HAND_HISTORY_LIMIT);
}
