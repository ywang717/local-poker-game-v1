import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { chooseActionForState } from '../../src/ai/turn';

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
});
