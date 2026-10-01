import { describe, expect, it } from 'vitest';
import { runRulesRegressionMatrix } from '../../src/simulation/runSimulation';
import { runAIExperienceSimulation } from '../../src/simulation/aiExperienceSimulation';
import { writeReport, reportToCsv } from '../../src/simulation/reporting';

describe('simulation report artifacts', () => {
  it('preserves the 14-cell rules matrix dimensions', () => {
    const reports = runRulesRegressionMatrix({ handsPerCell: 2, seed: 0x20261008 });
    expect(reports).toHaveLength(14);
    expect(reports.reduce((sum, report) => sum + report.handsCompleted, 0)).toBe(28);
  });

  it('serializes deterministic numerator and denominator rows', () => {
    const report = runAIExperienceSimulation({ mode: 'STANDARD', tableSize: 3, hands: 10, seed: 0x20261008, difficulty: 3 });
    const first = writeReport(report);
    const second = writeReport(report);
    expect(first).toBe(second);
    const parsed = JSON.parse(first) as { metrics: { vpip: { numerator: number; denominator: number } } };
    expect(parsed.metrics.vpip.denominator).toBeGreaterThan(0);
    const csv = reportToCsv(report);
    expect(csv).toContain('metric,numerator,denominator');
    expect(csv).toContain('vpip,');
  });
});
