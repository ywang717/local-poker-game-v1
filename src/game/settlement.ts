import { compareEvaluations, type HandEvaluation } from './handEvaluator';
import type { GameMode } from './rules';
import type { Pot, PotAward, PotRefund, SettledPot } from './pot';

export type SettlementPlayer = {
  id: string;
  seat: number;
  folded?: boolean;
};

export type SettlementResult = {
  pots: SettledPot[];
  awards: PotAward[];
  totalPot: number;
  totalAwarded: number;
  refunds: PotRefund[];
  totalRefunded: number;
};

type EvaluationLookup = Readonly<Record<string, HandEvaluation>> | ReadonlyMap<string, HandEvaluation>;

function getEvaluation(lookup: EvaluationLookup, playerId: string): HandEvaluation | undefined {
  if (lookup instanceof Map) return lookup.get(playerId);
  return (lookup as Readonly<Record<string, HandEvaluation>>)[playerId];
}

function validatePlayers(players: readonly SettlementPlayer[]): void {
  const ids = new Set<string>();
  const seats = new Set<number>();
  for (const player of players) {
    if (!player.id) throw new Error('Settlement player id is required');
    if (ids.has(player.id)) throw new Error(`Duplicate settlement player id: ${player.id}`);
    if (seats.has(player.seat)) throw new Error(`Duplicate settlement player seat: ${player.seat}`);
    if (!Number.isSafeInteger(player.seat) || player.seat < 0) throw new Error('Settlement player seat must be a non-negative integer');
    ids.add(player.id);
    seats.add(player.seat);
  }
}

function orderFromDealerLeft(players: readonly SettlementPlayer[], dealerSeat: number): SettlementPlayer[] {
  const ordered = [...players].sort((left, right) => left.seat - right.seat);
  if (ordered.length === 0) return [];
  const dealerIndex = ordered.findIndex((player) => player.seat === dealerSeat);
  const start = dealerIndex >= 0 ? dealerIndex : ordered.findIndex((player) => player.seat > dealerSeat) - 1;
  const normalizedStart = start < 0 ? ordered.length - 1 : start;
  return ordered.map((_, index) => ordered[(normalizedStart + 1 + index) % ordered.length]);
}

function winnerIdsForPot(
  pot: Pot,
  playersById: ReadonlyMap<string, SettlementPlayer>,
  evaluations: EvaluationLookup,
  mode: GameMode,
): string[] {
  const eligible = pot.eligiblePlayerIds
    .map((id) => playersById.get(id))
    .filter((player): player is SettlementPlayer => Boolean(player && !player.folded));
  if (eligible.length === 0) throw new Error(`Pot ${pot.toContribution} has no eligible players`);
  if (eligible.length === 1) return [eligible[0].id];
  let best: HandEvaluation | undefined;
  let winners: SettlementPlayer[] = [];
  for (const player of eligible) {
    const evaluation = getEvaluation(evaluations, player.id);
    if (!evaluation) throw new Error(`Missing hand evaluation for ${player.id}`);
    if (!best) {
      best = evaluation;
      winners = [player];
      continue;
    }
    const comparison = compareEvaluations(evaluation, best, mode);
    if (comparison > 0) {
      best = evaluation;
      winners = [player];
    } else if (comparison === 0) {
      winners.push(player);
    }
  }
  return winners.map((player) => player.id);
}

function splitPot(pot: Pot, winnerIds: readonly string[], payoutOrder: readonly SettlementPlayer[]): PotAward[] {
  if (winnerIds.length === 0) throw new Error('Cannot split a pot without winners');
  const winnerSet = new Set(winnerIds);
  const orderedWinners = payoutOrder.filter((player) => winnerSet.has(player.id));
  const base = Math.floor(pot.amount / orderedWinners.length);
  const remainder = pot.amount % orderedWinners.length;
  return orderedWinners.map((player, index) => ({
    playerId: player.id,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

/**
 * Settles each contribution layer independently. All returned objects are
 * newly allocated, so repeated settlement is deterministic and idempotent.
 */
export function settlePots(
  pots: readonly Pot[],
  players: readonly SettlementPlayer[],
  evaluations: EvaluationLookup,
  dealerSeat: number,
  mode: GameMode = 'STANDARD',
  refunds: readonly PotRefund[] = [],
): SettlementResult {
  validatePlayers(players);
  if (!Number.isSafeInteger(dealerSeat) || dealerSeat < 0) throw new Error('Dealer seat must be a non-negative integer');
  const playersById = new Map(players.map((player) => [player.id, player]));
  const payoutOrder = orderFromDealerLeft(players, dealerSeat);
  const settledPots: SettledPot[] = pots.map((pot) => {
    if (!Number.isSafeInteger(pot.amount) || pot.amount < 0) throw new Error('Pot amount must be a non-negative integer');
    const winnerPlayerIds = winnerIdsForPot(pot, playersById, evaluations, mode);
    const awards = splitPot(pot, winnerPlayerIds, payoutOrder);
    return {
      ...pot,
      contributorPlayerIds: [...pot.contributorPlayerIds],
      eligiblePlayerIds: [...pot.eligiblePlayerIds],
      winnerPlayerIds: [...winnerPlayerIds],
      awards,
    };
  });
  const awards = settledPots.flatMap((pot) => pot.awards.map((award) => ({ ...award })));
  const totalPot = settledPots.reduce((sum, pot) => sum + pot.amount, 0);
  const totalAwarded = awards.reduce((sum, award) => sum + award.amount, 0);
  assertChipConservation(totalPot, totalAwarded);
  const normalizedRefunds = refunds.map((refund) => ({ ...refund }));
  const totalRefunded = normalizedRefunds.reduce((sum, refund) => {
    if (!Number.isSafeInteger(refund.amount) || refund.amount < 0) throw new Error('Refund amount must be a non-negative integer');
    if (!playersById.has(refund.playerId)) throw new Error(`Unknown refund player ${refund.playerId}`);
    return sum + refund.amount;
  }, 0);
  return { pots: settledPots, awards, totalPot, totalAwarded, refunds: normalizedRefunds, totalRefunded };
}

type ChipTotal = number | readonly number[];

function totalChips(value: ChipTotal): number {
  const total = typeof value === 'number' ? value : value.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Chip total must be a non-negative integer');
  return total;
}

export function assertChipConservation(before: ChipTotal, after: ChipTotal): void {
  if (totalChips(before) !== totalChips(after)) {
    throw new Error(`Chip conservation failed: before ${totalChips(before)}, after ${totalChips(after)}`);
  }
}
