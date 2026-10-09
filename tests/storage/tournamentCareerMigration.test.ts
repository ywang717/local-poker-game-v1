import { beforeEach, describe, expect, it } from 'vitest';
import { createCareer, recordHand, recordTournamentFinish, enterTournament } from '../../src/career/careerService';
import { loadCareer, saveCareer, putRawRecord, resetStorageForTests } from '../../src/storage/saveSystem';
import { readRecord } from '../../src/storage/database';
import { tournamentSummary } from '../helpers/tournamentSummary';
import { migrateSave } from '../../src/storage/migrations';

beforeEach(resetStorageForTests);
function legacyRecord() {
  const legacy = structuredClone(createCareer('旧生涯')) as any;
  legacy.currentFunds = 23000;
  legacy.tournamentStatistics = { tournamentsPlayed: 9, tournamentsWon: 2, totalEntryFees: 45000, totalRewards: 100000, totalNet: 55000, bestFinish: 1 };
  legacy.statistics.byStartingHand.STANDARD.AA = { hands: 10, wins: 3, splits: 1, losses: 6 };
  delete legacy.tournamentHistory;
  return { saveVersion: 2, career: legacy };
}

describe('tournament career migration and persistence', () => {
  it('backfills canonical local tournament history once, preserves old totals and cash counters, and saves the migration marker', async () => {
    const legacy = legacyRecord();
    legacy.career.handHistory = [tournamentSummary('stale-embedded')];
    await putRawRecord('career', 'current', legacy);
    const win = tournamentSummary('recovered-win');
    const split = tournamentSummary('recovered-split', { result: 'SPLIT', mode: 'SHORT_DECK' });
    await putRawRecord('handHistory', 'current', { entries: [win, win, split, tournamentSummary('cash', { matchType: 'CASH' }), tournamentSummary('unmarked', { matchType: undefined })] });
    const first = (await loadCareer()).career!;
    expect(first.currentFunds).toBe(23000);
    expect(first.tournamentStatistics).toMatchObject({ tournamentsPlayed: 9, tournamentsWon: 2, totalNet: 55000, topThreeFinishes: 0, startingHandMigrationVersion: 1 });
    expect(first.tournamentStatistics.byStartingHand.STANDARD.AA).toEqual({ hands: 1, wins: 1, splits: 0, losses: 0 });
    expect(first.tournamentStatistics.byStartingHand.SHORT_DECK.AA).toEqual({ hands: 1, wins: 0, splits: 1, losses: 0 });
    expect(first.statistics.byStartingHand.STANDARD.AA.hands).toBe(10);
    expect(first.tournamentHistory).toEqual([]);
    expect(first.tournamentStatistics.trackingStartedAt).toMatch(/^\d{4}-/);
    expect((await readRecord<any>('career', 'current')).career.tournamentStatistics.startingHandMigrationVersion).toBe(1);
    expect((await loadCareer()).career).toEqual(first);
    expect(recordHand(first, win).tournamentStatistics.byStartingHand.STANDARD.AA.hands).toBe(1);
  });

  it('uses backup history when recovering a corrupt current save', async () => {
    await putRawRecord('career', 'current', { saveVersion: 99 });
    await putRawRecord('career', 'backup', legacyRecord());
    await putRawRecord('handHistory', 'current', { entries: [tournamentSummary('wrong')] });
    await putRawRecord('handHistory', 'backup', { entries: [tournamentSummary('right', { result: 'LOSS' })] });
    const recovered = await loadCareer();
    expect(recovered.status).toBe('recovered');
    expect(recovered.career?.tournamentStatistics.byStartingHand.STANDARD.AA).toEqual({ hands: 1, wins: 0, splits: 0, losses: 1 });
    expect((await loadCareer()).career).toEqual(recovered.career);
  });

  it('persists new counters and match records through reload without a second payout or hand count', async () => {
    const entered = enterTournament(createCareer('玩家'), 'STANDARD', 1, 'reload');
    const hand = tournamentSummary('reload-h');
    const terminal = { ...entered.tournament, players: [entered.tournament.players[0]], championId: 'human', rankings: [{ playerId: 'human', rank: 1 }] };
    const recorded = recordTournamentFinish(recordHand(entered.career, hand), terminal);
    await saveCareer(recorded);
    const loaded = (await loadCareer()).career!;
    expect(loaded).toEqual(recorded);
    expect(recordTournamentFinish(recordHand(loaded, hand), terminal)).toEqual(recorded);
  });

  it('normalizes legacy feature fields without declaring history backfill complete too early', () => {
    const normalized = migrateSave(legacyRecord()).career;
    expect(normalized.tournamentStatistics.startingHandMigrationVersion).toBe(0);
    expect(normalized.tournamentHistory).toEqual([]);
    const current = createCareer('新生涯');
    expect(migrateSave({ saveVersion: 2, career: current }).career).toEqual(current);
  });
});

it('keeps a valid career readable if saving the one-time migration fails, and retries cleanly on reload', async () => {
  await putRawRecord('career', 'current', legacyRecord());
  await putRawRecord('handHistory', 'current', { entries: [tournamentSummary('write-failure')] });
  const database = await import('../../src/storage/database');
  const { vi } = await import('vitest');
  const write = vi.spyOn(database, 'writeRecords').mockRejectedValueOnce(new Error('QuotaExceededError'));
  try {
    const loaded = await loadCareer();
    expect(loaded.status).toBe('loaded');
    expect(loaded.career?.currentFunds).toBe(23000);
    expect(loaded.career?.tournamentStatistics.byStartingHand.STANDARD.AA.hands).toBe(1);
    expect(loaded.error).toContain('保存');
    expect((await readRecord<any>('career', 'current')).career.tournamentStatistics.startingHandMigrationVersion).toBeUndefined();
    const retried = await loadCareer();
    expect(retried.career?.tournamentStatistics.byStartingHand.STANDARD.AA.hands).toBe(1);
    expect(retried.error).toBeUndefined();
  } finally { write.mockRestore(); }
});
