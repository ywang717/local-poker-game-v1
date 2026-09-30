import { createCareer } from '../career/careerService';
import type { CareerState } from '../career/careerState';
import { createEmptyTournamentStatistics } from '../career/tournamentStatistics';
import { CURRENT_SAVE_VERSION, type HandSnapshot, type VersionedSave } from '../types/persistence';
import type { GameState } from '../game/gameState';
import { getTableLevel, type TableLevelId } from '../career/tableLevels';
import type { MatchType } from '../match/matchTypes';

function isObject(value: unknown): value is Record<string, any> { return typeof value === 'object' && value !== null; }
function levelForBigBlind(bigBlind: unknown): TableLevelId {
  const value = typeof bigBlind === 'number' ? bigBlind : 50;
  return ([5, 4, 3, 2, 1] as const).find((id) => getTableLevel(id).bigBlind <= value) ?? 1;
}
function normalizeCareer(input: Record<string, any>): CareerState {
  const base = createCareer(typeof input.nickname === 'string' && input.nickname.trim() ? input.nickname : '玩家');
  const career = { ...base, ...structuredClone(input) } as CareerState;
  career.saveVersion = CURRENT_SAVE_VERSION;
  career.financialTransactions = Array.isArray(input.financialTransactions) ? structuredClone(input.financialTransactions) : [];
  career.pendingCashBuyIns = Array.isArray(input.pendingCashBuyIns) ? structuredClone(input.pendingCashBuyIns) : [];
  career.tournamentStatistics = isObject(input.tournamentStatistics) ? { ...createEmptyTournamentStatistics(), ...structuredClone(input.tournamentStatistics) } : createEmptyTournamentStatistics();
  career.handHistory = Array.isArray(input.handHistory) ? structuredClone(input.handHistory).map((entry: any) => ({ ...entry, potResults: entry.potResults ?? [] })) : [];
  career.recordedHandIds = Array.isArray(input.recordedHandIds) ? [...input.recordedHandIds] : [];
  return career;
}
export function migrateSave(data: unknown): VersionedSave {
  if (!isObject(data)) throw new Error('Invalid save data');
  if (data.saveVersion === CURRENT_SAVE_VERSION) {
    if (!isObject(data.career)) throw new Error('Invalid current career save');
    return { saveVersion: CURRENT_SAVE_VERSION, career: normalizeCareer(data.career) };
  }
  if (data.saveVersion !== undefined && data.saveVersion !== 0 && data.saveVersion !== 1) throw new Error(`Unsupported save version ${String(data.saveVersion)}`);
  if (data.saveVersion === 1 && isObject(data.career)) return { saveVersion: CURRENT_SAVE_VERSION, career: normalizeCareer(data.career) };
  const base = createCareer(typeof data.nickname === 'string' && data.nickname.trim() ? data.nickname : '玩家');
  const legacyFunds = typeof data.funds === 'number' ? data.funds : base.currentFunds;
  const legacyPeak = typeof data.highestFunds === 'number' ? data.highestFunds : Math.max(base.peakFunds, legacyFunds);
  const career: CareerState = { ...base,
    currentFunds: Number.isSafeInteger(legacyFunds) && legacyFunds >= 0 ? legacyFunds : base.currentFunds,
    peakFunds: Number.isSafeInteger(legacyPeak) && legacyPeak >= 0 ? legacyPeak : base.peakFunds,
    lowestFunds: Number.isSafeInteger(legacyFunds) && legacyFunds >= 0 ? legacyFunds : base.lowestFunds,
    bankruptcyCount: typeof data.bankruptcies === 'number' && Number.isSafeInteger(data.bankruptcies) && data.bankruptcies >= 0 ? data.bankruptcies : 0,
    unlockedLevels: Array.isArray(data.unlockedLevels) ? data.unlockedLevels.filter((level: unknown): level is 1 | 2 | 3 | 4 | 5 => [1, 2, 3, 4, 5].includes(level as number)) : [1],
    handHistory: Array.isArray(data.handHistory) ? structuredClone(data.handHistory).map((entry: any) => ({ ...entry, potResults: entry.potResults ?? [] })) : [],
  };
  return { saveVersion: CURRENT_SAVE_VERSION, career };
}

export function migrateHandSnapshot(data: unknown): HandSnapshot {
  if (!isObject(data) || !isObject(data.state) || !Array.isArray(data.state.deck)) throw new Error('Invalid hand snapshot');
  if (data.saveVersion !== 1 && data.saveVersion !== CURRENT_SAVE_VERSION) throw new Error(`Unsupported hand snapshot version ${String(data.saveVersion)}`);
  const state = structuredClone(data.state) as GameState & Record<string, any>;
  const mode = state.mode ?? 'STANDARD';
  const tableLevel = state.tableLevel ?? levelForBigBlind(state.bigBlind);
  const sessionId = state.sessionId ?? `legacy-session-${state.handId ?? 'current'}`;
  const matchType: MatchType = state.matchType === 'MINI_TOURNAMENT' ? 'MINI_TOURNAMENT' : 'CASH';
  state.sessionId = sessionId; state.matchType = matchType; state.tableLevel = tableLevel;
  state.session = state.session ?? { sessionId, matchType, tableLevel, mode };
  return { saveVersion: CURRENT_SAVE_VERSION, savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(), state };
}
