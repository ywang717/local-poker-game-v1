import { HAND_HISTORY_LIMIT } from '../career/handHistory';
import type { CareerState } from '../career/careerState';
import { migrateHandSnapshot, migrateSave } from './migrations';
import { deleteDatabase, readRecord, writeRecords, type StoreName } from './database';
import { CURRENT_SAVE_VERSION, type HandSnapshot, type LoadResult, type VersionedSave } from '../types/persistence';
import type { SettingsState } from '../store/settingsStore';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function historyTrimmed(career: CareerState): CareerState {
  return { ...career, handHistory: career.handHistory.slice(0, HAND_HISTORY_LIMIT) };
}

function careerRecord(career: CareerState): VersionedSave {
  return { saveVersion: CURRENT_SAVE_VERSION, career: clone(historyTrimmed(career)) };
}

async function rotateAndWrite(storeName: StoreName, value: unknown): Promise<void> {
  const current = await readRecord(storeName, 'current');
  const records = [{ storeName, key: 'current', value }];
  if (current !== undefined) records.unshift({ storeName, key: 'backup', value: current });
  await writeRecords(records);
}

export async function saveCareer(career: CareerState): Promise<void> {
  const record = careerRecord(career);
  const currentHistory = { entries: record.career.handHistory.slice(0, HAND_HISTORY_LIMIT) };
  const previousCareer = await readRecord('career', 'current');
  const previousHistory = await readRecord('handHistory', 'current');
  const records: { storeName: StoreName; key: string; value: unknown }[] = [
    { storeName: 'career', key: 'current', value: record },
    { storeName: 'handHistory', key: 'current', value: currentHistory },
  ];
  if (previousCareer !== undefined) records.push({ storeName: 'career', key: 'backup', value: previousCareer });
  if (previousHistory !== undefined) records.push({ storeName: 'handHistory', key: 'backup', value: previousHistory });
  await writeRecords(records);
}

function parseCareerRecord(raw: unknown): CareerState {
  return migrateSave(raw).career;
}

function historyFromRecord(raw: unknown): CareerState['handHistory'] | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { entries?: unknown }).entries)) return null;
  return clone((raw as { entries: CareerState['handHistory'] }).entries).slice(0, HAND_HISTORY_LIMIT);
}

export async function loadCareer(): Promise<LoadResult> {
  const current = await readRecord('career', 'current');
  const backup = await readRecord('career', 'backup');
  if (current === undefined && backup === undefined) return { status: 'empty', career: null, restoredFromBackup: false };
  try {
    const career = parseCareerRecord(current);
    const history = historyFromRecord(await readRecord('handHistory', 'current'));
    if (history) career.handHistory = history;
    return { status: 'loaded', career, restoredFromBackup: false };
  } catch (currentError) {
    try {
      const career = parseCareerRecord(backup);
      const history = historyFromRecord(await readRecord('handHistory', 'backup'));
      if (history) career.handHistory = history;
      return { status: 'recovered', career, restoredFromBackup: true };
    } catch (backupError) {
      return { status: 'corrupt', career: null, restoredFromBackup: false, error: `存档无法恢复: ${String((backupError as Error)?.message ?? currentError)}` };
    }
  }
}

export async function saveHandSnapshot(snapshot: HandSnapshot): Promise<void> {
  if (snapshot.saveVersion !== CURRENT_SAVE_VERSION && snapshot.saveVersion !== 1) throw new Error('Unsupported hand snapshot version');
  await rotateAndWrite('currentHand', migrateHandSnapshot(snapshot));
}

/**
 * Persist the career record and the next hand snapshot in one IndexedDB
 * transaction.  Cash-table transitions update both records together; keeping
 * them in separate queued writes could otherwise leave a pending top-up in the
 * career record after the hand snapshot had already advanced (or vice versa).
 */
export async function saveCareerAndHandSnapshot(career: CareerState, snapshot: HandSnapshot): Promise<void> {
  if (snapshot.saveVersion !== CURRENT_SAVE_VERSION && snapshot.saveVersion !== 1) throw new Error('Unsupported hand snapshot version');
  const migratedSnapshot = migrateHandSnapshot(snapshot);
  const record = careerRecord(career);
  const currentHistory = { entries: record.career.handHistory.slice(0, HAND_HISTORY_LIMIT) };
  const [previousCareer, previousHistory, previousHand] = await Promise.all([
    readRecord('career', 'current'),
    readRecord('handHistory', 'current'),
    readRecord('currentHand', 'current'),
  ]);
  const records: { storeName: StoreName; key: string; value: unknown }[] = [
    { storeName: 'career', key: 'current', value: record },
    { storeName: 'handHistory', key: 'current', value: currentHistory },
    { storeName: 'currentHand', key: 'current', value: migratedSnapshot },
  ];
  if (previousCareer !== undefined) records.push({ storeName: 'career', key: 'backup', value: previousCareer });
  if (previousHistory !== undefined) records.push({ storeName: 'handHistory', key: 'backup', value: previousHistory });
  if (previousHand !== undefined) records.push({ storeName: 'currentHand', key: 'backup', value: previousHand });
  await writeRecords(records);
}

export async function loadHandSnapshot(): Promise<HandSnapshot | null> {
  const current = await readRecord<HandSnapshot>('currentHand', 'current');
  const backup = await readRecord<HandSnapshot>('currentHand', 'backup');
  for (const candidate of [current, backup]) {
    if (candidate && candidate.state && Array.isArray(candidate.state.deck)) {
      try { return clone(migrateHandSnapshot(candidate)); } catch { /* try backup */ }
    }
  }
  return null;
}

export async function clearHandSnapshot(): Promise<void> {
  await writeRecords([], [{ storeName: 'currentHand', key: 'current' }, { storeName: 'currentHand', key: 'backup' }]);
}

export async function saveSettings(settings: SettingsState): Promise<void> {
  const persisted: SettingsState = {
    soundEnabled: settings.soundEnabled,
    animationSpeed: settings.animationSpeed,
    aiSpeed: settings.aiSpeed,
    allInConfirmation: settings.allInConfirmation,
    autoShowWinningHand: settings.autoShowWinningHand,
    shortDeckNotice: settings.shortDeckNotice,
  };
  await rotateAndWrite('settings', persisted);
}

export async function loadSettings(): Promise<SettingsState | null> {
  const current = await readRecord<SettingsState>('settings', 'current');
  const backup = await readRecord<SettingsState>('settings', 'backup');
  for (const candidate of [current, backup]) {
    if (candidate && typeof candidate.soundEnabled === 'boolean' && typeof candidate.shortDeckNotice === 'boolean') return clone(candidate);
  }
  return null;
}

export async function putRawRecord(storeName: StoreName, key: string, value: unknown): Promise<void> {
  await writeRecords([{ storeName, key, value }]);
}

export async function resetStorageForTests(): Promise<void> {
  await deleteDatabase();
}
