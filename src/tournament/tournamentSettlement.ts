import type { TournamentFinishResult, TournamentRewardTransaction, TournamentState } from './types';

function cloneState(state: TournamentState): TournamentState {
  return { ...state, players: state.players.map((player) => ({ ...player })), eliminations: state.eliminations.map((item) => ({ ...item })), rankings: state.rankings.map((item) => ({ ...item })) };
}

/** Finish exactly when one player remains and guard the champion reward. */
export function finishTournament(input: TournamentState): TournamentFinishResult {
  const state = cloneState(input);
  if (state.players.length !== 1) throw new Error('Tournament must have exactly one remaining player');
  const champion = state.players[0];
  if (state.championId && state.championId !== champion.id) throw new Error('Tournament champion does not match the remaining player');
  if (!champion) throw new Error('Tournament must have exactly one remaining player');
  state.championId = champion.id;
  state.players = state.players.filter((player) => player.id === champion.id);
  if (!state.rankings.some((ranking) => ranking.playerId === champion.id)) {
    state.rankings.push({ playerId: champion.id, rank: 1 });
  }
  if (state.rewardPaid) return { state, championId: champion.id };
  state.rewardPaid = true;
  if (!champion.isHuman) return { state, championId: champion.id };
  const rewardTransaction: TournamentRewardTransaction = {
    transactionId: `${state.tournamentId}:champion-reward`, sessionId: state.tournamentId,
    kind: 'TOURNAMENT_CHAMPION_REWARD', amount: state.entryFee * 10, status: 'APPLIED', createdAt: new Date().toISOString(),
  };
  return { state, championId: champion.id, rewardTransaction };
}

/**
 * End a paid tournament when the human explicitly leaves before a champion is
 * determined. The player receives the last live rank and never receives the
 * champion reward. The operation is safe to repeat after the player has
 * already been removed by a settled hand.
 */
export function forfeitTournament(input: TournamentState): TournamentState {
  const state = cloneState(input);
  const human = state.players.find((player) => player.isHuman)
    ?? state.players.find((player) => !player.id.startsWith('ai-'));
  const existing = state.rankings.find((ranking) => ranking.playerId === human?.id)
    ?? state.eliminations.find((entry) => !entry.playerId.startsWith('ai-'));
  if (existing) {
    state.spectator = true;
    return state;
  }
  if (!human) {
    state.spectator = true;
    return state;
  }
  const rank = state.players.length;
  state.players = state.players.filter((player) => player.id !== human.id);
  state.rankings.push({ playerId: human.id, rank });
  state.eliminations.push({ playerId: human.id, rank, handNumber: state.handNumber, stackBeforeHand: human.stack, seat: human.seat });
  state.spectator = true;
  return state;
}

export type { TournamentRewardTransaction };
export { startTournament } from './tournamentEngine';
