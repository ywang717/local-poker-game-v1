import { describe, expect, it } from 'vitest';
import { runTournamentSimulation } from '../../src/simulation/tournamentSimulation';

describe('complete tournament simulation', () => {
  it('runs every tournament through one champion with conserved chips', () => {
    const report = runTournamentSimulation({ mode: 'STANDARD', tableLevel: 2, tournaments: 2, seed: 0x20261008 });
    expect(report.tournamentsCompleted).toBe(2);
    expect(report.champions).toHaveLength(2);
    expect(report.deadlocks).toBe(0);
    expect(report.illegalActions).toBe(0);
    expect(report.chipConservationFailures).toBe(0);
    expect(report.rebuyCount).toBe(0);
    expect(report.digest).toBe(runTournamentSimulation({ mode: 'STANDARD', tableLevel: 2, tournaments: 2, seed: 0x20261008 }).digest);
    expect(report.runs.every((run) => run.playersRemaining === 1 && run.handsCompleted > 0)).toBe(true);
  }, 20_000);

  it('supports short-deck and level-specific fixed difficulty', () => {
    const report = runTournamentSimulation({ mode: 'SHORT_DECK', tableLevel: 5, tournaments: 1, seed: 0x20261009, difficulty: 5 });
    expect(report.mode).toBe('SHORT_DECK');
    expect(report.tableLevel).toBe(5);
    expect(report.runs[0].difficulty).toBe(5);
    expect(report.runs[0].championId).toBeTruthy();
  }, 20_000);
});
