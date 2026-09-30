import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';

describe('v2 session metadata', () => {
  it('creates stable cash metadata and keeps it across hands', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, sessionId: 's1', tableLevel: 1, players: [{ id: 'a', seat: 0, stack: 100 }, { id: 'b', seat: 1, stack: 100 }] });
    const hand = startHand(table, createDeck('STANDARD'));
    expect(table.matchType).toBe('CASH');
    expect(hand.sessionId).toBe('s1');
    expect(hand.session?.sessionId).toBe('s1');
  });
});
