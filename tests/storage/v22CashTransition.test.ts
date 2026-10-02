import { describe, expect, it, vi } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { cashSession } from '../../src/match/session';
import { createTable } from '../../src/game/gameEngine';
import { commitCashNextHandAndPublish, createNextHand } from '../../src/App';
import { chooseActionForState } from '../../src/ai/turn';
import type { GameState } from '../../src/game/gameState';
import { useGameStore, flushGamePersistenceQueue } from '../../src/store/gameStore';
import { prepareCashNextHandTransition, persistPreparedCashNextHandTransition } from '../../src/career/cashBuyInTransition';
import { loadCareer, loadHandSnapshot, resetStorageForTests, saveCareer, saveCareerAndHandSnapshot } from '../../src/storage/saveSystem';
import { requestCashBuyIn } from '../../src/career/cashBuyInService';

describe('V2.2 cash transition persistence', () => {
  it('does not expose the next hand to instant AI while the atomic save is pending', async () => {
    await resetStorageForTests();
    const session = cashSession('STANDARD', 1, 'instant-ai-session');
    const career = { ...createCareer('P'), activeTableStack: 4_000, activeTableSessionId: session.sessionId };
    const requested = requestCashBuyIn(career, session, 5_000).career;
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, dealerSeat: 0, session, tableLevel: 1, matchType: 'CASH', players: [{ id: 'human', name: 'P', seat: 0, stack: 4_000, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 5_000 }] });
    const settled = { ...table, handId: 'instant-ai-hand', street: 'SETTLEMENT' as const };
    const prepared = prepareCashNextHandTransition(requested, settled, createNextHand);
    const originalSave = saveCareerAndHandSnapshot;
    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
    const saveSpy = vi.spyOn(await import('../../src/storage/saveSystem'), 'saveCareerAndHandSnapshot')
      .mockImplementationOnce(async (nextCareer, snapshot) => {
        await saveGate;
        return originalSave(nextCareer, snapshot);
      });
    let visibleGame: GameState = settled;
    const published: string[] = [];
    const commit = commitCashNextHandAndPublish(prepared, () => { published.push('career'); }, (game) => {
      visibleGame = game;
      published.push('game');
    });
    await vi.waitFor(() => expect(saveSpy).toHaveBeenCalledOnce());
    expect(published).toEqual([]);
    expect(visibleGame).toBe(settled);
    expect(chooseActionForState(visibleGame)).toBeNull();
    releaseSave();
    await commit;
    expect(published).toEqual(['career', 'game']);
    expect((await loadHandSnapshot())?.state.handId).toBe(prepared.game.handId);
    saveSpy.mockRestore();
    await resetStorageForTests();
  });
  it('updates a game in memory without enqueueing another snapshot', async () => {
    await resetStorageForTests();
    const game = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, sessionId: 'queue-test', matchType: 'CASH', tableLevel: 1, players: [{ id: 'human', seat: 0, stack: 1_000, isHuman: true }, { id: 'ai', seat: 1, stack: 1_000 }] });
    useGameStore.getState().setGameWithoutPersistence(game);
    expect(useGameStore.getState().game).toEqual(game);
    await flushGamePersistenceQueue();
    expect(await loadHandSnapshot()).toBeNull();
    useGameStore.getState().setGame(null);
    await flushGamePersistenceQueue();
    await resetStorageForTests();
  });

  it('keeps the settled hand available when the atomic save fails and can retry', async () => {
    await resetStorageForTests();
    const session = cashSession('STANDARD', 1, 'retry-session');
    const career = { ...createCareer('P'), activeTableStack: 4_000, activeTableSessionId: session.sessionId };
    const requested = requestCashBuyIn(career, session, 5_000).career;
    await saveCareer(requested);
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, dealerSeat: 0, session, tableLevel: 1, matchType: 'CASH', players: [{ id: 'human', name: 'P', seat: 0, stack: 4_000, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 5_000 }] });
    const settled = { ...table, handId: 'retry-hand', handNumber: 1, street: 'SETTLEMENT' as const };
    const prepared = prepareCashNextHandTransition(requested, settled, createNextHand);
    const saveSpy = vi.spyOn(await import('../../src/storage/saveSystem'), 'saveCareerAndHandSnapshot')
      .mockRejectedValueOnce(new Error('transient write failure'));
    await expect(persistPreparedCashNextHandTransition(prepared)).rejects.toThrow('transient write failure');
    expect((await loadCareer()).career?.pendingCashBuyIns[0].status).toBe('PENDING');
    await persistPreparedCashNextHandTransition(prepared);
    expect((await loadCareer()).career?.pendingCashBuyIns[0].status).toBe('APPLIED');
    expect((await loadHandSnapshot())?.state.handId).toBe(prepared.game.handId);
    saveSpy.mockRestore();
    await resetStorageForTests();
  });

  it('does not apply a completed transaction again after reload', async () => {
    await resetStorageForTests();
    const session = cashSession('STANDARD', 1, 'idempotent-session');
    const career = { ...createCareer('P'), activeTableStack: 4_000, activeTableSessionId: session.sessionId };
    const requested = requestCashBuyIn(career, session, 5_000).career;
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, dealerSeat: 0, session, tableLevel: 1, matchType: 'CASH', players: [{ id: 'human', name: 'P', seat: 0, stack: 4_000, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 5_000 }] });
    await persistPreparedCashNextHandTransition(prepareCashNextHandTransition(requested, { ...table, handId: 'idempotent-hand', street: 'SETTLEMENT' }, createNextHand));
    const loaded = (await loadCareer()).career!;
    const before = loaded.currentFunds;
    await saveCareerAndHandSnapshot(loaded, (await loadHandSnapshot())!);
    expect((await loadCareer()).career?.currentFunds).toBe(before);
    await resetStorageForTests();
  });
});
