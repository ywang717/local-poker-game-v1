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
    expect(migrated.saveVersion).toBe(1);
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

  it('accepts current version data without mutating it', () => {
    const input = { saveVersion: 1, career: { nickname: '当前玩家', currentFunds: 10_000 } };
    expect(migrateSave(input)).toEqual(input);
    expect(input).toEqual({ saveVersion: 1, career: { nickname: '当前玩家', currentFunds: 10_000 } });
  });

  it('rejects unsupported or malformed saves', () => {
    expect(() => migrateSave({ saveVersion: 99 })).toThrow(/unsupported/i);
    expect(() => migrateSave(null)).toThrow(/invalid/i);
  });
});
