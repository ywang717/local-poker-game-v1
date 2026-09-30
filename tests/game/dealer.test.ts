import { describe, expect, it } from 'vitest';
import { getActionOrder, nextDealerSeat } from '../../src/game/dealer';

describe('dealer and action order', () => {
  it('uses the dealer as SB and first pre-flop actor heads-up', () => {
    expect(getActionOrder(2, 0, 'PRE_FLOP')).toEqual([0, 1]);
    expect(getActionOrder(2, 0, 'FLOP')).toEqual([1, 0]);
  });

  it('starts pre-flop after the big blind on larger tables', () => {
    expect(getActionOrder(6, 0, 'PRE_FLOP')).toEqual([3, 4, 5, 0, 1, 2]);
    expect(getActionOrder(9, 8, 'FLOP')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('rotates to the next occupied seat', () => {
    expect(nextDealerSeat(6, 4, new Set([0, 2, 5]))).toBe(5);
    expect(nextDealerSeat(6, 5, new Set([0, 2, 5]))).toBe(0);
  });
});
