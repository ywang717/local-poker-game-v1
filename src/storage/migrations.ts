import { createCareer } from '../career/careerService';
import type { CareerState } from '../career/careerState';
import { CURRENT_SAVE_VERSION, type VersionedSave } from '../types/persistence';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function currentSave(data: Record<string, unknown>): VersionedSave {
  if (!isObject(data.career)) throw new Error('Invalid current career save');
  return { saveVersion: CURRENT_SAVE_VERSION, career: structuredClone(data.career) as CareerState };
}

export function migrateSave(data: unknown): VersionedSave {
  if (!isObject(data)) throw new Error('Invalid save data');
  if (data.saveVersion === CURRENT_SAVE_VERSION) return currentSave(data);
  if (data.saveVersion !== undefined && data.saveVersion !== 0) throw new Error(`Unsupported save version ${String(data.saveVersion)}`);
  const nickname = typeof data.nickname === 'string' && data.nickname.trim() ? data.nickname : '玩家';
  const base = createCareer(nickname);
  const legacyFunds = typeof data.funds === 'number' ? data.funds : base.currentFunds;
  const legacyPeak = typeof data.highestFunds === 'number' ? data.highestFunds : Math.max(base.peakFunds, legacyFunds);
  const career: CareerState = {
    ...base,
    currentFunds: Number.isSafeInteger(legacyFunds) && legacyFunds >= 0 ? legacyFunds : base.currentFunds,
    peakFunds: Number.isSafeInteger(legacyPeak) && legacyPeak >= 0 ? legacyPeak : base.peakFunds,
    lowestFunds: Number.isSafeInteger(legacyFunds) && legacyFunds >= 0 ? legacyFunds : base.lowestFunds,
    bankruptcyCount: typeof data.bankruptcies === 'number' && Number.isSafeInteger(data.bankruptcies) && data.bankruptcies >= 0 ? data.bankruptcies : 0,
    unlockedLevels: Array.isArray(data.unlockedLevels) ? data.unlockedLevels.filter((level): level is 1 | 2 | 3 | 4 | 5 => [1, 2, 3, 4, 5].includes(level as number)) : [1],
    handHistory: Array.isArray(data.handHistory) ? structuredClone(data.handHistory) as CareerState['handHistory'] : [],
  };
  return { saveVersion: CURRENT_SAVE_VERSION, career };
}
