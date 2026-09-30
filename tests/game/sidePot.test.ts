import { describe, expect, it } from 'vitest';
import { buildPots, type PotParticipant } from '../../src/game/sidePot';

function participant(
  id: string,
  seat: number,
  contribution: number,
  folded = false,
): PotParticipant {
  return { id, seat, contribution, folded };
}

describe('side-pot construction', () => {
  it('builds a main pot and two independent side pots', () => {
    expect(buildPots([
      participant('a', 0, 1_000),
      participant('b', 1, 5_000),
      participant('c', 2, 10_000),
    ])).toEqual([
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
      {
        amount: 5_000,
        fromContribution: 5_000,
        toContribution: 10_000,
        contributorPlayerIds: ['c'],
        eligiblePlayerIds: ['c'],
      },
    ]);
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
    expect(pots.map((pot) => pot.amount)).toEqual([400, 600, 600, 300]);
    expect(pots.map((pot) => pot.eligiblePlayerIds)).toEqual([
      ['a', 'b', 'c', 'd'],
      ['b', 'c', 'd'],
      ['c', 'd'],
      ['d'],
    ]);
  });

  it('ignores zero contributions and rejects invalid contribution data', () => {
    expect(buildPots([participant('zero', 0, 0), participant('live', 1, 25)])).toEqual([
      expect.objectContaining({ amount: 25, contributorPlayerIds: ['live'] }),
    ]);
    expect(() => buildPots([participant('bad', 0, -1)])).toThrow(/contribution/i);
    expect(() => buildPots([participant('a', 0, 10), participant('a', 1, 20)])).toThrow(/duplicate/i);
  });
});
