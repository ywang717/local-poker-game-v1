import { createDeck, shuffleDeck, type RandomSource } from '../game/cards';
import { createTable, startHand } from '../game/gameEngine';
import { nextDealerSeat, blindSeatsForPlayers } from '../game/dealer';
import type { GameState } from '../game/gameState';
import { createMatchSession } from '../match/session';
import { getTableLevel } from '../career/tableLevels';
import { getBlindStructure } from './blindStructure';
import type { StartTournamentInput, TournamentPlayer, TournamentState } from './types';
import { personalityForAiIndex } from '../ai/personalities';
import { selectAiNamesForKey } from '../ai/names';

let tournamentSequence = 0;

function generatedTournamentId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `tournament-${randomId ?? `${Date.now()}-${tournamentSequence += 1}`}`;
}

function clonePlayer(player: TournamentPlayer): TournamentPlayer { return { ...player }; }

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

export function startTournament(input: StartTournamentInput = {}): TournamentState {
  const tableLevel = input.tableLevel ?? 1;
  const mode = input.mode ?? 'STANDARD';
  const level = getTableLevel(tableLevel);
  const { smallBlind, bigBlind } = getBlindStructure(tableLevel, 1);
  const startingStack = bigBlind * 100;
  const humanId = input.humanId ?? input.humanPlayerId ?? input.playerId ?? input.human?.id ?? 'human';
  if (!humanId) throw new Error('humanId is required');
  const tournamentId = input.tournamentId ?? generatedTournamentId();
  const aiIds = Array.from({ length: 5 }, (_, index) => `ai-${index + 1}`);
  if (aiIds.includes(humanId)) throw new Error(`Human participant id collides with reserved AI id: ${humanId}`);
  const aiNames = selectAiNamesForKey(5, tournamentId);
  const players: TournamentPlayer[] = [
    { id: humanId, name: input.humanName ?? input.human?.name ?? humanId, seat: 0, isHuman: true, stack: startingStack, startingStack },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `ai-${index + 1}`,
      name: aiNames[index],
      seat: index + 1,
      isHuman: false,
      stack: startingStack,
      startingStack,
      personalityId: personalityForAiIndex(index),
    })),
  ];
  const entryFee = input.entryFee ?? level.buyIn;
  assertInteger(entryFee, 'entryFee');
  if (entryFee <= 0) throw new Error('entryFee must be positive');
  return {
    tournamentId, mode, tableLevel, entryFee,
    startingStack, smallBlind, bigBlind, blindLevel: 1, handsAtLevel: 0, handNumber: 0,
    players, eliminations: [], rankings: [], rewardPaid: false, spectator: false, dealerSeat: 0,
  };
}

function statePlayersForHand(state: TournamentState): TournamentPlayer[] {
  if (state.players.length < 2) throw new Error('Tournament needs at least two players to start a hand');
  return state.players.map(clonePlayer);
}

/** Start one hand using current blinds and the immutable entry-level AI setting. */
export function startTournamentHand(state: TournamentState, rng: RandomSource = Math.random): GameState {
  const players = statePlayersForHand(state);
  const occupied = new Set(players.map((player) => player.seat));
  const dealerSeat = occupied.has(state.dealerSeat) ? state.dealerSeat : nextDealerSeat(6, state.dealerSeat, occupied);
  const session = createMatchSession({ mode: state.mode, tableLevel: state.tableLevel, matchType: 'MINI_TOURNAMENT', sessionId: state.tournamentId });
  const table = createTable({
    mode: state.mode, tableSize: 6, smallBlind: state.smallBlind, bigBlind: state.bigBlind,
    dealerSeat, sessionId: state.tournamentId, matchType: 'MINI_TOURNAMENT', tableLevel: state.tableLevel,
    session, players: players.map((player) => ({ id: player.id, name: player.name, seat: player.seat, stack: player.stack, isHuman: player.isHuman, personalityId: player.personalityId })),
  });
  table.handNumber = state.handNumber;
  table.tournamentBlindLevel = state.blindLevel;
  table.tournamentHandsAtLevel = state.handsAtLevel;
  table.tournamentPlayersRemaining = state.players.length;
  table.tournamentState = structuredClone(state);
  return startHand(table, shuffleDeck(createDeck(state.mode), rng));
}

function assertSettlementGame(game: GameState): void {
  if (game.street !== 'SETTLEMENT') throw new Error('Tournament hand must be settled before elimination');
}

/** Apply a settled game snapshot, then remove and rank players with zero chips. */
export function settleTournamentHand(state: TournamentState, settledGame: GameState): TournamentState {
  assertSettlementGame(settledGame);
  const previousTotal = state.players.reduce((sum, player) => sum + player.stack, 0);
  const byId = new Map(settledGame.players.map((player) => [player.id, player]));
  const updated = state.players.map((player) => {
    const gamePlayer = byId.get(player.id);
    return gamePlayer ? { ...player, stack: gamePlayer.stack } : clonePlayer(player);
  });
  const settledTotal = updated.reduce((sum, player) => sum + player.stack, 0);
  if (settledTotal !== previousTotal) throw new Error(`Tournament chip conservation failed: before ${previousTotal}, after ${settledTotal}`);

  const handNumber = Math.max(state.handNumber + 1, settledGame.handNumber);
  const stackBefore = new Map(state.players.map((player) => [player.id, player.stack]));
  const zeroStack = updated.filter((player) => player.stack <= 0)
    .sort((left, right) => (stackBefore.get(left.id) ?? 0) - (stackBefore.get(right.id) ?? 0) || left.seat - right.seat);
  const live = updated.filter((player) => player.stack > 0);
  const eliminations = [...state.eliminations];
  const rankings = [...state.rankings];
  const totalEntrants = state.players.length + state.eliminations.length;
  zeroStack.forEach((player) => {
    const rank = totalEntrants - eliminations.length;
    eliminations.push({ playerId: player.id, playerName: player.name, rank, handNumber, stackBeforeHand: stackBefore.get(player.id) ?? 0, seat: player.seat });
    rankings.push({ playerId: player.id, rank });
  });
  const { smallBlind, bigBlind } = getBlindStructure(state.tableLevel, state.blindLevel);
  const handsAtLevel = state.handsAtLevel + 1;
  const nextBase: TournamentState = {
    ...state, players: live, eliminations, rankings, handNumber,
    handsAtLevel, smallBlind, bigBlind,
    spectator: state.spectator || zeroStack.some((player) => player.isHuman),
  };
  const advanced = advanceBlindLevel(nextBase);
  if (advanced.players.length > 1) {
    const seats = new Set(advanced.players.map((player) => player.seat));
    advanced.dealerSeat = nextDealerSeat(6, settledGame.dealerSeat, seats);
  }
  return advanced;
}

/** Advance one or more eight-hand blind stages without mutating the input. */
export function advanceBlindLevel(state: TournamentState): TournamentState {
  let blindLevel = state.blindLevel;
  let handsAtLevel = state.handsAtLevel;
  while (handsAtLevel >= 8) { blindLevel += 1; handsAtLevel -= 8; }
  const blinds = getBlindStructure(state.tableLevel, blindLevel);
  return { ...state, blindLevel, handsAtLevel, smallBlind: blinds.smallBlind, bigBlind: blinds.bigBlind };
}

export { blindSeatsForPlayers };
export { finishTournament, forfeitTournament } from './tournamentSettlement';
export type { TournamentState, StartTournamentInput } from './types';
