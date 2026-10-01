import { describe, expect, it } from 'vitest';
import { applyBankruptcyProtection, buyIn, createCareer, getTableAvailability, leaveTable } from '../../src/career/careerService';
import { TABLE_LEVELS } from '../../src/career/tableLevels';

describe('career economy and table unlocks', () => {
  it('creates the default career and five exact table levels', () => {
    const career = createCareer('小明');
    expect(career.nickname).toBe('小明');
    expect(career.currentFunds).toBe(10_000);
    expect(career.peakFunds).toBe(10_000);
    expect(career.defaultMode).toBe('STANDARD');
    expect(career.defaultTableSize).toBe(6);
    expect(career.unlockedLevels).toEqual([1]);
    expect(TABLE_LEVELS.map((level) => [level.id, level.smallBlind, level.bigBlind, level.buyIn, level.unlockAt])).toEqual([
      [1, 25, 50, 5_000, 0],
      [2, 50, 100, 10_000, 15_000],
      [3, 100, 200, 20_000, 40_000],
      [4, 250, 500, 50_000, 100_000],
      [5, 500, 1_000, 100_000, 250_000],
    ]);
  });

  it('transfers a buy-in out of the career account and returns the exact table stack', () => {
    const career = createCareer('玩家');
    const entered = buyIn(career, 1, 'cash-session-1');
    expect(entered.tableStack).toBe(5_000);
    expect(entered.career.currentFunds).toBe(5_000);
    expect(entered.career.financialTransactions).toEqual([
      expect.objectContaining({ transactionId: 'cash-session-1:initial-buy-in', sessionId: 'cash-session-1', kind: 'INITIAL_BUY_IN', amount: 5_000, status: 'APPLIED' }),
    ]);
    const left = leaveTable(entered.career, 2_740, 'cash-session-1');
    expect(left.currentFunds).toBe(7_740);
    expect(left.activeTableStack).toBeNull();
    expect(left.financialTransactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ transactionId: 'cash-session-1:table-cash-out', sessionId: 'cash-session-1', kind: 'TABLE_CASH_OUT', amount: 2_740, status: 'APPLIED' }),
    ]));
    const retried = leaveTable({ ...left, activeTableStack: 2_740, activeTableSessionId: 'cash-session-1' }, 2_740, 'cash-session-1');
    expect(retried.currentFunds).toBe(left.currentFunds);
    expect(retried.financialTransactions.filter((entry) => entry.kind === 'TABLE_CASH_OUT')).toHaveLength(1);
    expect(leaveTable(left, 0).currentFunds).toBe(7_740);
    expect(() => leaveTable(left, 1)).toThrow(/not seated/i);
  });

  it('unlocks levels permanently from historical peak funds', () => {
    const career = createCareer('玩家');
    const rich = leaveTable({ ...career, currentFunds: 100_000, peakFunds: 10_000 }, 0);
    expect(rich.unlockedLevels).toEqual([1, 2, 3, 4]);
    const poor = { ...rich, currentFunds: 70_000 };
    expect(getTableAvailability(poor).find((entry) => entry.level.id === 4)).toMatchObject({ unlocked: true, affordable: true });
    expect(getTableAvailability({ ...poor, currentFunds: 40_000 }).find((entry) => entry.level.id === 4)).toMatchObject({ unlocked: true, affordable: false });
  });

  it('protects a bankrupt career with a 5,000 refill without deleting the save', () => {
    const career = createCareer('玩家');
    const low = { ...career, currentFunds: 1_200, activeTableStack: 0 };
    const protectedCareer = applyBankruptcyProtection(low);
    expect(protectedCareer.currentFunds).toBe(5_000);
    expect(protectedCareer.bankruptcyCount).toBe(1);
    expect(protectedCareer.nickname).toBe('玩家');
    expect(applyBankruptcyProtection(protectedCareer)).toEqual(protectedCareer);
  });
});
