import { classifyPreflopSituation } from '../ai/preflopStrategy';
import type { AIDifficulty } from '../ai/difficulty';
import type { PlayerAction } from '../game/gameState';
import type { GameMode } from '../game/rules';
import { runContinuousTableSimulation, type SimulationReport } from './runSimulation';
import type { TableSize } from '../game/gameState';
import type { PublicTableContext } from '../ai/publicContext';

export type MetricPair = { numerator: number; denominator: number };
export type AIExperienceMetrics = {
  vpip: MetricPair; pfr: MetricPair; threeBet: MetricPair; fourBet: MetricPair;
  foldToThreeBet: MetricPair; cBet: MetricPair; checkRaise: MetricPair;
  activeAllIn: MetricPair; callAllIn: MetricPair; preflopAllIn: MetricPair; postflopAllIn: MetricPair;
  averagePot: MetricPair; raiseSizing: MetricPair; showdown: MetricPair;
  showdownHands: MetricPair; wonWithoutShowdown: MetricPair; actions: MetricPair;
};

export type AIExperienceOptions = { mode: GameMode; tableSize: TableSize; hands: number; seed: number; difficulty: AIDifficulty };
export type AIExperienceReport = SimulationReport & { difficulty: AIDifficulty; metrics: AIExperienceMetrics };
export type ExperienceAccumulator = {
  metrics: AIExperienceMetrics;
  handSamples: Map<string, Map<string, { vpip: boolean; pfr: boolean }> >;
};

function pair(): MetricPair { return { numerator: 0, denominator: 0 }; }
function isFullRaiseAction(context: PublicTableContext, action: PlayerAction): boolean {
  if (action.kind === 'bet-to' || action.kind === 'raise-to') return true;
  if (action.kind !== 'all-in') return false;
  const target = context.self.streetContribution + context.self.stack;
  const increase = target - context.currentBet;
  return target > context.currentBet && (context.currentBet === 0 || increase >= context.lastFullRaise);
}

function isVoluntary(action: PlayerAction): boolean {
  return action.kind === 'call' || action.kind === 'bet-to' || action.kind === 'raise-to' || action.kind === 'all-in';
}

export function createExperienceAccumulator(): ExperienceAccumulator {
  return {
    metrics: {
      vpip: pair(), pfr: pair(), threeBet: pair(), fourBet: pair(), foldToThreeBet: pair(), cBet: pair(), checkRaise: pair(),
      activeAllIn: pair(), callAllIn: pair(), preflopAllIn: pair(), postflopAllIn: pair(), averagePot: pair(), raiseSizing: pair(), showdown: pair(), showdownHands: pair(), wonWithoutShowdown: pair(), actions: pair(),
    },
    handSamples: new Map(),
  };
}

/** Record one action against the public context immediately before that action. */
export function observeExperienceAction(accumulator: ExperienceAccumulator, context: PublicTableContext, action: PlayerAction): void {
  const metrics = accumulator.metrics;
  metrics.actions.denominator += 1;
  metrics.actions.numerator += 1;
  metrics.activeAllIn.denominator += 1;
  if (context.street === 'PRE_FLOP') {
    const handKey = `${context.handId ?? 'current'}:${context.self.id}`;
    let hand = accumulator.handSamples.get(handKey);
    if (!hand) {
      hand = new Map();
      accumulator.handSamples.set(handKey, hand);
    }
    let sample = hand.get(context.self.id);
    if (!sample) {
      sample = { vpip: false, pfr: false };
      hand.set(context.self.id, sample);
      metrics.vpip.denominator += 1;
      metrics.pfr.denominator += 1;
    }
    const aggressive = isFullRaiseAction(context, action);
    if (isVoluntary(action) && !sample.vpip) { sample.vpip = true; metrics.vpip.numerator += 1; }
    if (aggressive && !sample.pfr) { sample.pfr = true; metrics.pfr.numerator += 1; }
    const situation = classifyPreflopSituation(context).situation;
    if (situation === 'FACING_OPEN') { metrics.threeBet.denominator += 1; if (aggressive) metrics.threeBet.numerator += 1; }
    if (situation === 'FACING_3BET') {
      metrics.fourBet.denominator += 1;
      metrics.foldToThreeBet.denominator += 1;
      if (aggressive) metrics.fourBet.numerator += 1;
      if (action.kind === 'fold') metrics.foldToThreeBet.numerator += 1;
    }
    metrics.preflopAllIn.denominator += 1;
    if (action.kind === 'all-in') metrics.preflopAllIn.numerator += 1;
  } else {
    const streetActions = context.actionHistory.filter((entry) => entry.street === context.street);
    const preflopAggressor = [...context.actionHistory].reverse().find((entry) => entry.street === 'PRE_FLOP' && (entry.action === 'bet-to' || entry.action === 'raise-to'));
    const actedThisStreet = streetActions.some((entry) => entry.playerId === context.aiPlayerId);
    if (preflopAggressor?.playerId === context.aiPlayerId && !actedThisStreet) {
      metrics.cBet.denominator += 1;
      if (action.kind === 'bet-to' || action.kind === 'raise-to' || isFullRaiseAction(context, action)) metrics.cBet.numerator += 1;
    }
    const checked = streetActions.findIndex((entry) => entry.playerId === context.aiPlayerId && entry.action === 'check');
    const betAfterCheck = streetActions.findIndex((entry, index) => index > checked && entry.playerId !== context.aiPlayerId && (entry.action === 'bet-to' || entry.action === 'raise-to' || entry.action === 'all-in'));
    const responded = streetActions.some((entry, index) => index > betAfterCheck && entry.playerId === context.aiPlayerId);
    if (checked >= 0 && betAfterCheck >= 0 && !responded) {
      metrics.checkRaise.denominator += 1;
      if (action.kind === 'bet-to' || action.kind === 'raise-to' || isFullRaiseAction(context, action)) metrics.checkRaise.numerator += 1;
    }
    metrics.postflopAllIn.denominator += 1;
    if (action.kind === 'all-in') metrics.postflopAllIn.numerator += 1;
  }
  if (action.kind === 'all-in') metrics.activeAllIn.numerator += 1;
  if (action.kind === 'call' && context.toCall > 0) {
    metrics.callAllIn.denominator += 1;
    if (context.self.stack <= context.toCall) metrics.callAllIn.numerator += 1;
  }
  metrics.averagePot.numerator += context.potAmount;
  metrics.averagePot.denominator += 1;
  if (action.kind === 'bet-to' || action.kind === 'raise-to') {
    metrics.raiseSizing.numerator += action.amount;
    metrics.raiseSizing.denominator += 1;
  }
}

export function runAIExperienceSimulation(options: AIExperienceOptions): AIExperienceReport {
  const accumulator = createExperienceAccumulator();
  const report = runContinuousTableSimulation({
    ...options,
    dealSeed: (options.seed ^ 0x9e3779b9) >>> 0,
    decisionSeed: (options.seed ^ 0x243f6a88) >>> 0,
    onAction: (context, action) => observeExperienceAction(accumulator, context, action),
  });
  const metrics = accumulator.metrics;
  metrics.showdown = { numerator: report.showdowns, denominator: report.handsCompleted };
  metrics.showdownHands = { numerator: report.showdownHands, denominator: report.handsCompleted };
  metrics.wonWithoutShowdown = { numerator: report.wonWithoutShowdown, denominator: report.handsCompleted };
  return { ...report, difficulty: options.difficulty, metrics };
}

export const runExperienceSimulation = runAIExperienceSimulation;
