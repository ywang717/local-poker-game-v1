import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { applyPendingCashBuyIn, cancelPendingCashBuyIn, requestCashBuyIn } from '../../src/career/cashBuyInService';
import { cashSession } from '../../src/match/session';
import { resetStorageForTests } from '../../src/storage/saveSystem';
import { loadCareer, saveCareer } from '../../src/storage/saveSystem';

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
});
