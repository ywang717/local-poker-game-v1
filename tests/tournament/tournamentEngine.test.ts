import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { startTournament, startTournamentHand, settleTournamentHand, advanceBlindLevel } from '../../src/tournament/tournamentEngine';

describe('mini tournament engine', () => {
  it('starts six players with equal 100BB stacks and no rebuy field', () => {
    const state = startTournament({ tournamentId: 't-1', mode: 'STANDARD', tableLevel: 2, humanId: 'hero' });
    expect(state.players).toHaveLength(6);
    expect(state.players.filter((player) => player.isHuman)).toHaveLength(1);
    expect(new Set(state.players.map((player) => player.stack))).toEqual(new Set([10_000]));
    expect(state.startingStack).toBe(10_000);
    expect('rebuy' in state).toBe(false);
  });

  it('upgrades blinds after eight completed hands', () => {
    const state = startTournament({ tournamentId: 't-2', mode: 'STANDARD', tableLevel: 1, humanId: 'hero' });
    const progressed = { ...state, handsAtLevel: 8 };
    const next = advanceBlindLevel(progressed);
    expect(next.blindLevel).toBe(2);
    expect(next.handsAtLevel).toBe(0);
    expect(next.bigBlind).toBeGreaterThan(state.bigBlind);
  });

  it('starts a hand at current blinds while keeping entry difficulty fixed', () => {
    const state = startTournament({ tournamentId: 't-3', mode: 'STANDARD', tableLevel: 2, humanId: 'hero' });
    const grown = { ...state, blindLevel: 4, smallBlind: state.smallBlind * 8, bigBlind: state.bigBlind * 8 };
    const hand = startTournamentHand(grown, () => 0.5);
    expect(hand.matchType).toBe('MINI_TOURNAMENT');
    expect(hand.tableLevel).toBe(2);
    expect(hand.bigBlind).toBe(grown.bigBlind);
    expect(hand.players).toHaveLength(6);
  });

  it('uses dynamic blind seats when only two tournament players remain', () => {
    const state = startTournament({ tournamentId: 't-hu', mode: 'STANDARD', tableLevel: 1, humanId: 'hero' });
    const headsUp = { ...state, players: [state.players[0], state.players[3]], dealerSeat: 3 };
    const hand = startTournamentHand(headsUp, () => 0.5);
    expect(hand.smallBlindSeat).toBe(3);
    expect(hand.bigBlindSeat).toBe(0);
    expect(hand.actingSeat).toBe(3);
  });

  it('removes zero-stack players only from a settled hand and ranks simultaneous eliminations deterministically', () => {
    const state = startTournament({ tournamentId: 't-4', mode: 'STANDARD', tableLevel: 1, humanId: 'hero' });
    const hand = startTournamentHand(state, () => 0.5);
    const unsettled = { ...hand, players: hand.players.map((player, index) => index < 2 ? { ...player, stack: 0 } : { ...player, stack: 7_500 }) };
    expect(() => settleTournamentHand(state, unsettled)).toThrow(/settled/i);
    const settled = { ...unsettled, street: 'SETTLEMENT' as const, players: unsettled.players };
    const next = settleTournamentHand(state, settled);
    expect(next.players).toHaveLength(4);
    expect(next.eliminations).toHaveLength(2);
    expect(next.rankings.map((ranking) => ranking.playerId)).toEqual(['hero', 'ai-1']);
    expect(next.rankings.map((ranking) => ranking.rank)).toEqual([6, 5]);
    expect(next.players.reduce((sum, player) => sum + player.stack, 0)).toBe(30_000);
  });
});
