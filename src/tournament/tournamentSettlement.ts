import type { TournamentFinishResult, TournamentRewardTransaction, TournamentState } from './types';

function cloneState(state: TournamentState): TournamentState {
  return { ...state, players: state.players.map((player) => ({ ...player })), eliminations: state.eliminations.map((item) => ({ ...item })), rankings: state.rankings.map((item) => ({ ...item })) };
}

/** Finish exactly when one player remains and guard the champion reward. */
export function finishTournament(input: TournamentState): TournamentFinishResult {
  const state = cloneState(input);
  const champion = state.championId
    ? state.players.find((player) => player.id === state.championId) ?? input.players.find((player) => player.id === state.championId)
    : state.players.length === 1 ? state.players[0] : undefined;
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

export type { TournamentRewardTransaction };
export { startTournament } from './tournamentEngine';
