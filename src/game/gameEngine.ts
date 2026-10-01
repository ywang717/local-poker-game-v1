import { createDeck } from './cards';
import { applyAction as applyBettingAction, advanceStreet, getLegalActions } from './betting';
import { blindSeats, blindSeatsForPlayers, getActionOrder, getActionOrderForPlayers } from './dealer';
import type { GameMode } from './rules';
import type { GameState, TableConfig, TransitionResult } from './gameState';
import { createMatchSession } from '../match/session';
import { getTableLevel, type TableLevelId } from '../career/tableLevels';

let fallbackHandIdSequence = 0;

function handIdFor(state: GameState): string {
  if (!state.players.some((player) => player.isHuman)) return `hand-${state.handNumber + 1}`;
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${fallbackHandIdSequence += 1}`;
  return `hand-${uniqueId}`;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}

function levelForBigBlind(bigBlind: number): TableLevelId {
  const level = [...[1, 2, 3, 4, 5] as const].reverse().find((id) => getTableLevel(id).bigBlind <= bigBlind);
  return level ?? 1;
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
  const session = config.session ?? createMatchSession({ mode: config.mode, tableLevel: config.tableLevel ?? levelForBigBlind(config.bigBlind), matchType: config.matchType ?? 'CASH', sessionId: config.sessionId });
  return {
    sessionId: session.sessionId,
    matchType: session.matchType,
    tableLevel: session.tableLevel,
    session,
    handId: null,
    handNumber: 0,
    mode: config.mode,
    tableSize: config.tableSize,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    dealerSeat,
    initialOccupiedSeats: players.map((player) => player.seat),
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
    refunds: [],
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
    refunds: [],
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
  next.initialOccupiedSeats = [...(state.initialOccupiedSeats ?? state.players.map((player) => player.seat))];
  const activePlayers = next.players.filter((player) => player.stack > 0);
  if (activePlayers.length < 2) throw new Error('At least two players with chips are required');
  const dynamicSeats = next.matchType === 'MINI_TOURNAMENT' || next.session?.matchType === 'MINI_TOURNAMENT';
  const seats = !dynamicSeats || activePlayers.length === next.tableSize
    ? blindSeats(next.tableSize, next.dealerSeat)
    : blindSeatsForPlayers(activePlayers, next.dealerSeat);
  next.smallBlindSeat = seats.smallBlindSeat;
  next.bigBlindSeat = seats.bigBlindSeat;
  postBlind(next, seats.smallBlindSeat, next.smallBlind);
  postBlind(next, seats.bigBlindSeat, next.bigBlind);

  const dealOrder = (!dynamicSeats || activePlayers.length === next.tableSize
    ? getActionOrder(next.tableSize, next.dealerSeat, 'FLOP')
    : getActionOrderForPlayers(activePlayers, next.dealerSeat, 'FLOP'))
    .map((seat) => next.players.find((player) => player.seat === seat))
    .filter((player): player is GameState['players'][number] => Boolean(player && !player.folded));
  for (let round = 0; round < 2; round += 1) {
    for (const player of dealOrder) player.holeCards.push(next.deck[next.deckIndex++]);
  }
  // The pre-flop bring-in is the full big blind even when the BB is short
  // stacked and can only post part of it.
  next.currentBet = next.bigBlind;
  next.actingSeat = (!dynamicSeats || activePlayers.length === next.tableSize
    ? getActionOrder(next.tableSize, next.dealerSeat, 'PRE_FLOP')
    : getActionOrderForPlayers(activePlayers, next.dealerSeat, 'PRE_FLOP'))
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
