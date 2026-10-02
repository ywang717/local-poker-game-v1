import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { chooseActionForState } from '../../src/ai/turn';
import { buildTournamentDecisionOptions } from '../../src/ai/tournamentStrategy';
import { PERSONALITIES } from '../../src/ai/personalities';
import { toPublicContext } from '../../src/ai/publicContext';
import { startTournament } from '../../src/tournament/tournamentEngine';

describe('AI turn integration', () => {
  it('returns no action for a human turn and a legal action for an AI turn', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    expect(state.actingSeat).toBe(0);
    expect(chooseActionForState(state, () => 0.25)).toBeNull();

    const aiTurn = { ...state, actingSeat: 1 };
    const decision = chooseActionForState(aiTurn, () => 0.25);
    expect(decision?.playerId).toBe('ai');
    expect(decision?.action).toBeDefined();
  });

  it('uses tournament entrants remaining instead of folded seats', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      matchType: 'MINI_TOURNAMENT', tableLevel: 2,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100, isHuman: seat === 0 })),
    });
    const started = startHand(table, createDeck('STANDARD'));
    const tournamentState = startTournament({ tournamentId: 'turn-test', humanId: 'p0', tableLevel: 2 });
    const withFolds = {
      ...started,
      tournamentPlayersRemaining: 6,
      tournamentState,
      players: started.players.map((player, index) => index > 1 ? { ...player, folded: true, status: 'FOLDED' as const } : player),
    };
    const options = buildTournamentDecisionOptions(withFolds, 'p0');
    expect(options.tournament?.playersRemaining).toBe(6);
    const nextTournament = { ...withFolds, tournamentPlayersRemaining: 4, tournamentState: { ...withFolds.tournamentState!, players: withFolds.tournamentState!.players.slice(0, 4) } };
    expect(buildTournamentDecisionOptions(nextTournament, 'p0').tournament?.playersRemaining).toBe(4);
  });

  it('keeps the assigned personality on the AI player and passes it into the public context', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100, isHuman: seat === 0 })),
    });
    expect(table.players.filter((player) => !player.isHuman).map((player) => player.personalityId)).toEqual([
      PERSONALITIES.BALANCED.id, PERSONALITIES.TIGHT.id, PERSONALITIES.LOOSE_AGGRESSIVE.id, PERSONALITIES.CALLING.id, PERSONALITIES.BALANCED.id,
    ]);
    const state = startHand(table, createDeck('STANDARD'));
    const context = toPublicContext(state, 'p1');
    expect(context.self.personalityId).toBe(PERSONALITIES.BALANCED.id);
    expect(context.players.find((player) => player.id === 'p5')?.personalityId).toBe(PERSONALITIES.BALANCED.id);
  });
});
