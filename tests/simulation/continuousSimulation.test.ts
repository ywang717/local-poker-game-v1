import { describe, expect, it } from 'vitest';
import { runSimulation } from '../../src/simulation/runSimulation';

describe('continuous seeded simulation', () => {
  const modes = ['STANDARD', 'SHORT_DECK'] as const;
  const tableSizes = [2, 3, 4, 5, 6, 8, 9] as const;

  it('completes the full 14,000-hand release matrix with real fold and action paths', () => {
    let totalHands = 0;
    let totalFolds = 0;
    let totalCalls = 0;
    let totalRaises = 0;
    let totalAllIns = 0;
    let totalShowdowns = 0;
    let totalWonWithoutShowdown = 0;
    for (const mode of modes) {
      for (const tableSize of tableSizes) {
        const report = runSimulation({ mode, tableSize, hands: 1_000, seed: 0x1400_0000 + tableSize + (mode === 'SHORT_DECK' ? 100 : 0) });
        expect(report.handsCompleted).toBe(1_000);
        expect(report.deadlocks).toBe(0);
        expect(report.illegalActions).toBe(0);
        expect(report.negativeChipStates).toBe(0);
        expect(report.unclaimedPots).toBe(0);
        expect(report.refundErrors).toBe(0);
        expect(report.chipConservationFailures).toBe(0);
        totalHands += report.handsCompleted;
        totalFolds += report.foldCount;
        totalCalls += report.callCount;
        totalRaises += report.raiseCount;
        totalAllIns += report.allInCount;
        totalShowdowns += report.showdownHands;
        totalWonWithoutShowdown += report.wonWithoutShowdown;
      }
    }
    expect(totalHands).toBe(14_000);
    expect(totalFolds).toBeGreaterThan(0);
    expect(totalCalls).toBeGreaterThan(0);
    expect(totalRaises).toBeGreaterThan(0);
    expect(totalAllIns).toBeGreaterThan(0);
    expect(totalShowdowns + totalWonWithoutShowdown).toBe(totalHands);
    expect(totalShowdowns / totalHands).toBeLessThan(1);
  }, 60_000);

  it('passes ten reproducible multi-seed smoke runs', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const options = { mode: seed % 2 === 0 ? 'SHORT_DECK' as const : 'STANDARD' as const, tableSize: ([2, 3, 6, 9] as const)[seed % 4], hands: 100, seed: 0x5000 + seed };
      const report = runSimulation(options);
      expect(report.handsCompleted).toBe(100);
      expect(report.deadlocks + report.illegalActions + report.negativeChipStates + report.unclaimedPots + report.refundErrors + report.chipConservationFailures).toBe(0);
    }
  }, 30_000);

  it('completes 1,000 standard six-player hands with conserved chips', () => {
    const report = runSimulation({ mode: 'STANDARD', hands: 1_000, seed: 0x12345678, tableSize: 6 });
    expect(report.handsCompleted).toBe(1_000);
    expect(report.deadlocks).toBe(0);
    expect(report.illegalActions).toBe(0);
    expect(report.unclaimedPots).toBe(0);
    expect(report.negativeChipStates).toBe(0);
    expect(report.chipConservationFailures).toBe(0);
  }, 20_000);

  it('completes 1,000 short-deck six-player hands and is deterministic for the same seed', () => {
    const options = { mode: 'SHORT_DECK' as const, hands: 1_000, seed: 0xabcdef01, tableSize: 6 as const };
    const first = runSimulation(options);
    const second = runSimulation(options);
    expect(first.handsCompleted).toBe(1_000);
    expect(first.deadlocks).toBe(0);
    expect(first.unclaimedPots).toBe(0);
    expect(first.digest).toBe(second.digest);
  }, 20_000);
});
