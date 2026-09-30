import type { Street } from './gameState';

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
