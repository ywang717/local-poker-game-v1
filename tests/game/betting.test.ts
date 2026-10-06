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

  it('keeps the river betting round open after revealing the river', () => {
    let state = headsUp();
    state = applyAction(state, { playerId: 'hero', action: { kind: 'call' } }).state;
    state = applyAction(state, { playerId: 'villain', action: { kind: 'check' } }).state;
    state = applyAction(state, { playerId: 'villain', action: { kind: 'check' } }).state;
    state = applyAction(state, { playerId: 'hero', action: { kind: 'check' } }).state;
    state = applyAction(state, { playerId: 'villain', action: { kind: 'check' } }).state;
    state = applyAction(state, { playerId: 'hero', action: { kind: 'check' } }).state;

    expect(state.street).toBe('RIVER');
    expect(state.communityCards).toHaveLength(5);
    expect(state.actingSeat).toBe(1);
    expect(getLegalActions(state, 'villain')).toEqual(expect.arrayContaining([{ kind: 'check' }, { kind: 'fold' }]));
    expect(state.street).not.toBe('SHOWDOWN');
    expect(state.street).not.toBe('SETTLEMENT');
  });

  it('keeps a normal six-player river round open when nobody is all-in', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, seat, stack: 100 })),
    });
    let state = startHand(table, createDeck('STANDARD'));
    let steps = 0;
    while (state.street !== 'RIVER' && state.street !== 'SHOWDOWN' && steps < 100) {
      const actor = state.players.find((player) => player.seat === state.actingSeat)!;
      const legal = getLegalActions(state, actor.id);
      const action = legal.some((entry) => entry.kind === 'check') ? { kind: 'check' as const } : { kind: 'call' as const };
      state = applyAction(state, { playerId: actor.id, action }).state;
      steps += 1;
    }
    expect(state.street).toBe('RIVER');
    expect(state.actingSeat).not.toBeNull();
    expect(state.players.some((player) => player.allIn)).toBe(false);
  });

  it('runs out the board after a heads-up all-in without giving the caller another bet', () => {
    let state = headsUp();
    state = applyAction(state, { playerId: 'hero', action: { kind: 'all-in' } }).state;
    expect(getLegalActions(state, 'villain')).toEqual([
      { kind: 'fold' },
      { kind: 'call', amount: 90 },
      { kind: 'all-in', amount: 90 },
    ]);
    state = applyAction(state, { playerId: 'villain', action: { kind: 'call' } }).state;
    expect(state.street).toBe('SHOWDOWN');
    expect(state.communityCards).toHaveLength(5);
    expect(state.burnCards).toHaveLength(3);
    expect(state.actionHistory.map((action) => action.street)).toEqual(['PRE_FLOP', 'PRE_FLOP']);
  });

  it('lets the last live player call an all-in amount, then runs out without a new bet', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 3, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [{ id: 'a', seat: 0, stack: 20 }, { id: 'b', seat: 1, stack: 20 }, { id: 'c', seat: 2, stack: 100 }],
    });
    let state = startHand(table, createDeck('STANDARD'));
    state = applyAction(state, { playerId: 'a', action: { kind: 'all-in' } }).state;
    state = applyAction(state, { playerId: 'b', action: { kind: 'all-in' } }).state;
    expect(state.actingSeat).toBe(2);
    expect(getLegalActions(state, 'c').some((action) => action.kind === 'raise-to' || action.kind === 'bet-to')).toBe(false);
    expect(getLegalActions(state, 'c')).toEqual(expect.arrayContaining([{ kind: 'call', amount: 10 }]));
    state = applyAction(state, { playerId: 'c', action: { kind: 'call' } }).state;
    expect(state.street).toBe('SHOWDOWN');
    expect(state.communityCards).toHaveLength(5);
  });

  it('allows only a call when two all-ins leave one active player after a fold', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 4, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [
        { id: 'a', seat: 0, stack: 20 }, { id: 'b', seat: 1, stack: 20 },
        { id: 'c', seat: 2, stack: 100 }, { id: 'd', seat: 3, stack: 100 },
      ],
    });
    let state = startHand(table, createDeck('STANDARD'));
    const firstActor = state.players.find((player) => player.seat === state.actingSeat)!;
    state = applyAction(state, { playerId: firstActor.id, action: { kind: 'fold' } }).state;
    const secondActor = state.players.find((player) => player.seat === state.actingSeat)!;
    state = applyAction(state, { playerId: secondActor.id, action: { kind: 'all-in' } }).state;
    const thirdActor = state.players.find((player) => player.seat === state.actingSeat)!;
    state = applyAction(state, { playerId: thirdActor.id, action: { kind: 'all-in' } }).state;
    const lastActor = state.players.find((player) => player.seat === state.actingSeat)!;
    expect(getLegalActions(state, lastActor.id).some((action) => action.kind === 'raise-to' || action.kind === 'bet-to')).toBe(false);
  });

  it('does not reopen raise rights after an incomplete all-in raise', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 50, bigBlind: 100, dealerSeat: 0,
      players: [{ id: 'a', seat: 0, stack: 1_000 }, { id: 'b', seat: 1, stack: 1_000 }],
    });
    const started = startHand(table, createDeck('STANDARD'));
    const state: GameState = {
      ...started,
      street: 'FLOP',
      actingSeat: 1,
      currentBet: 300,
      lastFullRaise: 200,
      players: started.players.map((player) => player.id === 'a'
        ? { ...player, stack: 700, streetContribution: 300, handContribution: 300, hasActedStreet: true, allIn: false, folded: false, status: 'ACTIVE' }
        : { ...player, stack: 50, streetContribution: 300, handContribution: 300, hasActedStreet: false, allIn: false, folded: false, status: 'ACTIVE' }),
    };
    const after = applyAction(state, { playerId: 'b', action: { kind: 'all-in' } });
    expect(after.ok).toBe(true);
    expect(getLegalActions(after.state, 'a')).toEqual(expect.arrayContaining([{ kind: 'fold' }, { kind: 'call', amount: 50 }]));
    expect(getLegalActions(after.state, 'a').some((action) => action.kind === 'raise-to')).toBe(false);
    expect(getLegalActions(after.state, 'a').some((action) => action.kind === 'all-in')).toBe(false);
    expect(applyAction(after.state, { playerId: 'a', action: { kind: 'all-in' } }).ok).toBe(false);
    expect(after.state.actionHistory.at(-1)).toMatchObject({ isAllInCall: false, isAggressiveRaise: true, increase: 50, isFullRaise: false });
  });

  it('reopens raise rights after a complete raise', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 3, smallBlind: 50, bigBlind: 100, dealerSeat: 0,
      players: [{ id: 'a', seat: 0, stack: 1_000 }, { id: 'b', seat: 1, stack: 1_000 }, { id: 'c', seat: 2, stack: 1_000 }],
    });
    const started = startHand(table, createDeck('STANDARD'));
    const state: GameState = {
      ...started,
      street: 'FLOP',
      actingSeat: 1,
      currentBet: 300,
      lastFullRaise: 200,
      players: started.players.map((player) => player.id === 'a'
        ? { ...player, stack: 700, streetContribution: 300, handContribution: 300, hasActedStreet: true, allIn: false, folded: false, status: 'ACTIVE' }
        : player.id === 'b'
          ? { ...player, stack: 200, streetContribution: 300, handContribution: 300, hasActedStreet: false, allIn: false, folded: false, status: 'ACTIVE' }
          : { ...player, stack: 700, streetContribution: 300, handContribution: 300, hasActedStreet: false, allIn: false, folded: false, status: 'ACTIVE' }),
    };
    const after = applyAction(state, { playerId: 'b', action: { kind: 'all-in' } });
    expect(after.ok).toBe(true);
    expect(after.state.actingSeat).toBe(2);
    expect(getLegalActions(after.state, 'c')).toEqual(expect.arrayContaining([{ kind: 'raise-to', minAmount: 700, maxAmount: 1_000 }]));
  });

  it('does not accumulate consecutive short all-ins into a full raise', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 4, smallBlind: 50, bigBlind: 100, dealerSeat: 0,
      players: [{ id: 'a', seat: 0, stack: 1_000 }, { id: 'b', seat: 1, stack: 1_000 }, { id: 'c', seat: 2, stack: 1_000 }, { id: 'd', seat: 3, stack: 1_000 }],
    });
    const started = startHand(table, createDeck('STANDARD'));
    const state: GameState = {
      ...started,
      street: 'FLOP', actingSeat: 1, currentBet: 300, lastFullRaise: 200,
      players: started.players.map((player) => ['a', 'd'].includes(player.id)
        ? { ...player, stack: 700, streetContribution: 300, handContribution: 300, hasActedStreet: player.id === 'a', allIn: false, folded: false, status: 'ACTIVE' }
        : { ...player, stack: 50, streetContribution: 300, handContribution: 300, hasActedStreet: false, allIn: false, folded: false, status: 'ACTIVE' }),
    };
    const first = applyAction(state, { playerId: 'b', action: { kind: 'all-in' } });
    expect(first.ok).toBe(true);
    expect(first.state.lastFullRaise).toBe(200);
    const second = applyAction(first.state, { playerId: 'c', action: { kind: 'all-in' } });
    expect(second.ok).toBe(true);
    expect(second.state.lastFullRaise).toBe(200);
    expect(getLegalActions(second.state, 'd')).toEqual(expect.arrayContaining([{ kind: 'raise-to', minAmount: 550, maxAmount: 1_000 }]));
  });

  it('uses the full big blind as the pre-flop bring-in for a short BB', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 3, smallBlind: 50, bigBlind: 100, dealerSeat: 0,
      players: [{ id: 'utg', seat: 0, stack: 500 }, { id: 'sb', seat: 1, stack: 50 }, { id: 'bb', seat: 2, stack: 40 }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    expect(state.currentBet).toBe(100);
    expect(state.actingSeat).toBe(0);
    expect(getLegalActions(state, 'utg')).toEqual(expect.arrayContaining([{ kind: 'call', amount: 100 }, { kind: 'raise-to', minAmount: 200, maxAmount: 500 }]));
  });

  it('runs out heads-up when a short BB is already all-in', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 50, bigBlind: 100, dealerSeat: 0,
      players: [{ id: 'dealer', seat: 0, stack: 50 }, { id: 'bb', seat: 1, stack: 40 }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    expect(state.street).toBe('SHOWDOWN');
    expect(state.communityCards).toHaveLength(5);
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
