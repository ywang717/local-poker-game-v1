import { createCareer } from '../career/careerService';
import type { CareerState } from '../career/careerState';
import { createEmptyTournamentStatistics, TOURNAMENT_HISTORY_LIMIT } from '../career/tournamentStatistics';
import { CURRENT_SAVE_VERSION, type HandSnapshot, type VersionedSave } from '../types/persistence';
import type { GameState } from '../game/gameState';
import { getTableLevel, type TableLevelId } from '../career/tableLevels';
import type { MatchType } from '../match/matchTypes';
import { personalityForAiIndex } from '../ai/personalities';
import { selectAiNamesForKey } from '../ai/names';
import { createHandStatsFact, mergeHandStatsFacts, type HandStatsFact } from '../career/handStats';

function isObject(value: unknown): value is Record<string, any> { return typeof value === 'object' && value !== null; }
function levelForBigBlind(bigBlind: unknown): TableLevelId {
  const value = typeof bigBlind === 'number' ? bigBlind : 50;
  return ([5, 4, 3, 2, 1] as const).find((id) => getTableLevel(id).bigBlind <= value) ?? 1;
}
function normalizeCareer(input: Record<string, any>): CareerState {
  const base = createCareer(typeof input.nickname === 'string' && input.nickname.trim() ? input.nickname : '玩家');
  const career = { ...base, ...structuredClone(input) } as CareerState;
  career.careerId = typeof input.careerId === 'string' && input.careerId ? input.careerId : career.createdAt;
  const savedStatistics = isObject(input.statistics) ? input.statistics : {};
  const savedOverall = isObject(savedStatistics.overall) ? savedStatistics.overall : {};
  const savedByMode = isObject(savedStatistics.byMode) ? savedStatistics.byMode : {};
  const savedByStartingHand = isObject(savedStatistics.byStartingHand) ? savedStatistics.byStartingHand : {};
  const savedByPlayerCount = isObject(savedStatistics.byPlayerCount) ? savedStatistics.byPlayerCount : {};
  const savedByLevel = isObject(savedStatistics.byLevel) ? savedStatistics.byLevel : {};
  career.statistics = {
    ...base.statistics,
    ...savedStatistics,
    overall: { ...base.statistics.overall, ...savedOverall },
    byMode: {
      STANDARD: { ...base.statistics.byMode.STANDARD, ...(isObject(savedByMode.STANDARD) ? savedByMode.STANDARD : {}) },
      SHORT_DECK: { ...base.statistics.byMode.SHORT_DECK, ...(isObject(savedByMode.SHORT_DECK) ? savedByMode.SHORT_DECK : {}) },
    },
    byStartingHand: {
      STANDARD: normalizeStartingHandStats(savedByStartingHand.STANDARD),
      SHORT_DECK: normalizeStartingHandStats(savedByStartingHand.SHORT_DECK),
    },
    byPlayerCount: Object.fromEntries(Object.entries(base.statistics.byPlayerCount).map(([key, segment]) => [
      key,
      { ...segment, ...(isObject(savedByPlayerCount[key]) ? savedByPlayerCount[key] : {}) },
    ])) as CareerState['statistics']['byPlayerCount'],
    byLevel: Object.fromEntries(Object.entries(base.statistics.byLevel).map(([key, segment]) => [
      key,
      { ...segment, ...(isObject(savedByLevel[key]) ? savedByLevel[key] : {}) },
    ])) as CareerState['statistics']['byLevel'],
  };
  career.saveVersion = CURRENT_SAVE_VERSION;
  career.activeTableSessionId = typeof input.activeTableSessionId === 'string' && input.activeTableSessionId ? input.activeTableSessionId : (career.activeTableSessionId ?? null);
  career.financialTransactions = Array.isArray(input.financialTransactions) ? structuredClone(input.financialTransactions) : [];
  career.pendingCashBuyIns = Array.isArray(input.pendingCashBuyIns) ? structuredClone(input.pendingCashBuyIns) : [];
  const savedTournament = isObject(input.tournamentStatistics) ? input.tournamentStatistics : {};
  const savedTournamentHands = isObject(savedTournament.byStartingHand) ? savedTournament.byStartingHand : {};
  career.tournamentStatistics = {
    ...createEmptyTournamentStatistics(), ...structuredClone(savedTournament),
    byStartingHand: {
      STANDARD: normalizeStartingHandStats(savedTournamentHands.STANDARD),
      SHORT_DECK: normalizeStartingHandStats(savedTournamentHands.SHORT_DECK),
    },
    topThreeFinishes: Number.isSafeInteger(savedTournament.topThreeFinishes) && savedTournament.topThreeFinishes >= 0 ? savedTournament.topThreeFinishes : 0,
    trackingStartedAt: typeof savedTournament.trackingStartedAt === 'string' ? savedTournament.trackingStartedAt : '',
    startingHandMigrationVersion: savedTournament.startingHandMigrationVersion === 1 ? 1 : 0,
  };
  career.tournamentHistory = Array.isArray(input.tournamentHistory) ? structuredClone(input.tournamentHistory).slice(0, TOURNAMENT_HISTORY_LIMIT) : [];
  career.handHistory = Array.isArray(input.handHistory) ? structuredClone(input.handHistory).map((entry: any) => ({ ...entry, potResults: entry.potResults ?? [] })) : [];
  const savedHandStats = Array.isArray(input.handStats) ? structuredClone(input.handStats) as HandStatsFact[] : [];
  career.handStats = savedHandStats.length
    ? savedHandStats.filter((fact) => isObject(fact) && typeof fact.factKey === 'string')
    : career.handHistory.reduce<HandStatsFact[]>((facts, summary) => {
      const fact = createHandStatsFact(summary, career.careerId ?? career.createdAt);
      return fact ? mergeHandStatsFacts(facts, fact) : facts;
    }, []);
  career.recordedHandIds = Array.isArray(input.recordedHandIds) ? [...input.recordedHandIds] : [];
  career.recordedTournamentIds = Array.isArray(input.recordedTournamentIds) ? [...input.recordedTournamentIds] : [];
  return career;
}

function normalizeStartingHandStats(value: unknown): CareerState['statistics']['byStartingHand']['STANDARD'] {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([notation, rawStats]) => {
    if (!isObject(rawStats)) return [];
    const counter = (field: string) => Number.isSafeInteger(rawStats[field]) && rawStats[field] >= 0 ? rawStats[field] : 0;
    return [[notation, { hands: counter('hands'), wins: counter('wins'), splits: counter('splits'), losses: counter('losses') }]];
  }));
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
  career.tournamentStatistics.startingHandMigrationVersion = 0;
  career.tournamentStatistics.trackingStartedAt = '';
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
  // V2.0 snapshots did not persist AI styles. Assign a deterministic default
  // once during migration so future hands keep the same style after reload.
  let aiIndex = 0;
  if (Array.isArray(state.players)) {
    for (const player of state.players) {
      if (!player.isHuman) {
        player.personalityId = player.personalityId ?? personalityForAiIndex(aiIndex);
        aiIndex += 1;
      }
    }
  }
  if (isObject(state.tournamentState)) {
    state.tournamentState = {
      ...state.tournamentState,
      eliminations: Array.isArray(state.tournamentState.eliminations) ? state.tournamentState.eliminations : [],
      rankings: Array.isArray(state.tournamentState.rankings) ? state.tournamentState.rankings : [],
      rewardPaid: state.tournamentState.rewardPaid === true,
      spectator: state.tournamentState.spectator === true,
    };
    const tournamentId = typeof state.tournamentState.tournamentId === 'string' ? state.tournamentState.tournamentId : 'legacy-tournament';
    const tournamentNames = selectAiNamesForKey(5, tournamentId);
    const tournamentNameById = new Map(tournamentNames.map((name, index) => [`ai-${index + 1}`, name]));
    let tournamentAiIndex = 0;
    if (Array.isArray(state.tournamentState.players)) {
      for (const player of state.tournamentState.players) {
        if (!player.isHuman) {
          player.personalityId = player.personalityId ?? personalityForAiIndex(tournamentAiIndex);
          if (typeof player.name !== 'string' || /^AI\s*\d+$/i.test(player.name)) {
            player.name = tournamentNameById.get(player.id) ?? tournamentNames[tournamentAiIndex] ?? player.name;
          }
          tournamentAiIndex += 1;
        }
      }
    }
    if (Array.isArray(state.tournamentState.eliminations)) {
      state.tournamentState.eliminations = state.tournamentState.eliminations.map((entry: any) => ({
        ...entry,
        playerName: entry.playerName ?? tournamentNameById.get(entry.playerId),
      }));
    }
    if (Array.isArray(state.players)) {
      for (const player of state.players) {
        if (!player.isHuman && (typeof player.name !== 'string' || /^AI\s*\d+$/i.test(player.name))) {
          player.name = tournamentNameById.get(player.id) ?? player.name;
        }
      }
    }
  }
  return { saveVersion: CURRENT_SAVE_VERSION, savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(), state };
}
