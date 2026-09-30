import { buildPots } from './sidePot';
import { evaluateHand, type HandEvaluation } from './handEvaluator';
import { settlePots, type SettlementResult } from './settlement';
import type { GameState, PotState } from './gameState';

export type HandSettlement = {
  state: GameState;
  result: SettlementResult;
  evaluations: Readonly<Record<string, HandEvaluation>>;
};

function cloneState(state: GameState): GameState {
  return {
    ...state,
    deck: [...state.deck],
    burnCards: [...state.burnCards],
    communityCards: [...state.communityCards],
    players: state.players.map((player) => ({ ...player, holeCards: [...player.holeCards] })),
    pots: state.pots.map((pot) => ({ ...pot, eligiblePlayerIds: [...pot.eligiblePlayerIds], winnerPlayerIds: [...pot.winnerPlayerIds], awards: pot.awards.map((award) => ({ ...award })) })),
    actionHistory: [...state.actionHistory],
  };
}

function potState(pot: SettlementResult['pots'][number]): PotState {
  return {
    amount: pot.amount,
    eligiblePlayerIds: [...pot.eligiblePlayerIds],
    winnerPlayerIds: [...pot.winnerPlayerIds],
    awards: pot.awards.map((award) => ({ ...award })),
  };
}

/** Settle a SHOWDOWN state and return a new immutable state. */
export function settleGameState(state: GameState): HandSettlement {
  if (state.street !== 'SHOWDOWN' && state.street !== 'SETTLEMENT') throw new Error('Hand must be at showdown before settlement');
  if (state.street === 'SETTLEMENT') {
    const pots = state.pots.map((pot) => ({
      amount: pot.amount,
      fromContribution: 0,
      toContribution: 0,
      contributorPlayerIds: [...pot.eligiblePlayerIds],
      eligiblePlayerIds: [...pot.eligiblePlayerIds],
      winnerPlayerIds: [...pot.winnerPlayerIds],
      awards: pot.awards.map((award) => ({ ...award })),
    }));
    const result: SettlementResult = {
      pots: pots as SettlementResult['pots'],
      awards: state.pots.flatMap((pot) => pot.awards.map((award) => ({ ...award }))),
      totalPot: state.pots.reduce((sum, pot) => sum + pot.amount, 0),
      totalAwarded: state.pots.reduce((sum, pot) => sum + pot.awards.reduce((potSum, award) => potSum + award.amount, 0), 0),
    };
    return { state: cloneState(state), result, evaluations: {} };
  }

  const participants = state.players.map((player) => ({
    id: player.id,
    seat: player.seat,
    contribution: player.handContribution,
    folded: player.folded,
  }));
  const pots = buildPots(participants);
  const evaluations: Record<string, HandEvaluation> = {};
  if (state.communityCards.length >= 5) {
    for (const player of state.players) {
      if (!player.folded) evaluations[player.id] = evaluateHand(player.holeCards, state.communityCards, state.mode);
    }
  }
  const result = settlePots(
    pots,
    state.players.map((player) => ({ id: player.id, seat: player.seat, folded: player.folded })),
    evaluations,
    state.dealerSeat,
    state.mode,
  );
  const awardsByPlayer = new Map<string, number>();
  for (const award of result.awards) awardsByPlayer.set(award.playerId, (awardsByPlayer.get(award.playerId) ?? 0) + award.amount);
  const next = cloneState(state);
  next.players = next.players.map((player) => ({
    ...player,
    stack: player.stack + (awardsByPlayer.get(player.id) ?? 0),
    status: player.folded ? 'FOLDED' : player.allIn ? 'ALL_IN' : 'ACTIVE',
  }));
  next.pots = result.pots.map(potState);
  next.street = 'SETTLEMENT';
  next.actingSeat = null;
  next.currentBet = 0;
  return { state: next, result, evaluations };
}
