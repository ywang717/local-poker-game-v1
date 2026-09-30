import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { positionForDetailed } from '../../src/ai/positionStrategy';

describe('detailed fixed positions', () => {
  it('maps six-player seats to UTG, HJ, CO, BTN and blinds', () => {
    const state = startHand(createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 })),
    }), createDeck('STANDARD'));
    expect(state.players.map((player) => positionForDetailed(state, player.id))).toEqual([
      'BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO',
    ]);
    const folded = { ...state, players: state.players.map((player) => player.id === 'p3' ? { ...player, folded: true, status: 'FOLDED' as const } : player) };
    expect(folded.players.map((player) => positionForDetailed(folded, player.id))).toEqual([
      'BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO',
    ]);
  });

  it('maps heads-up and sparse occupied seats without shifting after a fold', () => {
    const state = startHand(createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 2,
      players: [
        { id: 'btn', seat: 2, stack: 100 }, { id: 'sb', seat: 4, stack: 100 },
        { id: 'bb', seat: 5, stack: 100 }, { id: 'utg', seat: 0, stack: 100 },
        { id: 'co', seat: 1, stack: 100 },
      ],
    }), createDeck('STANDARD'));
    expect(positionForDetailed(state, 'btn')).toBe('BTN');
    expect(positionForDetailed(state, 'utg')).toBe('UTG');
    expect(positionForDetailed(state, 'co')).toBe('CO');
    expect(positionForDetailed({ ...state, players: state.players.filter((p) => p.id !== 'utg') }, 'co')).toBe('CO');
  });
});
