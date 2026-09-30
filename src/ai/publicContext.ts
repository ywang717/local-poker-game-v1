import type { Card } from '../game/cards';
import { getLegalActions } from '../game/betting';
import type { ActionRecord, GameState, LegalAction, PlayerState } from '../game/gameState';
import type { Position } from './preflopRanges';
import type { PlayerModel } from './playerModel';

export type PublicPlayerView = Omit<PlayerState, 'holeCards'>;
export type PublicSelfView = PublicPlayerView & { holeCards: Card[] };
export type PublicSidePot = { amount: number; eligiblePlayerIds: string[] };

export type PublicTableContext = {
  aiPlayerId: string;
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
  communityCards: Card[];
  self: PublicSelfView;
  players: PublicPlayerView[];
  opponents: PublicPlayerView[];
  sidePots: PublicSidePot[];
  actionHistory: ActionRecord[];
  legalActions: LegalAction[];
  opponentModels: Readonly<Record<string, PlayerModel>>;
};

function positionFor(state: GameState, player: PlayerState): Position {
  if (state.tableSize === 2) return 'HEADS_UP';
  if (player.seat === state.smallBlindSeat || player.seat === state.bigBlindSeat) return 'BLINDS';
  const seats = state.players.filter((entry) => !entry.folded).map((entry) => entry.seat).sort((left, right) => left - right);
  const dealerIndex = seats.indexOf(state.dealerSeat);
  const playerIndex = seats.indexOf(player.seat);
  if (dealerIndex < 0 || playerIndex < 0) return 'MIDDLE';
  const distance = (playerIndex - dealerIndex + seats.length) % seats.length;
  if (state.tableSize >= 8 && distance <= 2) return 'EARLY';
  if (distance >= seats.length - 2) return 'LATE';
  return distance <= Math.ceil(seats.length / 2) ? 'MIDDLE' : 'LATE';
}

function publicPlayer(player: PlayerState): PublicPlayerView {
  const { holeCards: _hidden, ...view } = player;
  return { ...view };
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
  const players = state.players.map(publicPlayer);
  const opponents = players.filter((player) => player.id !== aiPlayerId);
  const potAmount = state.players.reduce((sum, player) => sum + player.handContribution, 0);
  return {
    aiPlayerId,
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
    communityCards: [...state.communityCards],
    self: { ...publicPlayer(selfState), holeCards: [...selfState.holeCards] },
    players,
    opponents,
    sidePots: state.pots.map((pot) => ({ amount: pot.amount, eligiblePlayerIds: [...pot.eligiblePlayerIds] })),
    actionHistory: state.actionHistory.map((record) => ({ ...record })),
    legalActions: getLegalActions(state, aiPlayerId).map((action) => ({ ...action })),
    opponentModels: Object.fromEntries(Object.entries(opponentModels).map(([id, model]) => [id, { ...model, recentActions: [...model.recentActions] }])),
  };
}
