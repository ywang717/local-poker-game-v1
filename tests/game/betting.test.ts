import { describe, expect, it } from 'vitest';
import { createDeck } from '../../src/game/cards';
import { applyAction, createTable, getLegalActions, startHand } from '../../src/game/gameEngine';
import type { GameState, TableConfig } from '../../src/game/gameState';

function headsUp(): GameState {
  const config: TableConfig = {
    mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
    players: [{ id: 'hero', seat: 0, stack: 100 }, { id: 'villain', seat: 1, stack: 100 }],
  };
  return startHand(createTable(config), createDeck('STANDARD'));
}

describe('betting legality and transitions', () => {
  it('posts heads-up blinds and lets the dealer act first pre-flop', () => {
    const state = headsUp();
    expect(state.dealerSeat).toBe(0);
    expect(state.smallBlindSeat).toBe(0);
    expect(state.bigBlindSeat).toBe(1);
    expect(state.actingSeat).toBe(0);
    expect(state.players[0].streetContribution).toBe(5);
    expect(state.players[1].streetContribution).toBe(10);
    expect(getLegalActions(state, 'hero')).toEqual(expect.arrayContaining([{ kind: 'call', amount: 5 }]));
  });

  it('advances to the flop with the big blind acting first heads-up', () => {
    let state = headsUp();
    state = applyAction(state, { playerId: 'hero', action: { kind: 'call' } }).state;
    state = applyAction(state, { playerId: 'villain', action: { kind: 'check' } }).state;
    expect(state.street).toBe('FLOP');
    expect(state.actingSeat).toBe(1);
    expect(state.communityCards).toHaveLength(3);
  });

  it('keeps folding legal when checking is also available', () => {
    let state = headsUp();
    state = applyAction(state, { playerId: 'hero', action: { kind: 'call' } }).state;
    state = applyAction(state, { playerId: 'villain', action: { kind: 'check' } }).state;
    state = applyAction(state, { playerId: 'villain', action: { kind: 'check' } }).state;

    expect(state.currentBet).toBe(0);
    expect(state.actingSeat).toBe(0);
    expect(getLegalActions(state, 'hero')).toEqual(expect.arrayContaining([{ kind: 'fold' }]));
  });

  it('rejects an under-raise and an action from the wrong player', () => {
    const state = headsUp();
    const legal = getLegalActions(state, 'hero');
    expect(legal).toEqual(expect.arrayContaining([{ kind: 'raise-to', minAmount: 20, maxAmount: 100 }]));
    expect(applyAction(state, { playerId: 'hero', action: { kind: 'raise-to', amount: 15 } }).ok).toBe(false);
    expect(applyAction(state, { playerId: 'villain', action: { kind: 'check' } }).ok).toBe(false);
  });

  it.each([2, 3, 4, 5, 6, 8, 9] as const)('starts a supported %s-player table', (tableSize) => {
    const players = Array.from({ length: tableSize }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 }));
    const config: TableConfig = { mode: 'STANDARD', tableSize, smallBlind: 5, bigBlind: 10, players };
    const state = startHand(createTable(config), createDeck('STANDARD'));
    expect(state.players).toHaveLength(tableSize);
    expect(state.actingSeat).not.toBeNull();
    expect(state.players[state.actingSeat!].folded).toBe(false);
  });
});
