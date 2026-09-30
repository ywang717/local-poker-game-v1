// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { buyIn, createCareer } from '../../src/career/careerService';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { useCareerStore } from '../../src/store/careerStore';
import { useGameStore } from '../../src/store/gameStore';
import { loadHandSnapshot, resetStorageForTests, saveHandSnapshot } from '../../src/storage/saveSystem';

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useCareerStore.setState({ career: null });
  useGameStore.setState({ game: null, paused: false, leaveRequested: false });
  await resetStorageForTests();
});

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  document.body.innerHTML = '';
});

describe('table exit and save recovery', () => {
  it('stays on the career page after leaving a settled hand with an old snapshot present', async () => {
    const career = buyIn(createCareer('测试玩家'), 1).career;
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, dealerSeat: 0,
      players: [{ id: 'human', name: '测试玩家', seat: 0, stack: 5_000, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 5_000 }],
    });
    const game = { ...startHand(table, createDeck('STANDARD')), street: 'SETTLEMENT' as const };
    useCareerStore.setState({ career });
    useGameStore.setState({ game });
    await saveHandSnapshot({ saveVersion: 1, savedAt: new Date().toISOString(), state: game });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => root.render(<App />));
    expect(host.querySelector('.game-page')).not.toBeNull();

    const leave = host.querySelector<HTMLButtonElement>('.settlement-controls button:last-child');
    expect(leave?.textContent).toBe('离开牌桌');
    await act(async () => leave!.click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });

    expect(host.querySelector('.game-page')).toBeNull();
    expect(host.querySelector('.hero-stat')).not.toBeNull();
    expect(useGameStore.getState().game).toBeNull();
    expect(useCareerStore.getState().career?.activeTableStack).toBeNull();
    expect(await loadHandSnapshot()).toBeNull();
  });
});
