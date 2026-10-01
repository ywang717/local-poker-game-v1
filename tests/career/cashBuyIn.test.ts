import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { applyPendingCashBuyIn, cancelPendingCashBuyIn, getCashBuyInOptions, requestCashBuyIn } from '../../src/career/cashBuyInService';
import { cashSession } from '../../src/match/session';

describe('cash table buy-ins', () => {
  it('offers standard targets and reserves only the required amount', () => {
    const career = { ...createCareer('P'), activeTableStack: 1_000 };
    const options = getCashBuyInOptions(1, 1_000, career.currentFunds);
    expect(options.map((entry) => entry.targetStack)).toEqual([1_250, 2_500, 5_000]);
    const result = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 2_500);
    expect(result.pending.requestedAmount).toBe(1_500);
    expect(result.career.currentFunds).toBe(8_500);
  });

  it('caps application at 100BB and refunds excess idempotently', () => {
    const career = { ...createCareer('P'), activeTableStack: 0 };
    const request = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 5_000);
    const applied = applyPendingCashBuyIn(request.career, request.pending, 4_900);
    expect(applied.appliedAmount).toBe(100);
    expect(applied.refundedAmount).toBe(4_900);
    expect(applied.career.currentFunds).toBe(9_900);
    expect(applyPendingCashBuyIn(applied.career, request.pending, 4_900).career.currentFunds).toBe(9_900);
  });

  it('cancels a reservation once', () => {
    const career = { ...createCareer('P'), activeTableStack: 1_000 };
    const request = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 2_000);
    const cancelled = cancelPendingCashBuyIn(request.career, request.pending.transactionId);
    expect(cancelled.currentFunds).toBe(career.currentFunds);
    expect(cancelPendingCashBuyIn(cancelled, request.pending.transactionId).currentFunds).toBe(career.currentFunds);
  });
});
