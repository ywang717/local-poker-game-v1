import { describe, expect, it } from 'vitest';
import { handSummary } from '../../src/App';
import { createTable, startHand } from '../../src/game/gameEngine';
import { createDeck } from '../../src/game/cards';

function settledState() {
  const table = createTable({
    mode: 'STANDARD', tableSize: 3, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
    players: [
      { id: 'human', name: '玩家', seat: 0, stack: 90, isHuman: true },
      { id: 'ai-1', name: 'AI 1', seat: 1, stack: 90 },
      { id: 'ai-2', name: 'AI 2', seat: 2, stack: 90 },
    ],
  });
  const state = startHand(table, createDeck('STANDARD'));
  state.street = 'SETTLEMENT';
  state.pots = [{ amount: 30, eligiblePlayerIds: ['human', 'ai-1'], winnerPlayerIds: ['human'], awards: [{ playerId: 'human', amount: 30 }] }];
  state.players = state.players.map((player) => player.id === 'ai-1' ? { ...player, allIn: true } : player);
  return state;
}

describe('human all-in summary', () => {
  it('does not count an AI all-in as the human all-in', () => {
    const summary = handSummary(settledState());
    expect(summary?.allIn).toBe(false);
    expect(summary?.allInWon).toBe(false);
  });

  it('counts only the human all-in action and records a win', () => {
    const state = settledState();
    const human = state.players.find((player) => player.isHuman)!;
    state.actionHistory = [{ playerId: human.id, street: 'RIVER', action: 'all-in', amount: 90, totalTo: 100 }];
    const summary = handSummary(state);
    expect(summary?.allIn).toBe(true);
    expect(summary?.allInWon).toBe(true);
  });
});
