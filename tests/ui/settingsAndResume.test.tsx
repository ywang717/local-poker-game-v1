import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCareer } from '../../src/career/careerService';
import { createDeck } from '../../src/game/cards';
import { applyAction, createTable, startHand } from '../../src/game/gameEngine';
import { useGameStore } from '../../src/store/gameStore';
import { DEFAULT_SETTINGS, useSettingsStore } from '../../src/store/settingsStore';
import { createPausableTimer, aiDelayMs } from '../../src/game/timers';
import { App, createNextHand, getStartupDestination, shouldFinishTableExitAfterSettlement } from '../../src/App';
import { loadHandSnapshot, resetStorageForTests } from '../../src/storage/saveSystem';
import type { HandSnapshot } from '../../src/types/persistence';
import { HistoryPage } from '../../src/pages/History/HistoryPage';
import { renderToStaticMarkup } from 'react-dom/server';

beforeEach(async () => {
  useGameStore.setState({ game: null, paused: false, leaveRequested: false });
  useSettingsStore.setState(DEFAULT_SETTINGS);
  await resetStorageForTests();
});

describe('pause, leave, settings and resume flows', () => {
  it('pauses a cancelable AI timer without consuming its callback', () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const timer = createPausableTimer(() => { calls += 1; }, 100);
      timer.pause();
      vi.advanceTimersByTime(200);
      expect(calls).toBe(0);
      timer.resume();
      vi.advanceTimersByTime(99);
      expect(calls).toBe(0);
      vi.advanceTimersByTime(1);
      expect(calls).toBe(1);
      expect(aiDelayMs('2X', 0.8)).toBeLessThan(aiDelayMs('NORMAL', 0.8));
      expect(aiDelayMs('INSTANT', 1)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('defers leaving an active hand and leaves immediately between hands', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100 }, { id: 'ai', seat: 1, stack: 100 }] });
    const state = startHand(table, createDeck('STANDARD'));
    useGameStore.getState().setGame(state);
    expect(useGameStore.getState().requestLeave()).toBe('AFTER_HAND');
    expect(useGameStore.getState().leaveRequested).toBe(true);
    useGameStore.getState().completeHand();
    expect(useGameStore.getState().game).toBeNull();
    useGameStore.getState().setGame({ ...state, street: 'SETTLEMENT' });
    expect(useGameStore.getState().requestLeave()).toBe('IMMEDIATE');
    expect(useGameStore.getState().game).toBeNull();
  });

  it('keeps the human hand active after requesting to leave while paused', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }] });
    const state = startHand(table, createDeck('STANDARD'));
    useGameStore.setState({ game: state, paused: true, leaveRequested: false });

    expect(useGameStore.getState().requestLeave()).toBe('AFTER_HAND');
    expect(useGameStore.getState().paused).toBe(false);
    expect(useGameStore.getState().leaveRequested).toBe(true);
    expect(useGameStore.getState().game?.players.find((player) => player.id === 'human')?.folded).toBe(false);
    expect(useGameStore.getState().game?.actingSeat).toBe(0);
  });

  it('still accepts a human call or raise after requesting to leave', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }] });
    const started = startHand(table, createDeck('STANDARD'));
    useGameStore.getState().setGame(started);
    useGameStore.getState().requestLeave();
    expect(useGameStore.getState().dispatchAction('human', { kind: 'call' })).toBe(true);
    expect(useGameStore.getState().game?.players.find((player) => player.id === 'human')?.folded).toBe(false);

    const raiseState = startHand(table, createDeck('STANDARD'));
    useGameStore.setState({ game: raiseState, paused: false, leaveRequested: false });
    useGameStore.getState().requestLeave();
    expect(useGameStore.getState().dispatchAction('human', { kind: 'raise-to', amount: 20 })).toBe(true);
    expect(useGameStore.getState().game?.actionHistory.at(-1)?.action).toBe('raise-to');
  });

  it('can leave when the human is facing a check-only post-flop decision', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }] });
    let state = startHand(table, createDeck('STANDARD'));
    state = applyAction(state, { playerId: 'human', action: { kind: 'call' } }).state;
    state = applyAction(state, { playerId: 'ai', action: { kind: 'check' } }).state;
    state = applyAction(state, { playerId: 'ai', action: { kind: 'check' } }).state;
    useGameStore.setState({ game: state, paused: false, leaveRequested: false });

    expect(state.currentBet).toBe(0);
    expect(state.actingSeat).toBe(0);
    expect(useGameStore.getState().requestLeave()).toBe('AFTER_HAND');
    expect(useGameStore.getState().game?.players.find((player) => player.id === 'human')?.folded).toBe(false);
  });

  it('does not auto-fold when a pending leave reaches the human after AI actions', () => {
    const players = Array.from({ length: 6 }, (_, seat) => ({ id: seat === 0 ? 'human' : `ai-${seat}`, seat, stack: 100, isHuman: seat === 0 }));
    const table = createTable({ mode: 'STANDARD', tableSize: 6, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players });
    const state = startHand(table, createDeck('STANDARD'));
    useGameStore.getState().setGame(state);
    expect(state.actingSeat).not.toBe(0);
    expect(useGameStore.getState().requestLeave()).toBe('AFTER_HAND');

    let current = useGameStore.getState().game!;
    while (current.actingSeat !== 0 && current.street !== 'SHOWDOWN') {
      const actor = current.players.find((player) => player.seat === current.actingSeat)!;
      const legal = useGameStore.getState().legalActions(actor.id);
      const action = legal.some((entry) => entry.kind === 'call') ? { kind: 'call' as const } : { kind: 'check' as const };
      expect(useGameStore.getState().dispatchAction(actor.id, action)).toBe(true);
      current = useGameStore.getState().game!;
    }

    expect(current.players.find((player) => player.id === 'human')?.folded).toBe(false);
  });

  it('finishes the table exit when a pending leave reaches settlement', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }] });
    const settlement = { ...startHand(table, createDeck('STANDARD')), street: 'SETTLEMENT' as const };
    expect(shouldFinishTableExitAfterSettlement(settlement, true)).toBe(true);
    expect(shouldFinishTableExitAfterSettlement(settlement, false)).toBe(false);
  });

  it('waits at settlement and offers continue or leave controls', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }] });
    const state = { ...startHand(table, createDeck('STANDARD')), street: 'SETTLEMENT' as const };
    const html = renderToStaticMarkup(<App initialCareer={createCareer('玩家')} initialView="GAME" initialGame={state} />);
    expect(html).toContain('继续下一手');
    expect(html).toContain('离开牌桌');
    expect(html).toContain('本手已结算');
  });

  it('shows the zero-stack rebuy or leave choice after the human loses the table stack', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }] });
    const started = startHand(table, createDeck('STANDARD'));
    const state = { ...started, street: 'SETTLEMENT' as const, players: started.players.map((player) => player.isHuman ? { ...player, stack: 0 } : player) };
    const html = renderToStaticMarkup(<App initialCareer={createCareer('玩家')} initialView="GAME" initialGame={state} />);
    expect(html).toContain('zero-stack-choice');
    expect(html).toContain('重新买入');
    expect(html).toContain('离开牌桌');
  });

  it('creates the next hand only through the explicit continue transition', () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100, isHuman: true }, { id: 'ai', seat: 1, stack: 100 }] });
    const state = { ...startHand(table, createDeck('STANDARD')), street: 'SETTLEMENT' as const };
    const next = createNextHand(state);
    expect(next.handNumber).toBe(state.handNumber + 1);
    expect(next.street).toBe('PRE_FLOP');
  });

  it('persists settings and prefers an unfinished snapshot on startup', async () => {
    useSettingsStore.getState().updateSettings({ soundEnabled: false, aiSpeed: '2X' });
    await useSettingsStore.getState().save();
    useSettingsStore.setState(DEFAULT_SETTINGS);
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
    expect(useSettingsStore.getState().aiSpeed).toBe('2X');
    const career = createCareer('玩家');
    const snapshot = { saveVersion: 1 as const, savedAt: '2026-09-30T00:00:00.000Z', state: { handId: 'h1', street: 'FLOP' } as HandSnapshot['state'] };
    expect(getStartupDestination(career, snapshot)).toBe('GAME');
    expect(getStartupDestination(career, { ...snapshot, state: { ...snapshot.state, street: 'SETTLEMENT' } })).toBe('GAME');
    expect(getStartupDestination(career, null)).toBe('CAREER');
  });

  it('automatically persists and clears the current hand snapshot with store changes', async () => {
    const table = createTable({ mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0, players: [{ id: 'human', seat: 0, stack: 100 }, { id: 'ai', seat: 1, stack: 100 }] });
    const state = startHand(table, createDeck('STANDARD'));
    useGameStore.getState().setGame(state);
    await vi.waitFor(async () => expect((await loadHandSnapshot())?.state).toEqual(state));

    const actor = state.players.find((player) => player.seat === state.actingSeat)!;
    const action = { kind: 'call' as const };
    expect(useGameStore.getState().dispatchAction(actor.id, action)).toBe(true);
    await vi.waitFor(async () => expect((await loadHandSnapshot())?.state.actionHistory).toHaveLength(1));

    useGameStore.getState().setGame(null);
    await vi.waitFor(async () => expect(await loadHandSnapshot()).toBeNull());
  });

  it('renders a history detail timeline with cards, pot, result and actions', () => {
    const career = createCareer('玩家');
    career.handHistory = [{ handId: 'h1', timestamp: '2026-09-30T00:00:00.000Z', mode: 'STANDARD', tableLevel: 1, tableSize: 6, smallBlind: 25, bigBlind: 50, dealerSeat: 0, playerHoleCards: [], communityCards: [], finalCategory: '两对', finalPot: 8600, playerContribution: 400, playerNet: 4800, result: 'WIN', actionHistory: [{ playerId: 'ai', street: 'PRE_FLOP', action: 'call', amount: 100, totalTo: 100 }] }];
    const html = renderToStaticMarkup(<HistoryPage career={career} />);
    expect(html).toContain('h1');
    expect(html).toContain('8,600');
    expect(html).toContain('两对');
    expect(html).toContain('行动时间线');
  });
});
