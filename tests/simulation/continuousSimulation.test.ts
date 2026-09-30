import { describe, expect, it } from 'vitest';
import { runSimulation } from '../../src/simulation/runSimulation';

describe('continuous seeded simulation', () => {
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
