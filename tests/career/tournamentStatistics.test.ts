import { describe, expect, it } from 'vitest';
import { createCareer, enterTournament } from '../../src/career/careerService';
import { useCareerStore } from '../../src/store/careerStore';
import { finishTournament, startTournament } from '../../src/tournament/tournamentEngine';
import { recordTournamentFinish } from '../../src/career/careerService';

describe('tournament career accounting', () => {
  it('charges an affordable unlocked entry once and creates six seats', () => {
    const career = createCareer('玩家');
    const first = enterTournament(career, 'STANDARD', 1, 'entry-once');
    expect(first.tournament.players).toHaveLength(6);
    expect(first.career.currentFunds).toBe(5_000);
    expect(first.career.financialTransactions.filter((entry) => entry.kind === 'TOURNAMENT_ENTRY')).toHaveLength(1);
    useCareerStore.setState({ career });
    const stored = useCareerStore.getState().enterTournament('STANDARD', 1, 'store-entry-once');
    expect(stored.players).toHaveLength(6);
    expect(() => useCareerStore.getState().enterTournament('SHORT_DECK', 1, 'store-entry-once')).toThrow(/already been used/i);
    expect(useCareerStore.getState().career?.currentFunds).toBe(5_000);
  });

  it('records a human tournament entry and champion reward once', () => {
    const career = createCareer('玩家');
    const tournament = startTournament({ tournamentId: 'career-t1', humanId: 'human', entryFee: 5_000 });
    const terminal = { ...tournament, players: [tournament.players[0]], rankings: [{ playerId: 'human', rank: 1 }], championId: 'human' as const, rewardPaid: true };
    const first = recordTournamentFinish(career, terminal);
    const second = recordTournamentFinish(first, terminal);
    expect(first.currentFunds).toBe(55_000);
    expect(first.tournamentStatistics).toEqual({ tournamentsPlayed: 1, tournamentsWon: 1, totalEntryFees: 5_000, totalRewards: 50_000, totalNet: 45_000, bestFinish: 1 });
    expect(second).toEqual(first);
    expect(first.financialTransactions.filter((entry) => entry.sessionId === 'career-t1')).toHaveLength(2);
  });

  it('records an AI champion and spectator rank without cash profit', () => {
    const career = createCareer('玩家');
    const tournament = startTournament({ tournamentId: 'career-t2', humanId: 'human', entryFee: 5_000 });
    const terminal = { ...tournament, players: [{ ...tournament.players[1], stack: 500 }], rankings: [{ playerId: 'human', rank: 2 }, { playerId: 'ai-1', rank: 1 }], championId: 'ai-1', rewardPaid: true, spectator: true };
    const result = recordTournamentFinish(career, terminal);
    expect(result.currentFunds).toBe(5_000);
    expect(result.tournamentStatistics).toMatchObject({ tournamentsPlayed: 1, tournamentsWon: 0, totalEntryFees: 5_000, totalRewards: 0, totalNet: -5_000, bestFinish: 2 });
  });

  it('restores the minimum career funds after losing with no remaining balance', () => {
    const lowFunds = { ...createCareer('玩家'), currentFunds: 5_000 };
    const entered = enterTournament(lowFunds, 'STANDARD', 1, 'bankruptcy-tournament');
    expect(entered.career.currentFunds).toBe(0);
    const terminal = {
      ...entered.tournament,
      players: [{ ...entered.tournament.players[1], stack: entered.tournament.startingStack }],
      rankings: [{ playerId: 'human', rank: 2 }, { playerId: 'ai-1', rank: 1 }],
      championId: 'ai-1',
      rewardPaid: true,
      spectator: true,
    };

    const result = recordTournamentFinish(entered.career, terminal);

    expect(result.currentFunds).toBe(5_000);
    expect(result.bankruptcyCount).toBe(1);
    expect(result.tournamentStatistics.totalNet).toBe(-5_000);
  });
});
