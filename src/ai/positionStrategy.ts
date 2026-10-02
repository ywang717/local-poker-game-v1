import type { GameState } from '../game/gameState';

/** The fixed seat labels used by the V2 pre-flop ranges. */
export type DetailedPosition = 'UTG' | 'UTG1' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB' | 'HEADS_UP';
export type PositionRoles = {
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  /** Post-flop role. In heads-up the BTN/SB is in position and BB is OOP. */
  inPosition: boolean;
};

const byCount: Readonly<Record<number, readonly DetailedPosition[]>> = {
  0: [],
  1: ['UTG'],
  2: ['UTG', 'CO'],
  3: ['UTG', 'HJ', 'CO'],
  4: ['UTG', 'MP', 'HJ', 'CO'],
  5: ['UTG', 'UTG1', 'MP', 'HJ', 'CO'],
  6: ['UTG', 'UTG1', 'MP', 'MP', 'HJ', 'CO'],
};

function occupiedSeats(state: GameState): number[] {
  const initial = state.initialOccupiedSeats?.filter((seat) => Number.isSafeInteger(seat));
  const seats = initial && initial.length > 0 ? initial : state.players.map((player) => player.seat);
  return [...new Set(seats)].sort((left, right) => left - right);
}

function clockwiseFromDealer(state: GameState, seats: readonly number[]): number[] {
  if (seats.length === 0) return [];
  const dealerIndex = seats.indexOf(state.dealerSeat);
  const start = dealerIndex >= 0 ? dealerIndex : 0;
  return seats.map((_, offset) => seats[(start + offset) % seats.length]);
}

/**
 * Return a player's fixed position for this hand. Folded players stay in the
 * occupied ring, so a fold cannot turn a CO into a BTN or change the blinds.
 */
export function positionForDetailed(state: GameState, playerId: string): DetailedPosition {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  const seats = occupiedSeats(state);
  if (seats.length <= 2) return 'HEADS_UP';
  const ring = clockwiseFromDealer(state, seats);
  const playerIndex = ring.indexOf(player.seat);
  if (playerIndex < 0) return 'MP';
  if (playerIndex === 0) return 'BTN';

  // The game engine records blind seats at hand start. For old snapshots that
  // pre-date the field, their seats are the two seats immediately left of BTN.
  const smallBlindSeat = state.smallBlindSeat ?? ring[1];
  const bigBlindSeat = state.bigBlindSeat ?? ring[2];
  if (player.seat === smallBlindSeat) return 'SB';
  if (player.seat === bigBlindSeat) return 'BB';

  const preBlindSeats = ring.slice(3);
  const labels = byCount[preBlindSeats.length] ?? preBlindSeats.map((_, index) => index === 0 ? 'UTG' : index === preBlindSeats.length - 1 ? 'CO' : 'MP');
  const positionIndex = preBlindSeats.indexOf(player.seat);
  return labels[positionIndex] ?? 'MP';
}

/**
 * Derive role flags from the same fixed seat ring as positionForDetailed.
 * Heads-up keeps the detailed label for compatibility, while callers still
 * receive the distinct BTN/SB and BB roles required for sizing and ranges.
 */
export function positionRolesFor(state: GameState, playerId: string): PositionRoles {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  const seats = occupiedSeats(state);
  const ring = clockwiseFromDealer(state, seats);
  const isButton = player.seat === state.dealerSeat || (ring.length > 0 && ring[0] === player.seat);
  const isSmallBlind = ring.length <= 2
    ? isButton
    : player.seat === (state.smallBlindSeat ?? ring[1]);
  const isBigBlind = ring.length <= 2
    ? !isButton
    : player.seat === (state.bigBlindSeat ?? ring[2]);
  const detailed = positionForDetailed(state, playerId);
  const inPosition = ring.length <= 2 ? isButton : detailed === 'BTN' || detailed === 'CO';
  return { isButton, isSmallBlind, isBigBlind, inPosition };
}

/** Combined source-of-truth record for consumers that need both the label and roles. */
export function positionInfoFor(state: GameState, playerId: string): { detailedPosition: DetailedPosition } & PositionRoles {
  return { detailedPosition: positionForDetailed(state, playerId), ...positionRolesFor(state, playerId) };
}

/** Return the detailed position for every currently represented player. */
export function detailedPositions(state: GameState): Readonly<Record<string, DetailedPosition>> {
  return Object.fromEntries(state.players.map((player) => [player.id, positionForDetailed(state, player.id)]));
}
