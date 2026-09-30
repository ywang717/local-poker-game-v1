import type { GameMode } from '../game/rules';
import type { TableLevelId } from '../career/tableLevels';

export type MatchType = 'CASH' | 'MINI_TOURNAMENT';
export type MatchSession = {
  sessionId: string;
  matchType: MatchType;
  tableLevel: TableLevelId;
  mode: GameMode;
};
