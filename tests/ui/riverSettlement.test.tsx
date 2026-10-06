// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { createCareer } from '../../src/career/careerService';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';

let roots: Root[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('river showdown presentation', () => {
  it('shows showdown before settling after the river is complete', async () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [
        { id: 'human', name: '玩家', seat: 0, stack: 100, isHuman: true },
        { id: 'ai', name: 'AI', seat: 1, stack: 100 },
      ],
    });
    const started = startHand(table, createDeck('STANDARD'));
    const showdown = {
      ...started,
      street: 'SHOWDOWN' as const,
      actingSeat: null,
      communityCards: started.deck.slice(6, 11),
    };
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => root.render(<App initialCareer={createCareer('玩家')} initialGame={showdown} initialView="GAME" />));
    expect(host.querySelector('[data-testid="showdown-controls"]')).not.toBeNull();
    expect(host.querySelector('.settlement-controls')).toBeNull();

    await act(async () => { vi.advanceTimersByTime(800); });
    expect(host.querySelector('.settlement-controls')).not.toBeNull();
  });
});
