import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { applyAction, createTable, startHand } from '../../src/game/gameEngine';
import { settleGameState } from '../../src/game/handSettlement';

describe('hand settlement integration', () => {
  it('settles a fold before the board is complete and conserves chips', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    const folded = applyAction(state, { playerId: 'human', action: { kind: 'fold' } });
    expect(folded.ok).toBe(true);
    const settled = settleGameState(folded.state);
    expect(settled.state.street).toBe('SETTLEMENT');
    expect(settled.result.totalPot).toBe(settled.result.totalAwarded);
    const stacks = settled.state.players.reduce((sum, player) => sum + player.stack, 0);
    expect(stacks).toBe(200);
    expect(settled.state.players.find((player) => player.id === 'ai')?.stack).toBe(105);
  });

  it('returns an uncalled all-in excess to the bettor', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 500 }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    state.street = 'SHOWDOWN';
    state.communityCards = [
      { id: '2c', rank: 2, suit: 'clubs' }, { id: '3c', rank: 3, suit: 'clubs' }, { id: '4c', rank: 4, suit: 'clubs' },
      { id: '8d', rank: 8, suit: 'diamonds' }, { id: '9d', rank: 9, suit: 'diamonds' },
    ];
    state.players = state.players.map((player) => player.id === 'human'
      ? { ...player, stack: 0, handContribution: 100, streetContribution: 0, allIn: true }
      : { ...player, stack: 0, handContribution: 500, streetContribution: 0, allIn: true });
    const settled = settleGameState(state);
    expect(settled.result.totalPot).toBe(200);
    expect(settled.result.totalRefunded).toBe(400);
    expect(settled.state.players.find((player) => player.id === 'ai')?.stack).toBe(500);
    expect(settled.state.pots).toHaveLength(1);
  });
});
