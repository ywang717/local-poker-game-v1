import type { Pot, PotRefund } from './pot';

export type PotParticipant = {
  id: string;
  seat: number;
  contribution: number;
  folded?: boolean;
};

export type PotBuildResult = {
  pots: Pot[];
  refunds: PotRefund[];
};

export type { Pot, PotRefund } from './pot';

function validateParticipants(players: readonly PotParticipant[]): void {
  const ids = new Set<string>();
  const seats = new Set<number>();
  for (const player of players) {
    if (!player.id) throw new Error('Pot participant id is required');
    if (ids.has(player.id)) throw new Error(`Duplicate pot participant id: ${player.id}`);
    if (seats.has(player.seat)) throw new Error(`Duplicate pot participant seat: ${player.seat}`);
    if (!Number.isSafeInteger(player.seat) || player.seat < 0) throw new Error('Pot participant seat must be a non-negative integer');
    if (!Number.isSafeInteger(player.contribution) || player.contribution < 0) throw new Error('Contribution must be a non-negative integer');
    ids.add(player.id);
    seats.add(player.seat);
  }
}

/**
 * Turns cumulative hand contributions into non-overlapping contribution
 * layers. Folded players still contribute chips to a layer, but cannot be
 * listed as eligible winners for that layer.
 */
export function buildPotsWithRefunds(players: readonly PotParticipant[]): PotBuildResult {
  validateParticipants(players);
  const ordered = [...players].sort((left, right) => left.seat - right.seat);
  const levels = [...new Set(ordered.map((player) => player.contribution).filter((amount) => amount > 0))].sort((left, right) => left - right);
  const refunds: PotRefund[] = [];
  // The highest unmatched contribution is an uncalled bet, not a side pot.
  // Remove one-person top layers until the highest remaining layer has at
  // least two contributors. Folded players still count as contributors here.
  while (levels.length > 0) {
    const from = levels.length > 1 ? levels[levels.length - 2] : 0;
    const to = levels[levels.length - 1];
    const contributors = ordered.filter((player) => player.contribution >= to);
    if (contributors.length !== 1) break;
    const amount = to - from;
    if (amount > 0) refunds.push({ playerId: contributors[0].id, amount });
    levels.pop();
  }
  const pots: Pot[] = [];
  let fromContribution = 0;
  for (const toContribution of levels) {
    const contributors = ordered.filter((player) => player.contribution >= toContribution);
    const layerSize = toContribution - fromContribution;
    const amount = layerSize * contributors.length;
    if (amount > 0) {
      pots.push({
        amount,
        fromContribution,
        toContribution,
        contributorPlayerIds: contributors.map((player) => player.id),
        eligiblePlayerIds: contributors.filter((player) => !player.folded).map((player) => player.id),
      });
    }
    fromContribution = toContribution;
  }
  return { pots, refunds };
}

export function buildPots(players: readonly PotParticipant[]): Pot[] {
  return buildPotsWithRefunds(players).pots;
}
