import { describe, expect, it } from 'vitest';
import { runAIExperienceSimulation } from '../../src/simulation/aiExperienceSimulation';
import { runContinuousTableSimulation } from '../../src/simulation/runSimulation';
import { runTournamentSimulation } from '../../src/simulation/tournamentSimulation';

const healthy = (report: { handsCompleted?: number; deadlocks: number; illegalActions: number; negativeChipStates: number; unclaimedPots: number; chipConservationFailures: number }) => {
  expect(report.deadlocks).toBe(0);
  expect(report.illegalActions).toBe(0);
  expect(report.negativeChipStates).toBe(0);
  expect(report.unclaimedPots).toBe(0);
  expect(report.chipConservationFailures).toBe(0);
};

describe('V2.1 release smoke', () => {
  it('runs the 800-hand AI matrix for LV2-LV5 in both modes', () => {
    let completed = 0;
    let folds = 0;
    for (const mode of ['STANDARD', 'SHORT_DECK'] as const) {
      for (const difficulty of [2, 3, 4, 5] as const) {
        const report = runAIExperienceSimulation({ mode, tableSize: 6, hands: 100, seed: 0x2100_0000 + difficulty + (mode === 'SHORT_DECK' ? 100 : 0), difficulty });
        expect(report.handsCompleted).toBe(100);
        healthy(report);
        completed += report.handsCompleted;
        folds += report.foldCount;
      }
    }
    expect(completed).toBe(800);
    expect(folds).toBeGreaterThan(0);
  }, 120_000);

  it('runs the 600-hand two/six/nine-player rules smoke matrix', () => {
    let completed = 0;
    for (const mode of ['STANDARD', 'SHORT_DECK'] as const) {
      for (const tableSize of [2, 6, 9] as const) {
        const report = runContinuousTableSimulation({ mode, tableSize, hands: 100, seed: 0x2160_0000 + tableSize + (mode === 'SHORT_DECK' ? 100 : 0) });
        expect(report.handsCompleted).toBe(100);
        healthy(report);
        completed += report.handsCompleted;
      }
    }
    expect(completed).toBe(600);
  }, 120_000);

  it('runs 20 complete Mini tournaments without rebuy or duplicate champions', () => {
    let completed = 0;
    for (const mode of ['STANDARD', 'SHORT_DECK'] as const) {
      const report = runTournamentSimulation({ mode, tableLevel: 2, tournaments: 10, seed: 0x2120_0000 + (mode === 'SHORT_DECK' ? 100 : 0), difficulty: 2 });
      expect(report.tournamentsCompleted).toBe(10);
      expect(report.runs).toHaveLength(10);
      healthy(report);
      expect(report.rebuyCount).toBe(0);
      for (const run of report.runs) {
        expect(run.playersRemaining).toBe(1);
        expect(run.championId).toBeTruthy();
      }
      completed += report.tournamentsCompleted;
    }
    expect(completed).toBe(20);
  }, 120_000);
});
