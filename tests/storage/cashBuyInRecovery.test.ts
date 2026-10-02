import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { applyPendingCashBuyIn, cancelPendingCashBuyIn, requestCashBuyIn } from '../../src/career/cashBuyInService';
import { cashSession } from '../../src/match/session';
import { prepareCashNextHandTransition, persistPreparedCashNextHandTransition } from '../../src/career/cashBuyInTransition';
import { createTable } from '../../src/game/gameEngine';
import { loadCareer, loadHandSnapshot, resetStorageForTests, saveCareer } from '../../src/storage/saveSystem';
import { createNextHand } from '../../src/App';

describe('cash buy-in recovery', () => {
  it('recovers pending transactions from IndexedDB', async () => {
    await resetStorageForTests();
    const career = { ...createCareer('P'), activeTableStack: 1_000 };
    const requested = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 2_000).career;
    await saveCareer(requested);
    const loaded = await loadCareer();
    expect(loaded.career?.pendingCashBuyIns[0].status).toBe('PENDING');
    const applied = applyPendingCashBuyIn(loaded.career!, loaded.career!.pendingCashBuyIns[0], 1_000).career;
    await saveCareer(applied);
    const appliedLoaded = (await loadCareer()).career!;
    expect(appliedLoaded.pendingCashBuyIns[0].status).toBe('APPLIED');
    expect(applyPendingCashBuyIn(appliedLoaded, appliedLoaded.pendingCashBuyIns[0], 1_000).career.currentFunds).toBe(appliedLoaded.currentFunds);
    const refundRequest = requestCashBuyIn({ ...createCareer('P'), activeTableStack: 1_000 }, cashSession('STANDARD', 1, 'refund'), 2_000);
    const refunded = cancelPendingCashBuyIn(refundRequest.career, refundRequest.pending.transactionId);
    await saveCareer(refunded);
    const refundedLoaded = (await loadCareer()).career!;
    expect(refundedLoaded.pendingCashBuyIns[0].status).toBe('REFUNDED');
    expect(cancelPendingCashBuyIn(refundedLoaded, refundRequest.pending.transactionId).currentFunds).toBe(refundedLoaded.currentFunds);
    await resetStorageForTests();
  });

  it('commits the applied buy-in and next hand snapshot together', async () => {
    await resetStorageForTests();
    const session = cashSession('STANDARD', 1, 'atomic-session');
    const career = { ...createCareer('P'), activeTableStack: 4_000, activeTableSessionId: session.sessionId };
    const requested = requestCashBuyIn(career, session, 5_000).career;
    await saveCareer(requested);
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, dealerSeat: 0,
      session, tableLevel: 1, matchType: 'CASH',
      players: [{ id: 'human', name: 'P', seat: 0, stack: 4_000, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 5_000 }],
    });
    const settled = { ...table, handId: 'atomic-hand', handNumber: 1, street: 'SETTLEMENT' as const };
    const prepared = prepareCashNextHandTransition(requested, settled, createNextHand);
    expect(prepared.appliedAmount).toBe(1_000);
    await persistPreparedCashNextHandTransition(prepared);
    const loaded = (await loadCareer()).career!;
    const snapshot = await loadHandSnapshot();
    expect(loaded.pendingCashBuyIns.find((entry) => entry.sessionId === session.sessionId)?.status).toBe('APPLIED');
    expect(snapshot?.state.handId).toBe(prepared.game.handId);
    expect(snapshot?.state.players.find((player) => player.isHuman)?.stack).toBe(loaded.activeTableStack);
    const replay = applyPendingCashBuyIn(loaded, loaded.pendingCashBuyIns.find((entry) => entry.sessionId === session.sessionId)!, 4_000);
    expect(replay.career.currentFunds).toBe(loaded.currentFunds);
    await resetStorageForTests();
  });
});
