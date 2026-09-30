import { createDeck } from './cards';
import { applyAction as applyBettingAction, advanceStreet, getLegalActions } from './betting';
import { blindSeats, getActionOrder } from './dealer';
import type { GameMode } from './rules';
import type { GameState, TableConfig, TransitionResult } from './gameState';

let fallbackHandIdSequence = 0;

function handIdFor(state: GameState): string {
  if (!state.players.some((player) => player.isHuman)) return `hand-${state.handNumber + 1}`;
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${fallbackHandIdSequence += 1}`;
  return `hand-${uniqueId}`;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}

export function createTable(config: TableConfig): GameState {
  assertPositiveInteger(config.smallBlind, 'smallBlind');
  assertPositiveInteger(config.bigBlind, 'bigBlind');
  if (config.bigBlind < config.smallBlind) throw new Error('bigBlind must be at least smallBlind');
  if (config.players.length > config.tableSize) throw new Error('Too many players for table');
  const seats = new Set<number>();
  const players = config.players.map((player) => {
    if (seats.has(player.seat) || player.seat < 0 || player.seat >= config.tableSize) throw new Error('Invalid or duplicate seat');
    seats.add(player.seat);
    if (!Number.isSafeInteger(player.stack) || player.stack < 0) throw new Error('Player stack must be non-negative');
    return {
      id: player.id,
      name: player.name ?? player.id,
      seat: player.seat,
      stack: player.stack,
      isHuman: player.isHuman ?? false,
      holeCards: [],
      streetContribution: 0,
      handContribution: 0,
      folded: false,
      allIn: player.stack === 0,
      hasActedStreet: false,
      status: player.stack === 0 ? 'WAITING' as const : 'WAITING' as const,
    };
  }).sort((left, right) => left.seat - right.seat);
  const dealerSeat = config.dealerSeat ?? players[0]?.seat ?? 0;
  return {
    handId: null,
    handNumber: 0,
    mode: config.mode,
    tableSize: config.tableSize,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    dealerSeat,
    smallBlindSeat: null,
    bigBlindSeat: null,
    street: 'PRE_FLOP',
    deck: [],
    deckIndex: 0,
    burnCards: [],
    communityCards: [],
    players,
    actingSeat: null,
    currentBet: 0,
    lastFullRaise: config.bigBlind,
    pots: [],
    actionHistory: [],
  };
}

function postBlind(state: GameState, seat: number, amount: number): void {
  const player = state.players.find((entry) => entry.seat === seat);
  if (!player) return;
  const paid = Math.min(amount, player.stack);
  player.stack -= paid;
  player.streetContribution = paid;
  player.handContribution = paid;
  if (player.stack === 0) {
    player.allIn = true;
    player.status = 'ALL_IN';
  } else {
    player.status = 'ACTIVE';
  }
}

function validateDeck(state: GameState, deck: readonly ReturnType<typeof createDeck>[number][]): void {
  const expected = state.mode === 'SHORT_DECK' ? 36 : 52;
  if (deck.length !== expected || new Set(deck.map((card) => card.id)).size !== deck.length) throw new Error('Deck does not match the selected mode');
}

export function startHand(state: GameState, deck: readonly ReturnType<typeof createDeck>[number][]): GameState {
  validateDeck(state, deck);
  const next: GameState = {
    ...state,
    handId: handIdFor(state),
    handNumber: state.handNumber + 1,
    street: 'PRE_FLOP',
    deck: [...deck],
    deckIndex: 0,
    burnCards: [],
    communityCards: [],
    actingSeat: null,
    currentBet: 0,
    lastFullRaise: state.bigBlind,
    smallBlindSeat: null,
    bigBlindSeat: null,
    pots: [],
    actionHistory: [],
    players: state.players.map((player) => ({
      ...player,
      holeCards: [],
      streetContribution: 0,
      handContribution: 0,
      folded: player.stack <= 0,
      allIn: player.stack <= 0,
      hasActedStreet: false,
      status: player.stack <= 0 ? 'WAITING' : 'ACTIVE',
    })),
  };
  const activePlayers = next.players.filter((player) => player.stack > 0);
  if (activePlayers.length < 2) throw new Error('At least two players with chips are required');
  const seats = blindSeats(next.tableSize, next.dealerSeat);
  next.smallBlindSeat = seats.smallBlindSeat;
  next.bigBlindSeat = seats.bigBlindSeat;
  postBlind(next, seats.smallBlindSeat, next.smallBlind);
  postBlind(next, seats.bigBlindSeat, next.bigBlind);

  const dealOrder = getActionOrder(next.tableSize, next.dealerSeat, 'FLOP')
    .map((seat) => next.players.find((player) => player.seat === seat))
    .filter((player): player is GameState['players'][number] => Boolean(player && !player.folded));
  for (let round = 0; round < 2; round += 1) {
    for (const player of dealOrder) player.holeCards.push(next.deck[next.deckIndex++]);
  }
  next.currentBet = Math.max(...next.players.map((player) => player.streetContribution));
  next.actingSeat = getActionOrder(next.tableSize, next.dealerSeat, 'PRE_FLOP')
    .map((seat) => next.players.find((player) => player.seat === seat))
    .find((player): player is GameState['players'][number] => Boolean(player && !player.folded && !player.allIn))?.seat ?? null;
  return next.actingSeat === null ? advanceStreet(next) : next;
}

export { advanceStreet, getLegalActions, getActionOrder };
export function applyAction(state: GameState, command: Parameters<typeof applyBettingAction>[1]): TransitionResult {
  return applyBettingAction(state, command);
}

export type { PokerCoreAdapter } from './coreAdapter';
export { localPokerCoreAdapter } from './coreAdapter';
