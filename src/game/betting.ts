import { getActionOrder } from './dealer';
import type { GameState, LegalAction, PlayerAction, PlayerState, TransitionResult } from './gameState';

function cloneState(state: GameState): GameState {
  return {
    ...state,
    deck: [...state.deck],
    burnCards: [...state.burnCards],
    communityCards: [...state.communityCards],
    players: state.players.map((player) => ({ ...player, holeCards: [...player.holeCards] })),
    pots: state.pots.map((pot) => ({ ...pot, eligiblePlayerIds: [...pot.eligiblePlayerIds], winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })),
    refunds: (state.refunds ?? []).map((refund) => ({ ...refund })),
    actionHistory: [...state.actionHistory],
  };
}

function actionable(player: PlayerState): boolean {
  return !player.folded && !player.allIn && player.stack >= 0;
}

export function countActionablePlayers(state: GameState): number {
  return state.players.filter(actionable).length;
}

function shouldRunout(state: GameState): boolean {
  const livePlayers = state.players.filter((player) => !player.folded).length;
  return livePlayers >= 2 && countActionablePlayers(state) <= 1;
}

function isShortBigBlindDecision(state: GameState, player: PlayerState): boolean {
  return state.players.filter((entry) => !entry.folded).length >= 3
    && state.street === 'PRE_FLOP'
    && state.currentBet === state.bigBlind
    && !player.hasActedStreet
    && state.players.some((entry) => !entry.folded && entry.streetContribution < state.bigBlind);
}

function playerFor(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

function nextActionableSeat(state: GameState, fromSeat: number): number | null {
  if (state.street === 'SHOWDOWN' || state.street === 'SETTLEMENT') return null;
  const order = getActionOrder(state.tableSize, state.dealerSeat, state.street);
  const start = order.indexOf(fromSeat);
  for (let offset = 1; offset <= order.length; offset += 1) {
    const seat = order[(start + offset) % order.length];
    const player = state.players.find((entry) => entry.seat === seat);
    if (player && actionable(player)) return seat;
  }
  return null;
}

function onlyOneLivePlayer(state: GameState): boolean {
  return state.players.filter((player) => !player.folded).length <= 1;
}

function bettingRoundComplete(state: GameState): boolean {
  const livePlayers = state.players.filter((player) => !player.folded && !player.allIn);
  if (livePlayers.length === 0) return true;
  return livePlayers.every((player) => player.hasActedStreet && player.streetContribution === state.currentBet);
}

export function getLegalActions(state: GameState, playerId: string): LegalAction[] {
  const player = playerFor(state, playerId);
  if (!player || state.actingSeat !== player.seat || !actionable(player)) return [];
  if (state.street === 'SHOWDOWN' || state.street === 'SETTLEMENT') return [];
  const toCall = Math.max(0, state.currentBet - player.streetContribution);
  const onlyActionablePlayer = shouldRunout(state) && !isShortBigBlindDecision(state, player);
  const actions: LegalAction[] = [{ kind: 'fold' }];
  if (toCall > 0) actions.push({ kind: 'call', amount: Math.min(toCall, player.stack) });
  else actions.push({ kind: 'check' });
  const maxAmount = player.streetContribution + player.stack;
  if (!onlyActionablePlayer && state.currentBet === 0) {
    if (maxAmount >= state.bigBlind) actions.push({ kind: 'bet-to', minAmount: state.bigBlind, maxAmount });
  } else if (!onlyActionablePlayer && !player.hasActedStreet) {
    const minAmount = state.currentBet + state.lastFullRaise;
    if (maxAmount >= minAmount) actions.push({ kind: 'raise-to', minAmount, maxAmount });
  }
  // An all-in with enough chips to exceed the current price is a raise.  It
  // must obey the same reopen rule as raise-to; only an all-in call remains
  // legal after a short, non-reopening all-in raise.
  const allInIsCall = player.stack <= toCall;
  const raiseRightsOpen = !player.hasActedStreet;
  if (allInIsCall || (!onlyActionablePlayer && raiseRightsOpen)) {
    actions.push({ kind: 'all-in', amount: player.stack });
  }
  return actions;
}

function invalid(state: GameState, code: string, message: string): TransitionResult {
  return { ok: false, state, error: { code, message } };
}

function isLegalAmount(actions: readonly LegalAction[], action: PlayerAction): boolean {
  if (action.kind !== 'bet-to' && action.kind !== 'raise-to') return true;
  const candidate = actions.find((entry) => entry.kind === action.kind);
  if (!candidate || !('minAmount' in candidate)) return false;
  return action.amount >= candidate.minAmount && action.amount <= candidate.maxAmount;
}

export function applyAction(state: GameState, command: { playerId: string; action: PlayerAction }): TransitionResult {
  const player = playerFor(state, command.playerId);
  if (!player) return invalid(state, 'PLAYER_NOT_FOUND', `Unknown player ${command.playerId}`);
  if (state.actingSeat !== player.seat) return invalid(state, 'OUT_OF_TURN', 'Player is not the acting seat');
  const legal = getLegalActions(state, command.playerId);
  const legalKinds = legal.map((entry) => entry.kind);
  if (!legalKinds.includes(command.action.kind) || !isLegalAmount(legal, command.action)) {
    return invalid(state, 'ILLEGAL_ACTION', 'Action is not legal in the current state');
  }

  const next = cloneState(state);
  const nextPlayer = next.players.find((entry) => entry.id === command.playerId)!;
  const previousBet = next.currentBet;
  const stackBeforeAction = nextPlayer.stack;
  let targetContribution = nextPlayer.streetContribution;
  let paid = 0;
  if (command.action.kind === 'fold') {
    nextPlayer.folded = true;
    nextPlayer.status = 'FOLDED';
  } else if (command.action.kind === 'check') {
    // No chips move.
  } else if (command.action.kind === 'call') {
    paid = Math.min(Math.max(0, next.currentBet - nextPlayer.streetContribution), nextPlayer.stack);
    targetContribution += paid;
  } else if (command.action.kind === 'all-in') {
    paid = nextPlayer.stack;
    targetContribution += paid;
  } else {
    targetContribution = command.action.amount;
    paid = targetContribution - nextPlayer.streetContribution;
  }
  if (paid < 0 || paid > nextPlayer.stack) return invalid(state, 'INVALID_AMOUNT', 'Action exceeds available chips');
  nextPlayer.stack -= paid;
  nextPlayer.streetContribution = targetContribution;
  nextPlayer.handContribution += paid;
  nextPlayer.hasActedStreet = true;
  if (nextPlayer.stack === 0 && !nextPlayer.folded) {
    nextPlayer.allIn = true;
    nextPlayer.status = 'ALL_IN';
  }
  if (targetContribution > next.currentBet) {
    next.currentBet = targetContribution;
    const increase = targetContribution - previousBet;
    const isFullRaise = previousBet === 0 || increase >= next.lastFullRaise;
    if (isFullRaise) {
      next.lastFullRaise = increase;
      for (const other of next.players) {
        if (other.id !== nextPlayer.id && !other.folded && !other.allIn) other.hasActedStreet = false;
      }
    }
  }

  const increase = Math.max(0, targetContribution - previousBet);
  const isAggressiveRaise = increase > 0;
  const isAllInCall = command.action.kind === 'all-in' && !isAggressiveRaise;
  const isFullRaise = isAggressiveRaise && (previousBet === 0 || increase >= (state.lastFullRaise || state.bigBlind));
  next.actionHistory.push({
    playerId: command.playerId,
    street: next.street as 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER',
    action: command.action.kind,
    amount: paid,
    totalTo: targetContribution,
    stackBeforeAction,
    previousBet,
    increase,
    isAllInCall,
    isAggressiveRaise,
    facingBet: previousBet > player.streetContribution,
    isFullRaise,
  });

  if (onlyOneLivePlayer(next)) {
    next.actingSeat = null;
    next.street = 'SHOWDOWN';
    return { ok: true, state: next };
  }
  if (bettingRoundComplete(next)) {
    return { ok: true, state: advanceStreet(next) };
  }
  next.actingSeat = nextActionableSeat(next, nextPlayer.seat);
  if (next.actingSeat === null) return { ok: true, state: advanceStreet(next) };
  return { ok: true, state: next };
}

function draw(state: GameState, count: number): void {
  state.deckIndex += count;
}

export function advanceStreet(state: GameState): GameState {
  const next = cloneState(state);
  if (next.street === 'SHOWDOWN' || next.street === 'SETTLEMENT') return next;
  for (const player of next.players) {
    player.streetContribution = 0;
    player.hasActedStreet = false;
  }
  next.currentBet = 0;
  next.lastFullRaise = next.bigBlind;
  const reveal = (count: number, street: 'FLOP' | 'TURN' | 'RIVER'): void => {
    next.burnCards.push(next.deck[next.deckIndex]);
    next.deckIndex += 1;
    next.communityCards.push(...next.deck.slice(next.deckIndex, next.deckIndex + count));
    next.deckIndex += count;
    next.street = street;
  };
  if (next.street === 'PRE_FLOP') reveal(3, 'FLOP');
  else if (next.street === 'FLOP') reveal(1, 'TURN');
  else if (next.street === 'TURN') reveal(1, 'RIVER');
  else {
    next.street = 'SHOWDOWN';
    next.actingSeat = null;
    return next;
  }
  const actionablePlayers = next.players.filter(actionable);
  if (actionablePlayers.length <= 1 || next.players.filter((player) => !player.folded).length <= 1) {
    return advanceStreet(next);
  }
  next.actingSeat = getActionOrder(next.tableSize, next.dealerSeat, next.street)
    .map((seat) => next.players.find((player) => player.seat === seat))
    .find((player): player is PlayerState => Boolean(player && actionable(player)))?.seat ?? null;
  return next;
}
