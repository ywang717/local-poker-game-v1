import { describe, expect, it } from 'vitest';
import { finishTournament } from '../../src/tournament/tournamentSettlement';
import { startTournament } from '../../src/tournament/tournamentEngine';

describe('mini tournament settlement', () => {
  it('finishes with exactly one champion and pays a human reward once', () => {
    const state = startTournament({ tournamentId: 't-5', mode: 'STANDARD', tableLevel: 1, humanId: 'hero' });
    const terminal = { ...state, players: [{ ...state.players[0], stack: state.startingStack }], rankings: state.players.slice(1).map((player, index) => ({ playerId: player.id, rank: 6 - index })), };
    const first = finishTournament(terminal);
    expect(first.championId).toBe('hero');
    expect(first.state.championId).toBe('hero');
    expect(first.rewardTransaction?.kind).toBe('TOURNAMENT_CHAMPION_REWARD');
    expect(first.rewardTransaction?.amount).toBe(state.entryFee * 10);
    expect(finishTournament(first.state).rewardTransaction).toBeUndefined();
  });

  it('does not create a reward transaction for an AI champion', () => {
    const state = startTournament({ tournamentId: 't-6', mode: 'STANDARD', tableLevel: 1, humanId: 'hero' });
    const ai = state.players[1];
    const terminal = { ...state, players: [{ ...ai, stack: state.startingStack, isHuman: false }], rankings: [{ playerId: 'hero', rank: 6 }] };
    const result = finishTournament(terminal);
    expect(result.championId).toBe(ai.id);
    expect(result.rewardTransaction).toBeUndefined();
    expect(result.state.rewardPaid).toBe(true);
  });

  it('rejects a preset champion while multiple players are still live', () => {
    const state = startTournament({ tournamentId: 't-multi-live', mode: 'STANDARD', tableLevel: 1, humanId: 'hero' });
    expect(() => finishTournament({ ...state, championId: 'hero' })).toThrow(/exactly one remaining player/i);
  });
});
