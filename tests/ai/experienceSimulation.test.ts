import { describe, expect, it } from 'vitest';
import { runAIExperienceSimulation } from '../../src/simulation/aiExperienceSimulation';

describe('AI experience baseline harness', () => {
  it('completes seeded hands and exposes deterministic numerator/denominator metrics', () => {
    const options = { mode: 'STANDARD' as const, tableSize: 3 as const, hands: 25, seed: 0x20261001, difficulty: 3 as const };
    const first = runAIExperienceSimulation(options);
    const second = runAIExperienceSimulation(options);
    expect(first.handsCompleted).toBe(25);
    expect(first.digest).toBe(second.digest);
    expect(first.metrics.vpip.denominator).toBeGreaterThan(0);
    expect(first.metrics.actions.denominator).toBe(first.actions);
  });
});
