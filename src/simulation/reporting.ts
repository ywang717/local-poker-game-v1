import type { MetricPair } from './aiExperienceSimulation';

type ReportValue = unknown;

function normalize(value: ReportValue): ReportValue {
  if (value instanceof Map) return Object.fromEntries([...value.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))).map(([key, entry]) => [key, normalize(entry)]));
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, ReportValue>)
      .filter(([key]) => key !== 'handSamples')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalize(entry)]));
  }
  return value;
}

/** Stable JSON used by checked-in reports and digest comparisons. */
export function writeReport(report: ReportValue): string {
  return JSON.stringify(normalize(report), null, 2) + '\n';
}

function metricEntries(report: ReportValue): Array<[string, MetricPair]> {
  if (!report || typeof report !== 'object') return [];
  const source = (report as { metrics?: unknown }).metrics;
  if (!source || typeof source !== 'object') return [];
  return Object.entries(source as Record<string, unknown>)
    .filter((entry): entry is [string, MetricPair] => {
      const value = entry[1];
      return Boolean(value && typeof value === 'object' && 'numerator' in value && 'denominator' in value);
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

/** CSV rows retain both numerator and denominator so rates can be recomputed. */
export function reportToCsv(report: ReportValue): string {
  const rows = ['metric,numerator,denominator'];
  for (const [name, pair] of metricEntries(report)) rows.push(`${name},${pair.numerator},${pair.denominator}`);
  return rows.join('\n') + '\n';
}

export const writeReportCsv = reportToCsv;
