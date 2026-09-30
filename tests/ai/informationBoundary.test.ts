import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { toPublicContext } from '../../src/ai/publicContext';

describe('AI information boundary', () => {
  it.each([
    [2, ['HEADS_UP', 'HEADS_UP']],
    [3, ['LATE', 'BLINDS', 'BLINDS']],
    [6, ['LATE', 'BLINDS', 'BLINDS', 'EARLY', 'MIDDLE', 'LATE']],
    [9, ['LATE', 'BLINDS', 'BLINDS', 'EARLY', 'MIDDLE', 'MIDDLE', 'MIDDLE', 'LATE', 'LATE']],
  ] as const)('keeps fixed positions for a %s-player table', (tableSize, expected) => {
    const table = createTable({
      mode: 'STANDARD', tableSize, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: tableSize }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 })),
    });
    const state = startHand(table, createDeck('STANDARD'));
    expect(state.players.map((player) => toPublicContext(state, player.id).position)).toEqual(expected);
    const folded = { ...state, players: state.players.map((player) => player.seat === Math.min(3, tableSize - 1) ? { ...player, folded: true, status: 'FOLDED' as const } : player) };
    expect(folded.players.map((player) => toPublicContext(folded, player.id).position)).toEqual(expected);
  });

  it('exposes only the AI hole cards and visible table state', () => {
    const table = createTable({
      mode: 'STANDARD',
      tableSize: 3,
      smallBlind: 5,
      bigBlind: 10,
      dealerSeat: 0,
      players: [
        { id: 'ai', seat: 0, stack: 100 },
        { id: 'human', seat: 1, stack: 100, isHuman: true },
        { id: 'villain', seat: 2, stack: 100 },
      ],
    });
    const state = startHand(table, createDeck('STANDARD'));
    const hiddenOpponentCard = state.players.find((player) => player.id === 'human')!.holeCards[0].id;
    const futureCard = state.deck[state.deckIndex + 1].id;
    const context = toPublicContext(state, 'ai');

    expect(context.self.holeCards).toHaveLength(2);
    expect(context.opponents.every((opponent) => !('holeCards' in opponent))).toBe(true);
    expect(context).not.toHaveProperty('deck');
    expect(context).not.toHaveProperty('burnCards');
    expect(context).not.toHaveProperty('handResult');
    expect(JSON.stringify(context)).not.toContain(hiddenOpponentCard);
    expect(JSON.stringify(context)).not.toContain(futureCard);
  });

  it('includes action history and public side-pot amounts without winner data', () => {
    const table = createTable({
      mode: 'STANDARD',
      tableSize: 2,
      smallBlind: 5,
      bigBlind: 10,
      players: [{ id: 'ai', seat: 0, stack: 100 }, { id: 'human', seat: 1, stack: 100, isHuman: true }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    state.actionHistory.push({ playerId: 'human', street: 'PRE_FLOP', action: 'call', amount: 5, totalTo: 10 });
    state.pots = [{ amount: 20, eligiblePlayerIds: ['ai'], winnerPlayerIds: ['ai'], awards: [{ playerId: 'ai', amount: 20 }] }];
    const context = toPublicContext(state, 'ai');
    expect(context.actionHistory).toHaveLength(1);
    expect(context.sidePots).toEqual([{ amount: 20, eligiblePlayerIds: ['ai'] }]);
    expect(context.sidePots[0]).not.toHaveProperty('winnerPlayerIds');
    expect(context.sidePots[0]).not.toHaveProperty('awards');
  });
});
