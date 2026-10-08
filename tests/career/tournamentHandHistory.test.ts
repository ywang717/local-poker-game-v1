import { describe, expect, it } from 'vitest';
import { createCareer, recordHand } from '../../src/career/careerService';
import { handSummary } from '../../src/App';
import { startTournament } from '../../src/tournament/tournamentEngine';
import { startTournamentHand } from '../../src/tournament/tournamentEngine';

function settledTournamentHand() {
  const tournament = startTournament({ tournamentId: 'history-tournament', humanId: 'human', humanName: '玩家', tableLevel: 1 });
  const hand = startTournamentHand(tournament, () => 0.5);
  const human = hand.players.find((player) => player.isHuman)!;
  return {
    ...hand,
    street: 'SETTLEMENT' as const,
    pots: [{ amount: 150, eligiblePlayerIds: [human.id], winnerPlayerIds: [human.id], awards: [{ playerId: human.id, amount: 150 }] }],
  };
}

describe('tournament hand history', () => {
  it('records a settled tournament hand for review without counting tournament chips as cash profit', () => {
    const summary = handSummary(settledTournamentHand())!;
    expect(summary).toMatchObject({ matchType: 'MINI_TOURNAMENT', tournamentId: 'history-tournament', tableLevel: 1 });
    const original = createCareer('玩家');
    const recorded = recordHand(original, summary);
    expect(recorded.handHistory).toHaveLength(1);
    expect(recorded.handHistory[0].playerNames?.human).toBe('玩家');
    expect(recorded.statistics).toEqual(original.statistics);
    expect(recordHand(recorded, summary).handHistory).toHaveLength(1);
  });

  it('keeps the entry level after tournament blinds have advanced', () => {
    const hand = settledTournamentHand();
    expect(handSummary({ ...hand, bigBlind: 1_000 })?.tableLevel).toBe(1);
  });
});
