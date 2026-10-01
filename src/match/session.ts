import type { GameMode } from '../game/rules';
import type { TableLevelId } from '../career/tableLevels';
import type { MatchSession, MatchType } from './matchTypes';

let sequence = 0;
export function createMatchSession(input: { mode: GameMode; tableLevel: TableLevelId; matchType?: MatchType; sessionId?: string }): MatchSession {
  const sessionId = input.sessionId ?? (globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${sequence += 1}`);
  return { sessionId, matchType: input.matchType ?? 'CASH', tableLevel: input.tableLevel, mode: input.mode };
}
export function cashSession(mode: GameMode, tableLevel: TableLevelId, sessionId?: string): MatchSession {
  return createMatchSession({ mode, tableLevel, sessionId, matchType: 'CASH' });
}
