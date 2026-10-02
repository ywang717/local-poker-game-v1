import { describe, expect, it } from 'vitest';
import { fastSimulateTournamentToEnd } from '../../src/tournament/fastSimulation';
import { startTournament } from '../../src/tournament/tournamentEngine';

describe('spectator tournament fast simulation', () => {
  it('runs the remaining real AI hands to one champion after the human is fourth', () => {
    const started = startTournament({ tournamentId: 'fast-sim-test', humanId: 'human', tableLevel: 1 });
    const remaining = started.players.filter((player) => !player.isHuman).slice(0, 3).map((player) => ({ ...player, stack: 300 }));
    const spectator = {
      ...started,
      players: remaining,
      spectator: true,
      rankings: [{ playerId: 'human', rank: 4 }],
      eliminations: [{ playerId: 'human', rank: 4, handNumber: 2, stackBeforeHand: 100, seat: 0 }],
    };
    const result = fastSimulateTournamentToEnd({ tournament: spectator, seed: 0x2102_0001 });
    expect(result.players).toHaveLength(1);
    expect(result.championId).toMatch(/^ai-/);
    expect(result.rankings.find((entry) => entry.playerId === 'human')?.rank).toBe(4);
    expect(result.rewardPaid).toBe(true);
  });
});
