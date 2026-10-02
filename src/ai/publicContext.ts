import type { Card } from '../game/cards';
import { getLegalActions } from '../game/betting';
import type { ActionRecord, GameState, LegalAction, PlayerState } from '../game/gameState';
import type { Position } from './preflopRanges';
import type { PlayerModel } from './playerModel';
import { positionForDetailed, type DetailedPosition } from './positionStrategy';

export type PublicPlayerView = Omit<PlayerState, 'holeCards'> & {
  /** Canonical fixed-seat label, included so consumers never remap seats. */
  detailedPosition?: DetailedPosition;
};
export type PublicSelfView = PublicPlayerView & { holeCards: Card[] };
export type PublicSidePot = { amount: number; eligiblePlayerIds: string[] };

export type PublicTableContext = {
  aiPlayerId: string;
  handId?: string;
  aiSeat: number;
  mode: GameState['mode'];
  tableSize: GameState['tableSize'];
  street: GameState['street'];
  dealerSeat: number;
  smallBlindSeat: number | null;
  bigBlindSeat: number | null;
  smallBlind: number;
  bigBlind: number;
  actingSeat: number | null;
  currentBet: number;
  lastFullRaise: number;
  potAmount: number;
  toCall: number;
  position: Position;
  /** V2 fixed-seat label; `position` remains the legacy coarse label for Task 3 compatibility. */
  detailedPosition?: DetailedPosition;
  communityCards: Card[];
  self: PublicSelfView;
  players: PublicPlayerView[];
  opponents: PublicPlayerView[];
  sidePots: PublicSidePot[];
  actionHistory: ActionRecord[];
  legalActions: LegalAction[];
  opponentModels: Readonly<Record<string, PlayerModel>>;
};

export function positionFor(state: GameState, player: PlayerState): Position {
  const occupiedSeats = state.initialOccupiedSeats ?? state.players.map((entry) => entry.seat);
  if (state.tableSize === 2 || new Set(occupiedSeats).size <= 2) return 'HEADS_UP';
  if (player.seat === state.smallBlindSeat || player.seat === state.bigBlindSeat) return 'BLINDS';
  // Position is fixed from the occupied seats at hand start. Folded seats
  // remain part of the ring and must not cause the remaining ranges to shift.
  const seats = [...(state.initialOccupiedSeats ?? state.players.map((entry) => entry.seat))].sort((left, right) => left - right);
  const dealerIndex = seats.indexOf(state.dealerSeat);
  const playerIndex = seats.indexOf(player.seat);
  if (dealerIndex < 0 || playerIndex < 0) return 'MIDDLE';
  const distance = (playerIndex - dealerIndex + seats.length) % seats.length;
  if (distance === 0) return 'LATE';
  if (state.tableSize >= 8) {
    if (distance <= 3) return 'EARLY';
    if (distance >= seats.length - 2) return 'LATE';
    return 'MIDDLE';
  }
  if (distance === seats.length - 1) return 'LATE';
  if (distance <= 3) return 'EARLY';
  return 'MIDDLE';
}

function publicPlayer(player: PlayerState, state: GameState): PublicPlayerView {
  const { holeCards: _hidden, ...view } = player;
  return { ...view, detailedPosition: positionForDetailed(state, player.id) };
}

export function toPublicContext(
  state: GameState,
  aiPlayerIdOrSeat: string | number,
  opponentModels: Readonly<Record<string, PlayerModel>> = {},
): PublicTableContext {
  const selfState = typeof aiPlayerIdOrSeat === 'number'
    ? state.players.find((player) => player.seat === aiPlayerIdOrSeat)
    : state.players.find((player) => player.id === aiPlayerIdOrSeat);
  if (!selfState) throw new Error(`Unknown AI player ${String(aiPlayerIdOrSeat)}`);
  const aiPlayerId = selfState.id;
  const players = state.players.map((player) => publicPlayer(player, state));
  const opponents = players.filter((player) => player.id !== aiPlayerId);
  const potAmount = state.players.reduce((sum, player) => sum + player.handContribution, 0);
  return {
    aiPlayerId,
    handId: state.handId ?? undefined,
    aiSeat: selfState.seat,
    mode: state.mode,
    tableSize: state.tableSize,
    street: state.street,
    dealerSeat: state.dealerSeat,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    actingSeat: state.actingSeat,
    currentBet: state.currentBet,
    lastFullRaise: state.lastFullRaise,
    potAmount,
    toCall: Math.max(0, state.currentBet - selfState.streetContribution),
    position: positionFor(state, selfState),
    detailedPosition: positionForDetailed(state, selfState.id),
    communityCards: [...state.communityCards],
    self: { ...publicPlayer(selfState, state), holeCards: [...selfState.holeCards] },
    players,
    opponents,
    sidePots: state.pots.map((pot) => ({ amount: pot.amount, eligiblePlayerIds: [...pot.eligiblePlayerIds] })),
    actionHistory: state.actionHistory.map((record) => ({ ...record })),
    legalActions: getLegalActions(state, aiPlayerId).map((action) => ({ ...action })),
    opponentModels: Object.fromEntries(Object.entries(opponentModels).map(([id, model]) => [id, { ...model, recentActions: [...model.recentActions] }])),
  };
}
