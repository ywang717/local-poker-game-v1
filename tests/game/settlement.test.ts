import { describe, expect, it } from 'vitest';
import { evaluateHand, type HandEvaluation } from '../../src/game/handEvaluator';
import { buildPots, type PotParticipant } from '../../src/game/sidePot';
import { assertChipConservation, settlePots, type SettlementPlayer } from '../../src/game/settlement';
import { c } from './cards.test';

function evaluation(category: HandEvaluation['category'], rankVector: number[]): HandEvaluation {
  return { category, labelZh: category, labelEn: category, bestFive: [], rankVector };
}

function player(id: string, seat: number, folded = false): SettlementPlayer {
  return { id, seat, folded };
}

function contribution(id: string, seat: number, amount: number, folded = false): PotParticipant {
  return { id, seat, contribution: amount, folded };
}

describe('pot settlement', () => {
  it('awards a two-player all-in pot to the stronger evaluation', () => {
    const pots = buildPots([contribution('a', 0, 100), contribution('b', 1, 250)]);
    const result = settlePots(
      pots,
      [player('a', 0), player('b', 1)],
      { a: evaluation('ONE_PAIR', [14, 13, 9, 7]), b: evaluation('HIGH_CARD', [14, 13, 9, 7, 2]) },
      0,
    );
    expect(result.awards).toEqual([{ playerId: 'a', amount: 200 }, { playerId: 'b', amount: 150 }]);
    expect(result.pots.map((pot) => pot.winnerPlayerIds)).toEqual([['a'], ['b']]);
    expect(result.totalPot).toBe(350);
    expect(result.totalAwarded).toBe(350);
  });

  it('allows a different winner in each side pot', () => {
    const pots = buildPots([
      contribution('a', 0, 1_000),
      contribution('b', 1, 5_000),
      contribution('c', 2, 10_000),
    ]);
    const result = settlePots(
      pots,
      [player('a', 0), player('b', 1), player('c', 2)],
      { a: evaluation('ONE_PAIR', [14, 13, 9, 7]), b: evaluation('TWO_PAIR', [12, 11, 9]), c: evaluation('THREE_OF_A_KIND', [8, 14, 13]) },
      0,
    );
    expect(result.awards).toEqual([
      { playerId: 'c', amount: 3_000 },
      { playerId: 'c', amount: 8_000 },
      { playerId: 'c', amount: 5_000 },
    ]);
  });

  it('excludes folded players from winners while retaining their contribution', () => {
    const pots = buildPots([
      contribution('folder', 0, 1_000, true),
      contribution('b', 1, 1_000),
      contribution('c', 2, 1_000),
    ]);
    const result = settlePots(
      pots,
      [player('folder', 0, true), player('b', 1), player('c', 2)],
      { folder: evaluation('ROYAL_FLUSH', [14]), b: evaluation('ONE_PAIR', [14]), c: evaluation('HIGH_CARD', [14]) },
      0,
    );
    expect(result.awards).toEqual([{ playerId: 'b', amount: 3_000 }]);
    expect(result.pots[0].winnerPlayerIds).toEqual(['b']);
  });

  it('splits exact ties and gives odd chips from the dealer-left seat clockwise', () => {
    const pots = buildPots([
      contribution('a', 0, 5),
      contribution('b', 1, 5),
      contribution('c', 2, 5),
    ]);
    const result = settlePots(
      pots,
      [player('a', 0), player('b', 1), player('c', 2)],
      { a: evaluation('STRAIGHT', [9]), b: evaluation('STRAIGHT', [9]), c: evaluation('HIGH_CARD', [14]) },
      0,
    );
    expect(result.pots[0].winnerPlayerIds).toEqual(['a', 'b']);
    expect(result.pots[0].awards).toEqual([{ playerId: 'b', amount: 8 }, { playerId: 'a', amount: 7 }]);
    expect(result.awards).toEqual([{ playerId: 'b', amount: 8 }, { playerId: 'a', amount: 7 }]);
  });

  it('supports short-deck hand ordering when selecting winners', () => {
    const pots = buildPots([contribution('flush', 0, 100), contribution('house', 1, 100)]);
    const flush = evaluateHand(
      [c(14, 'hearts'), c(6, 'hearts')],
      [c(7, 'hearts'), c(9, 'hearts'), c(11, 'hearts'), c(12, 'clubs'), c(13, 'diamonds')],
      'SHORT_DECK',
    );
    const house = evaluateHand(
      [c(14, 'spades'), c(14, 'hearts')],
      [c(14, 'clubs'), c(13, 'spades'), c(13, 'clubs'), c(6, 'diamonds'), c(7, 'diamonds')],
      'SHORT_DECK',
    );
    const result = settlePots(pots, [player('flush', 0), player('house', 1)], { flush, house }, 0, 'SHORT_DECK');
    expect(result.awards).toEqual([{ playerId: 'flush', amount: 200 }]);
  });

  it('is deterministic and does not mutate inputs when settled repeatedly', () => {
    const pots = buildPots([contribution('a', 0, 11), contribution('b', 1, 11)]);
    const players = [player('a', 0), player('b', 1)];
    const evaluations = { a: evaluation('HIGH_CARD', [14]), b: evaluation('HIGH_CARD', [14]) };
    const first = settlePots(pots, players, evaluations, 1);
    const second = settlePots(pots, players, evaluations, 1);
    expect(second).toEqual(first);
    expect('winnerPlayerIds' in pots[0]).toBe(false);
    expect(players).toEqual([player('a', 0), player('b', 1)]);
  });

  it('preserves chips across 500 deterministic random contribution layouts', () => {
    let seed = 0x1234abcd;
    const nextRandom = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    for (let iteration = 0; iteration < 500; iteration += 1) {
      const count = 2 + Math.floor(nextRandom() * 8);
      const participants = Array.from({ length: count }, (_, seat) => contribution(`p${seat}`, seat, Math.floor(nextRandom() * 2_000)));
      const pots = buildPots(participants);
      const active = participants.filter((entry) => entry.contribution > 0).map((entry) => player(entry.id, entry.seat));
      const evaluations = Object.fromEntries(active.map((entry) => [entry.id, evaluation('HIGH_CARD', [14, 13, 12, 11, 10])]));
      if (pots.length === 0) continue;
      const result = settlePots(pots, active, evaluations, 0);
      expect(result.totalAwarded).toBe(result.totalPot);
      assertChipConservation(result.totalPot, result.totalAwarded);
    }
  });
});

describe('chip conservation assertion', () => {
  it('accepts equal totals and rejects a mismatch', () => {
    assertChipConservation([100, 250, 300], [200, 450]);
    expect(() => assertChipConservation(10, 9)).toThrow(/conservation/i);
  });
});
