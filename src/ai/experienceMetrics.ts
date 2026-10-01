import type { PlayerAction } from '../game/gameState';
import type { PublicTableContext } from './publicContext';
import { classifyPreflopSituation } from './preflopStrategy';

export type MetricPair = { numerator: number; denominator: number };
export type ExperienceMetrics = {
  vpip: MetricPair; pfr: MetricPair; threeBet: MetricPair; fourBet: MetricPair; foldToThreeBet: MetricPair;
  cBet: MetricPair; checkRaise: MetricPair; activeAllIn: MetricPair; callAllIn: MetricPair; preflopAllIn: MetricPair;
  postflopAllIn: MetricPair; pot: MetricPair; sizing: MetricPair; showdown: MetricPair; actions: MetricPair;
  averagePot?: MetricPair; raiseSizing?: MetricPair;
};
export type ExperienceReport = ExperienceMetrics & { metrics: ExperienceMetrics; hands?: number; showdowns?: number; handSamples: Map<string, { vpip: boolean; pfr: boolean }> };
export type ExperienceObservationContext = Pick<PublicTableContext, 'street' | 'toCall' | 'potAmount'> & {
  handId?: string; aiPlayerId?: string; bigBlind?: number; currentBet?: number;
  actionHistory?: PublicTableContext['actionHistory']; players?: PublicTableContext['players']; self?: { id?: string; stack: number };
};

function pair(): MetricPair { return { numerator: 0, denominator: 0 }; }
function metrics(): ExperienceMetrics {
  return { vpip: pair(), pfr: pair(), threeBet: pair(), fourBet: pair(), foldToThreeBet: pair(), cBet: pair(), checkRaise: pair(), activeAllIn: pair(), callAllIn: pair(), preflopAllIn: pair(), postflopAllIn: pair(), pot: pair(), sizing: pair(), averagePot: pair(), raiseSizing: pair(), showdown: pair(), actions: pair() };
}

export function createExperienceReport(): ExperienceReport {
  const values = metrics();
  return { ...values, metrics: values, hands: 0, showdowns: 0, handSamples: new Map() };
}

function aggressive(action: PlayerAction): boolean { return action.kind === 'bet-to' || action.kind === 'raise-to' || action.kind === 'all-in'; }
function voluntary(action: PlayerAction): boolean { return action.kind === 'call' || aggressive(action); }
function allInIsCall(context: ExperienceObservationContext, action: PlayerAction): boolean { return action.kind === 'all-in' && context.toCall > 0 && (context.self?.stack ?? 0) <= context.toCall; }
function preflopAggression(context: ExperienceObservationContext, action: PlayerAction): boolean { return (action.kind === 'bet-to' || action.kind === 'raise-to') || (action.kind === 'all-in' && !allInIsCall(context, action)); }

/** Observe a public decision. Numerators and denominators stay explicit. */
export function recordExperienceAction(report: ExperienceReport, context: ExperienceObservationContext, action: PlayerAction): ExperienceReport {
  const m = report.metrics; m.actions.numerator += 1; m.actions.denominator += 1; m.activeAllIn.denominator += 1;
  if (context.street === 'PRE_FLOP') {
    const handKey = `${context.handId ?? 'current'}:${context.aiPlayerId ?? context.self?.id ?? 'ai'}`;
    let sample = report.handSamples.get(handKey);
    if (!sample) { sample = { vpip: false, pfr: false }; report.handSamples.set(handKey, sample); m.vpip.denominator += 1; m.pfr.denominator += 1; }
    if (voluntary(action) && !sample.vpip) { sample.vpip = true; m.vpip.numerator += 1; }
    if (preflopAggression(context, action) && !sample.pfr) { sample.pfr = true; m.pfr.numerator += 1; }
    if (context.actionHistory && context.players && context.self && context.bigBlind !== undefined && context.currentBet !== undefined && context.aiPlayerId) {
      const situation = classifyPreflopSituation({ actionHistory: context.actionHistory, players: context.players, self: context.self as PublicTableContext['self'], bigBlind: context.bigBlind, currentBet: context.currentBet, aiPlayerId: context.aiPlayerId }).situation;
      if (situation === 'FACING_OPEN') { m.threeBet.denominator += 1; if (preflopAggression(context, action)) m.threeBet.numerator += 1; }
      if (situation === 'FACING_3BET') { m.fourBet.denominator += 1; m.foldToThreeBet.denominator += 1; if (preflopAggression(context, action)) m.fourBet.numerator += 1; if (action.kind === 'fold') m.foldToThreeBet.numerator += 1; }
    }
    m.preflopAllIn.denominator += 1; if (action.kind === 'all-in') m.preflopAllIn.numerator += 1;
  } else { m.postflopAllIn.denominator += 1; if (action.kind === 'all-in') m.postflopAllIn.numerator += 1; }
  if (context.street !== 'PRE_FLOP' && context.actionHistory) {
    const currentStreetActions = context.actionHistory.filter((entry) => entry.street === context.street);
    const lastPreflopAggressor = [...context.actionHistory].reverse().find((entry) => entry.street === 'PRE_FLOP' && (entry.action === 'raise-to' || entry.action === 'bet-to'));
    const ownActedStreet = currentStreetActions.some((entry) => entry.playerId === context.aiPlayerId);
    if (lastPreflopAggressor?.playerId === context.aiPlayerId && !ownActedStreet) { m.cBet.denominator += 1; if (aggressive(action) && !allInIsCall(context, action)) m.cBet.numerator += 1; }
    const ownCheck = currentStreetActions.some((entry) => entry.playerId === context.aiPlayerId && entry.action === 'check');
    const opponentBetAfterCheck = currentStreetActions.some((entry) => entry.playerId !== context.aiPlayerId && (entry.action === 'bet-to' || entry.action === 'raise-to' || entry.action === 'all-in'));
    if (ownCheck && opponentBetAfterCheck && (action.kind === 'raise-to' || action.kind === 'bet-to' || action.kind === 'all-in')) { m.checkRaise.denominator += 1; if (!allInIsCall(context, action)) m.checkRaise.numerator += 1; }
  }
  if (action.kind === 'all-in') m.activeAllIn.numerator += 1;
  if ((action.kind === 'call' || allInIsCall(context, action)) && context.toCall > 0) { m.callAllIn.denominator += 1; if (allInIsCall(context, action) || ((context as { self?: { stack: number } }).self?.stack !== undefined && (context as { self: { stack: number } }).self.stack <= context.toCall)) m.callAllIn.numerator += 1; }
  m.pot.numerator += context.potAmount; m.pot.denominator += 1; if (m.averagePot) { m.averagePot.numerator += context.potAmount; m.averagePot.denominator += 1; }
  if (action.kind === 'bet-to' || action.kind === 'raise-to') { m.sizing.numerator += action.amount; m.sizing.denominator += 1; if (m.raiseSizing) { m.raiseSizing.numerator += action.amount; m.raiseSizing.denominator += 1; } }
  return report;
}

export const observeExperienceAction = recordExperienceAction;
export const createExperienceAccumulator = createExperienceReport;

export function recordExperienceShowdown(report: ExperienceReport): ExperienceReport {
  report.showdowns = (report.showdowns ?? 0) + 1;
  report.metrics.showdown.numerator += 1;
  report.metrics.showdown.denominator += 1;
  return report;
}
