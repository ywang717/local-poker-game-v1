import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { applyAction, createTable, startHand } from '../../src/game/gameEngine';
import type { TableConfig } from '../../src/game/gameState';

describe('game engine state', () => {
  it('deals two private cards per player and keeps the remaining deck index', () => {
    const config: TableConfig = {
      mode: 'STANDARD', tableSize: 3, smallBlind: 5, bigBlind: 10,
      players: [{ id: 'a', seat: 0, stack: 100 }, { id: 'b', seat: 1, stack: 100 }, { id: 'c', seat: 2, stack: 100 }],
    };
    const state = startHand(createTable(config), createDeck('STANDARD'));
    expect(state.players.every((player) => player.holeCards)).toBe(true);
    expect(state.players.flatMap((player) => player.holeCards)).toHaveLength(6);
    expect(state.deckIndex).toBe(6);
  });

  it('marks an all-in player and removes them from future action', () => {
    const config: TableConfig = {
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10,
      players: [{ id: 'a', seat: 0, stack: 12 }, { id: 'b', seat: 1, stack: 12 }],
    };
    let state = startHand(createTable(config), createDeck('STANDARD'));
    const player = state.players[state.actingSeat!];
    state = applyAction(state, { playerId: player.id, action: { kind: 'all-in' } }).state;
    expect(state.players.find((entry) => entry.id === player.id)?.allIn).toBe(true);
    expect(state.actingSeat).toBe(1 - player.seat);
  });

  it('runs an all-in blind hand through the board without leaving a dead acting seat', () => {
    const config: TableConfig = {
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10,
      players: [{ id: 'a', seat: 0, stack: 5 }, { id: 'b', seat: 1, stack: 5 }],
    };

    const state = startHand(createTable(config), createDeck('STANDARD'));

    expect(state.street).toBe('SHOWDOWN');
    expect(state.actingSeat).toBeNull();
    expect(state.communityCards).toHaveLength(5);
    expect(state.players.every((player) => player.allIn)).toBe(true);
  });

  it('gives separate human table sessions unique hand ids', () => {
    const config: TableConfig = {
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10,
      players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }],
    };
    const first = startHand(createTable(config), createDeck('STANDARD'));
    const second = startHand(createTable(config), createDeck('STANDARD'));
    expect(first.handId).not.toBe(second.handId);
  });
});
