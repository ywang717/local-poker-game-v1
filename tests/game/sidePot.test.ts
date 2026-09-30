import { describe, expect, it } from 'vitest';
import { buildPots, buildPotsWithRefunds, type PotParticipant } from '../../src/game/sidePot';

function participant(
  id: string,
  seat: number,
  contribution: number,
  folded = false,
): PotParticipant {
  return { id, seat, contribution, folded };
}

describe('side-pot construction', () => {
  it('returns an uncalled top layer as a refund instead of a singleton side pot', () => {
    const result = buildPotsWithRefunds([
      participant('a', 0, 1_000),
      participant('b', 1, 5_000),
      participant('c', 2, 10_000),
    ]);
    expect(result.pots).toEqual([
      {
        amount: 3_000,
        fromContribution: 0,
        toContribution: 1_000,
        contributorPlayerIds: ['a', 'b', 'c'],
        eligiblePlayerIds: ['a', 'b', 'c'],
      },
      {
        amount: 8_000,
        fromContribution: 1_000,
        toContribution: 5_000,
        contributorPlayerIds: ['b', 'c'],
        eligiblePlayerIds: ['b', 'c'],
      },
    ]);
    expect(result.refunds).toEqual([{ playerId: 'c', amount: 5_000 }]);
    expect(buildPots([
      participant('a', 0, 1_000),
      participant('b', 1, 5_000),
      participant('c', 2, 10_000),
    ])).toEqual(result.pots);
  });

  it('keeps folded chips in the pot but removes the folder from eligibility', () => {
    expect(buildPots([
      participant('folded', 0, 1_000, true),
      participant('b', 1, 1_000),
      participant('c', 2, 1_000),
    ])).toEqual([
      expect.objectContaining({
        amount: 3_000,
        contributorPlayerIds: ['folded', 'b', 'c'],
        eligiblePlayerIds: ['b', 'c'],
      }),
    ]);
  });

  it('builds multiple layers for four players with different all-in amounts', () => {
    const pots = buildPots([
      participant('a', 0, 100),
      participant('b', 1, 300),
      participant('c', 2, 600),
      participant('d', 3, 900),
    ]);
    expect(pots.map((pot) => pot.amount)).toEqual([400, 600, 600]);
    expect(pots.map((pot) => pot.eligiblePlayerIds)).toEqual([
      ['a', 'b', 'c', 'd'],
      ['b', 'c', 'd'],
      ['c', 'd'],
    ]);
  });

  it('refunds a heads-up overbet and keeps folded contributions in real pots', () => {
    expect(buildPotsWithRefunds([
      participant('a', 0, 100),
      participant('b', 1, 500),
    ])).toEqual({
      pots: [{ amount: 200, fromContribution: 0, toContribution: 100, contributorPlayerIds: ['a', 'b'], eligiblePlayerIds: ['a', 'b'] }],
      refunds: [{ playerId: 'b', amount: 400 }],
    });
    expect(buildPotsWithRefunds([
      participant('folded', 0, 100),
      participant('caller', 1, 100),
      participant('raiser', 2, 300),
    ]).refunds).toEqual([{ playerId: 'raiser', amount: 200 }]);
  });

  it('ignores zero contributions and rejects invalid contribution data', () => {
    expect(buildPotsWithRefunds([participant('zero', 0, 0), participant('live', 1, 25)])).toEqual({ pots: [], refunds: [{ playerId: 'live', amount: 25 }] });
    expect(() => buildPots([participant('bad', 0, -1)])).toThrow(/contribution/i);
    expect(() => buildPots([participant('a', 0, 10), participant('a', 1, 20)])).toThrow(/duplicate/i);
  });

  it('preserves contributions across 10,000 randomized multi-layer layouts', () => {
    let seed = 0x7a11ce;
    const nextRandom = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    for (let iteration = 0; iteration < 10_000; iteration += 1) {
      const count = 2 + Math.floor(nextRandom() * 8);
      const participants = Array.from({ length: count }, (_, seat) => participant(`p${seat}`, seat, Math.floor(nextRandom() * 2_000), nextRandom() < 0.2));
      const result = buildPotsWithRefunds(participants);
      const contributionTotal = participants.reduce((sum, entry) => sum + entry.contribution, 0);
      const potTotal = result.pots.reduce((sum, pot) => sum + pot.amount, 0);
      const refundTotal = result.refunds.reduce((sum, refund) => sum + refund.amount, 0);
      expect(potTotal + refundTotal).toBe(contributionTotal);
    }
  });
});
