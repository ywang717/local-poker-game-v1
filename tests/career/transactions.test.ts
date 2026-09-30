import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { refundPendingCashBuyIn, reserveFunds } from '../../src/career/transactions';

describe('v2 financial transactions', () => {
  it('reserves safe integer funds and duplicate calls are idempotent', () => {
    const career = createCareer('玩家');
    const first = reserveFunds(career, { transactionId: 't1', sessionId: 's1', requestedAmount: 1000 });
    const second = reserveFunds(first.career, { transactionId: 't1', sessionId: 's1', requestedAmount: 1000 });
    expect(second.duplicate).toBe(true);
    expect(second.career.currentFunds).toBe(9000);
  });
  it('rejects invalid and insufficient amounts', () => {
    const career = createCareer('玩家');
    expect(() => reserveFunds(career, { transactionId: 't1', sessionId: 's1', requestedAmount: 0 })).toThrow(/safe integer/i);
    expect(() => reserveFunds(career, { transactionId: 't1', sessionId: 's1', requestedAmount: 10001 })).toThrow(/insufficient/i);
  });
  it('refunds a pending reservation exactly once', () => {
    const career = createCareer('玩家');
    const reserved = reserveFunds(career, { transactionId: 't1', sessionId: 's1', requestedAmount: 1000 });
    const refunded = refundPendingCashBuyIn(reserved.career, 't1');
    expect(refunded.currentFunds).toBe(10000);
    expect(refundPendingCashBuyIn(refunded, 't1').currentFunds).toBe(10000);
  });
  it('rejects malformed persisted reservation amounts before arithmetic', () => {
    const career = createCareer('玩家');
    career.pendingCashBuyIns = [{ transactionId: 'bad', sessionId: 's1', requestedAmount: 1, reservedAmount: Number.NaN, status: 'PENDING' }];
    expect(() => refundPendingCashBuyIn(career, 'bad')).toThrow(/invalid pending/i);
  });
});
