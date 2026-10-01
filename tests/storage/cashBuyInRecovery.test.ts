import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { requestCashBuyIn } from '../../src/career/cashBuyInService';
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
    await resetStorageForTests();
  });
});
