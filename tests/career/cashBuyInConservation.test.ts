import { describe, expect, it } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { applyPendingCashBuyIn, requestCashBuyIn } from '../../src/career/cashBuyInService';
import { cashSession } from '../../src/match/session';

describe('cash buy-in conservation', () => {
  it('preserves account plus table stack across a capped settlement', () => {
    const career = { ...createCareer('P'), activeTableStack: 1_000 };
    const before = career.currentFunds + career.activeTableStack;
    const request = requestCashBuyIn(career, cashSession('STANDARD', 1, 's1'), 5_000);
    const result = applyPendingCashBuyIn(request.career, request.pending, 4_900);
    expect(result.career.currentFunds + 5_000).toBe(before + 3_900);
  });
});
