import { describe, expect, it } from 'vitest';
import { createExperienceReport, recordExperienceAction } from '../../src/ai/experienceMetrics';

describe('V2 experience metrics', () => {
  it('stores numerator and denominator pairs', () => {
    const report = createExperienceReport();
    recordExperienceAction(report, { street: 'PRE_FLOP', toCall: 10, potAmount: 30 }, { kind: 'call' });
    expect(report.metrics.vpip.denominator).toBe(1);
    expect(report.metrics.vpip.numerator).toBe(1);
    expect(report.metrics.actions).toEqual({ numerator: 1, denominator: 1 });
  });
});
