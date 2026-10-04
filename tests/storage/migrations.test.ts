import { describe, expect, it } from 'vitest';
import { migrateSave } from '../../src/storage/migrations';

describe('save migrations', () => {
  it('migrates a legacy funds-shaped save to the current career schema', () => {
    const migrated = migrateSave({
      saveVersion: 0,
      nickname: '旧玩家',
      funds: 12_500,
      highestFunds: 18_000,
      bankruptcies: 2,
      unlockedLevels: [1, 2],
      handHistory: [],
    });
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.career.nickname).toBe('旧玩家');
    expect(migrated.career.currentFunds).toBe(12_500);
    expect(migrated.career.peakFunds).toBe(18_000);
    expect(migrated.career.bankruptcyCount).toBe(2);
    expect(migrated.career.unlockedLevels).toEqual([1, 2]);
  });

  it('defaults legacy hand records without pot results to an empty list', () => {
    const migrated = migrateSave({ saveVersion: 0, nickname: '旧玩家', handHistory: [{ handId: 'h1' }] });
    expect(migrated.career.handHistory[0].potResults).toEqual([]);
  });

  it('migrates a v1 career record without mutating it', () => {
    const input = { saveVersion: 1, career: { nickname: '当前玩家', currentFunds: 10_000 } };
    const migrated = migrateSave(input);
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.career.financialTransactions).toEqual([]);
    expect(input).toEqual({ saveVersion: 1, career: { nickname: '当前玩家', currentFunds: 10_000 } });
  });

  it('backfills VPIP counters for a career saved before the 入池率 field existed', () => {
    const migrated = migrateSave({ saveVersion: 2, career: {
      nickname: '旧统计',
      currentFunds: 10_000,
      statistics: { overall: { totalHands: 3 } },
    } });
    expect(migrated.career.statistics.overall.totalHands).toBe(3);
    expect(migrated.career.statistics.overall.vpipHands).toBe(0);
  });

  it('rejects unsupported or malformed saves', () => {
    expect(() => migrateSave({ saveVersion: 99 })).toThrow(/unsupported/i);
    expect(() => migrateSave(null)).toThrow(/invalid/i);
  });
});
