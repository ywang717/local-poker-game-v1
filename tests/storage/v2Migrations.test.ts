import { describe, expect, it } from 'vitest';
import { migrateHandSnapshot, migrateSave } from '../../src/storage/migrations';

describe('v2 migrations', () => {
  it('adds empty v2 career fields to v1 data', () => {
    const migrated = migrateSave({ saveVersion: 1, career: { nickname: '旧玩家', currentFunds: 1000 } });
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.career.financialTransactions).toEqual([]);
    expect(migrated.career.pendingCashBuyIns).toEqual([]);
    expect(migrated.career.tournamentStatistics.tournamentsPlayed).toBe(0);
  });
  it('defaults old hand snapshots to cash metadata', () => {
    const migrated = migrateHandSnapshot({ saveVersion: 1, savedAt: '2026-01-01T00:00:00Z', state: { mode: 'STANDARD', bigBlind: 50, deck: [] } });
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.state.matchType).toBe('CASH');
    expect(migrated.state.tableLevel).toBe(1);
    expect(migrated.state.session?.sessionId).toMatch(/^legacy-session/);
  });
});
