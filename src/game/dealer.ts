import type { Street } from './gameState';

export type OccupiedPlayer = { seat: number };

function assertSeatCount(tableSize: number): void {
  if (![2, 3, 4, 5, 6, 8, 9].includes(tableSize)) throw new Error(`Unsupported table size: ${tableSize}`);
}

function clockwise(tableSize: number, startExclusive: number): number[] {
  assertSeatCount(tableSize);
  return Array.from({ length: tableSize }, (_, offset) => (startExclusive + offset + 1) % tableSize);
}

export function getActionOrder(tableSize: number, dealerSeat: number, street: Street): number[] {
  assertSeatCount(tableSize);
  if (street === 'PRE_FLOP') {
    if (tableSize === 2) return [dealerSeat, (dealerSeat + 1) % tableSize];
    const bigBlindSeat = (dealerSeat + 2) % tableSize;
    return clockwise(tableSize, bigBlindSeat);
  }
  return clockwise(tableSize, dealerSeat);
}

export function blindSeats(tableSize: number, dealerSeat: number): { smallBlindSeat: number; bigBlindSeat: number } {
  assertSeatCount(tableSize);
  if (tableSize === 2) return { smallBlindSeat: dealerSeat, bigBlindSeat: (dealerSeat + 1) % tableSize };
  return { smallBlindSeat: (dealerSeat + 1) % tableSize, bigBlindSeat: (dealerSeat + 2) % tableSize };
}

export function nextDealerSeat(tableSize: number, dealerSeat: number, occupiedSeats: ReadonlySet<number>): number {
  for (let offset = 1; offset <= tableSize; offset += 1) {
    const seat = (dealerSeat + offset) % tableSize;
    if (occupiedSeats.has(seat)) return seat;
  }
  throw new Error('Cannot rotate dealer without an occupied seat');
}

function occupiedRing(players: readonly OccupiedPlayer[]): number[] {
  const seats = [...new Set(players.map((player) => player.seat))]
    .filter((seat) => Number.isSafeInteger(seat) && seat >= 0)
    .sort((left, right) => left - right);
  if (seats.length === 0) throw new Error('At least one occupied seat is required');
  return seats;
}

function dealerIndex(seats: readonly number[], dealerSeat: number): number {
  const exact = seats.indexOf(dealerSeat);
  if (exact >= 0) return exact;
  // A missing dealer is treated as the seat immediately before the first
  // occupied seat clockwise from the old dealer marker. This keeps the ring
  // deterministic while allowing callers to rotate after eliminations.
  const next = seats.findIndex((seat) => seat > dealerSeat);
  return next < 0 ? seats.length - 1 : (next + seats.length - 1) % seats.length;
}

/** Action order using only players that still occupy a seat. */
export function getActionOrderForPlayers(players: readonly OccupiedPlayer[], dealerSeat: number, street: Street): number[] {
  const seats = occupiedRing(players);
  const d = dealerIndex(seats, dealerSeat);
  const clockwiseFrom = (start: number): number[] => seats.map((_, offset) => seats[(start + offset) % seats.length]);
  if (street === 'PRE_FLOP') {
    if (seats.length === 2) return clockwiseFrom(d);
    const bigBlindIndex = (d + 2) % seats.length;
    return clockwiseFrom((bigBlindIndex + 1) % seats.length);
  }
  return clockwiseFrom((d + 1) % seats.length);
}

/** Small/blind seats using the occupied-seat ring (including Heads-Up rules). */
export function blindSeatsForPlayers(players: readonly OccupiedPlayer[], dealerSeat: number): { smallBlindSeat: number; bigBlindSeat: number } {
  const seats = occupiedRing(players);
  const d = dealerIndex(seats, dealerSeat);
  if (seats.length === 1) return { smallBlindSeat: seats[d], bigBlindSeat: seats[d] };
  if (seats.length === 2) return { smallBlindSeat: seats[d], bigBlindSeat: seats[(d + 1) % seats.length] };
  return { smallBlindSeat: seats[(d + 1) % seats.length], bigBlindSeat: seats[(d + 2) % seats.length] };
}
