import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { toPublicContext } from '../../src/ai/publicContext';

describe('AI information boundary', () => {
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
