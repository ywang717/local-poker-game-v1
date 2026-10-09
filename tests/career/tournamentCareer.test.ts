import { describe, expect, it } from 'vitest';
import { createCareer, enterTournament, recordHand, recordTournamentFinish } from '../../src/career/careerService';
import { createCard } from '../../src/game/cards';
import type { HandSummary } from '../../src/career/handHistory';
import { forfeitTournament } from '../../src/tournament/tournamentSettlement';

import { tournamentSummary } from '../helpers/tournamentSummary';

describe('tournament career', () => {
  it('counts tournament win/split/loss/fold without changing cash stats or counting the same hand twice', () => {
    const original = createCareer('玩家');
    let career = original;
    for (const [i, result] of ['WIN', 'SPLIT', 'LOSS', 'FOLD'].entries()) {
      const hand = tournamentSummary(`h${i}`, { result: result as HandSummary['result'] });
      career = recordHand(career, hand);
      career = recordHand(career, hand);
    }
    expect(career.tournamentStatistics.byStartingHand.STANDARD.AA).toEqual({ hands: 4, wins: 1, splits: 1, losses: 2 });
    expect(career.statistics).toEqual(original.statistics);
    expect(original.tournamentStatistics.byStartingHand.STANDARD).toEqual({});
  });

  it('separates modes and recognizes paired, suited and offsuit hands with T notation', () => {
    let career = createCareer('玩家');
    career = recordHand(career, tournamentSummary('std', { playerHoleCards: [createCard(14, 'spades'), createCard(13, 'spades')] }));
    career = recordHand(career, tournamentSummary('short', { mode: 'SHORT_DECK', result: 'SPLIT', playerHoleCards: [createCard(10, 'hearts'), createCard(14, 'spades')] }));
    career = recordHand(career, tournamentSummary('short-pair', { mode: 'SHORT_DECK', result: 'FOLD', playerHoleCards: [createCard(10, 'hearts'), createCard(10, 'spades')] }));
    expect(career.tournamentStatistics.byStartingHand.STANDARD.AKs).toEqual({ hands: 1, wins: 1, splits: 0, losses: 0 });
    expect(career.tournamentStatistics.byStartingHand.SHORT_DECK.ATo).toEqual({ hands: 1, wins: 0, splits: 1, losses: 0 });
    expect(career.tournamentStatistics.byStartingHand.SHORT_DECK.TT.losses).toBe(1);
    expect(career.tournamentStatistics.byStartingHand.STANDARD.ATo).toBeUndefined();
  });

  it('keeps lifetime hand counts after the last-500 history window has rolled over', () => {
    let career = createCareer('玩家');
    for (let i = 0; i < 505; i++) career = recordHand(career, tournamentSummary(`many-${i}`));
    expect(career.handHistory).toHaveLength(500);
    expect(career.tournamentStatistics.byStartingHand.STANDARD.AA.hands).toBe(505);
    expect(recordHand(career, tournamentSummary('many-0')).tournamentStatistics.byStartingHand.STANDARD.AA.hands).toBe(505);
  });

  it('records champion rank, fees, reward and top-three exactly once', () => {
    const entered = enterTournament(createCareer('玩家'), 'SHORT_DECK', 1, 'champ');
    const state = { ...entered.tournament, players: [entered.tournament.players[0]], championId: 'human', rankings: [{ playerId: 'human', rank: 1 }], handNumber: 20 };
    const first = recordTournamentFinish(entered.career, state);
    expect(first.tournamentStatistics.topThreeFinishes).toBe(1);
    expect(first.tournamentHistory[0]).toMatchObject({ tournamentId: 'champ', mode: 'SHORT_DECK', tableLevel: 1, humanRank: 1, entryFee: 5000, reward: 50000, net: 45000, status: 'COMPLETED', championName: '玩家' });
    expect(first.currentFunds).toBe(55000);
    expect(recordTournamentFinish(first, state)).toEqual(first);
  });

  it('records voluntary exit without inventing a champion and preserves an already eliminated rank', () => {
    const entered = enterTournament(createCareer('玩家'), 'STANDARD', 1, 'exit');
    const result = recordTournamentFinish(entered.career, forfeitTournament(entered.tournament));
    expect(result.tournamentHistory[0]).toMatchObject({ humanRank: 6, status: 'EXITED', reward: 0, net: -5000 });
    expect(result.tournamentHistory[0].championName).toBeUndefined();
    expect(result.tournamentStatistics.topThreeFinishes).toBe(0);
    const eliminated = { ...entered.tournament, players: entered.tournament.players.filter(p => !p.isHuman), rankings: [{ playerId: 'human', rank: 3 }], spectator: true };
    const spectatorExit = recordTournamentFinish(entered.career, forfeitTournament(eliminated));
    expect(spectatorExit.tournamentHistory[0].humanRank).toBe(3);
    expect(spectatorExit.tournamentStatistics.topThreeFinishes).toBe(1);
  });

  it('keeps the newest 500 match records without losing lifetime totals or result idempotency', () => {
    let career = createCareer('玩家');
    const initial = enterTournament(career, 'STANDARD', 1, 'm0').tournament;
    for (let i = 0; i < 505; i++) {
      career = recordTournamentFinish(career, { ...initial, tournamentId: `m${i}`, championId: 'ai-1', rankings: [{ playerId: 'human', rank: 2 }] });
    }
    expect(career.tournamentHistory).toHaveLength(500);
    expect(career.tournamentHistory[0].tournamentId).toBe('m504');
    expect(career.tournamentStatistics.tournamentsPlayed).toBe(505);
    expect(recordTournamentFinish(career, { ...initial, championId: 'ai-1' }).tournamentStatistics.tournamentsPlayed).toBe(505);
  });
  it.each([
    ['STANDARD', 'AA', [createCard(14, 'spades'), createCard(14, 'hearts')]],
    ['STANDARD', 'AKs', [createCard(14, 'spades'), createCard(13, 'spades')]],
    ['STANDARD', 'AKo', [createCard(14, 'spades'), createCard(13, 'hearts')]],
    ['SHORT_DECK', 'AA', [createCard(14, 'spades'), createCard(14, 'hearts')]],
    ['SHORT_DECK', 'AKs', [createCard(14, 'spades'), createCard(13, 'spades')]],
    ['SHORT_DECK', 'AKo', [createCard(14, 'spades'), createCard(13, 'hearts')]],
  ] as const)('records all four result types separately for %s %s', (mode, notation, cards) => {
    let career = createCareer('玩家');
    for (const result of ['WIN', 'SPLIT', 'LOSS', 'FOLD'] as const) {
      career = recordHand(career, tournamentSummary(`${mode}-${notation}-${result}`, { mode, playerHoleCards: [...cards], result }));
    }
    expect(career.tournamentStatistics.byStartingHand[mode][notation]).toEqual({ hands: 4, wins: 1, splits: 1, losses: 2 });
    expect(career.statistics.overall.totalHands).toBe(0);
  });

});
