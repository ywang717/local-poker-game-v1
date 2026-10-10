import { beforeEach, describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { createCareer } from '../../src/career/careerService';
import { HAND_HISTORY_LIMIT } from '../../src/career/handHistory';
import { saveCareer, loadCareer, saveHandSnapshot, loadHandSnapshot, resetStorageForTests, putRawRecord } from '../../src/storage/saveSystem';
import type { HandSnapshot } from '../../src/types/persistence';

beforeEach(async () => {
  await resetStorageForTests();
});

describe('IndexedDB save system', () => {
  it('saves and restores career and a complete hand snapshot', async () => {
    const career = createCareer('本地玩家');
    await saveCareer(career);
    const loadedCareer = await loadCareer();
    expect(loadedCareer.status).toBe('loaded');
    expect(loadedCareer.career).toEqual(career);

    const table = createTable({
      mode: 'STANDARD',
      tableSize: 2,
      smallBlind: 5,
      bigBlind: 10,
      dealerSeat: 0,
      players: [{ id: 'human', seat: 0, stack: 100 }, { id: 'ai', seat: 1, stack: 100 }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    state.communityCards = [state.deck[6], state.deck[7], state.deck[8]];
    state.deckIndex = 9;
    state.street = 'FLOP';
    const snapshot: HandSnapshot = { saveVersion: 1, savedAt: '2026-09-30T00:00:00.000Z', state };
    await saveHandSnapshot(snapshot);
    expect(await loadHandSnapshot()).toEqual({ ...snapshot, saveVersion: 2 });
  });

  it('rotates the previous valid career save into a backup and recovers it when current is corrupt', async () => {
    const first = createCareer('第一版');
    await saveCareer(first);
    const second = { ...first, nickname: '第二版' };
    await saveCareer(second);
    await putRawRecord('career', 'current', { saveVersion: 99, broken: true });
    const result = await loadCareer();
    expect(result.status).toBe('recovered');
    expect(result.restoredFromBackup).toBe(true);
    expect(result.career?.nickname).toBe('第一版');
  });

  it('returns a recoverable error when both current and backup are corrupt', async () => {
    await putRawRecord('career', 'current', { saveVersion: 99 });
    await putRawRecord('career', 'backup', { saveVersion: 98 });
    const result = await loadCareer();
    expect(result.status).toBe('corrupt');
    expect(result.career).toBeNull();
    expect(result.error).toMatch(/无法恢复|recover/i);
  });

  it('rejects an unsupported current hand snapshot and recovers the valid backup', async () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, players: [{ id: 'a', seat: 0, stack: 100 }, { id: 'b', seat: 1, stack: 100 }] });
    const state = startHand(table, createDeck('STANDARD'));
    await putRawRecord('currentHand', 'backup', { saveVersion: 1, savedAt: '2026-01-01T00:00:00Z', state });
    await putRawRecord('currentHand', 'current', { saveVersion: 99, savedAt: '2026-01-01T00:00:00Z', state });
    const loaded = await loadHandSnapshot();
    expect(loaded?.saveVersion).toBe(2);
    expect(loaded?.state.matchType).toBe('CASH');
  });

  it('trims saved history to the latest 10000 entries', async () => {
    const career = createCareer('历史玩家');
    career.handHistory = Array.from({ length: HAND_HISTORY_LIMIT + 10 }, (_, index) => ({
      handId: `h-${index}`,
      timestamp: '2026-09-30T00:00:00.000Z',
      mode: 'STANDARD' as const,
      tableLevel: 1 as const,
      tableSize: 6 as const,
      smallBlind: 25,
      bigBlind: 50,
      dealerSeat: 0,
      playerHoleCards: [],
      communityCards: [],
      finalCategory: null,
      finalPot: 0,
      playerContribution: 0,
      playerNet: 0,
      result: 'FOLD' as const,
      actionHistory: [],
    }));
    await saveCareer(career);
    const loaded = await loadCareer();
    expect(loaded.career?.handHistory).toHaveLength(HAND_HISTORY_LIMIT);
    expect(loaded.career?.handHistory[0].handId).toBe('h-0');
    expect(loaded.career?.handHistory.at(-1)?.handId).toBe(`h-${HAND_HISTORY_LIMIT - 1}`);
  });
});
