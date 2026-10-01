import { describe, expect, it } from 'vitest';
import { createExperienceReport, recordExperienceAction, recordExperienceHand } from '../../src/ai/experienceMetrics';

describe('V2 experience metrics', () => {
  it('stores numerator and denominator pairs', () => {
    const report = createExperienceReport();
    recordExperienceAction(report, { street: 'PRE_FLOP', toCall: 10, potAmount: 30 }, { kind: 'call' });
    expect(report.metrics.vpip.denominator).toBe(1);
    expect(report.metrics.vpip.numerator).toBe(1);
    expect(report.metrics.actions).toEqual({ numerator: 1, denominator: 1 });
  });

  it('counts VPIP and PFR once per player-hand, not once per action', () => {
    const report = createExperienceReport();
    const context = { handId: 'h1', aiPlayerId: 'ai', street: 'PRE_FLOP' as const, toCall: 0, potAmount: 20, self: { stack: 100 } };
    recordExperienceAction(report, context, { kind: 'call' });
    recordExperienceAction(report, context, { kind: 'check' });
    expect(report.vpip).toEqual({ numerator: 1, denominator: 1 });
    expect(report.pfr).toEqual({ numerator: 0, denominator: 1 });
  });

  it('does not count a called all-in as PFR', () => {
    const report = createExperienceReport();
    recordExperienceAction(report, { handId: 'h2', aiPlayerId: 'ai', street: 'PRE_FLOP', toCall: 50, potAmount: 100, self: { stack: 50 } }, { kind: 'all-in' });
    expect(report.pfr.numerator).toBe(0);
    expect(report.callAllIn.numerator).toBe(1);
  });

  it('does not count a short non-reopening all-in as PFR', () => {
    const report = createExperienceReport();
    recordExperienceAction(report, { handId: 'h3', aiPlayerId: 'ai', street: 'PRE_FLOP', toCall: 10, currentBet: 30, lastFullRaise: 20, potAmount: 100, self: { stack: 20, streetContribution: 20 } }, { kind: 'all-in' });
    expect(report.pfr.numerator).toBe(0);
    expect(report.threeBet.numerator).toBe(0);
  });

  it('counts a check-raise opportunity when the response is a call', () => {
    const report = createExperienceReport();
    const context = { handId: 'h4', aiPlayerId: 'ai', street: 'FLOP' as const, toCall: 10, potAmount: 50, actionHistory: [
      { playerId: 'ai', street: 'FLOP' as const, action: 'check' as const, amount: 0, totalTo: 0 },
      { playerId: 'villain', street: 'FLOP' as const, action: 'bet-to' as const, amount: 10, totalTo: 10 },
    ] };
    recordExperienceAction(report, context, { kind: 'call' });
    expect(report.checkRaise).toEqual({ numerator: 0, denominator: 1 });
  });

  it('uses a hand-end denominator for showdown rate', () => {
    const report = createExperienceReport();
    recordExperienceHand(report, { showdown: true });
    recordExperienceHand(report, { showdown: false });
    expect(report.showdown).toEqual({ numerator: 1, denominator: 2 });
  });
});
