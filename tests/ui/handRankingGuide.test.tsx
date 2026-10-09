// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GamePage } from '../../src/pages/Game/GamePage';
import { createCareer } from '../../src/career/careerService';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';

let root: Root;
let host: HTMLDivElement;
function game(mode: 'STANDARD' | 'SHORT_DECK') {
  const table = createTable({ mode, tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
    players: [{ id: 'human', name: '玩家', seat: 0, stack: 100, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 100 }] });
  return startHand(table, createDeck(mode));
}
function render(mode: 'STANDARD' | 'SHORT_DECK') {
  root.render(<GamePage game={game(mode)} matchType="CASH" tableLevel={undefined} currentFunds={0} previousHand={null} paused={false} leaveRequested={false} canContinue={false} onContinue={() => undefined} onLeave={() => undefined} onPause={() => undefined} onAction={() => undefined} />);
}
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  expect(button, `missing ${label}`).toBeDefined();
  await act(async () => button!.click());
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('牌型大小提示', () => {
  it('shows standard ranking in descending order and keeps game controls', async () => {
    await act(async () => render('STANDARD'));
    await click('牌型大小');
    const dialog = host.querySelector('[role="dialog"]')!;
    const text = dialog.textContent ?? '';
    expect(text).toContain('皇家同花顺');
    expect(text).not.toContain('同花大于葫芦');
    const ranking = [...dialog.querySelectorAll('.hand-ranking-list li strong')].map((item) => item.textContent);
    expect(ranking.indexOf('葫芦')).toBeLessThan(ranking.indexOf('同花'));
    expect(host.querySelector('[data-testid="leave-table"]')).not.toBeNull();
    expect(host.textContent).toContain('暂停');
    await click('关闭牌型大小');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows short-deck ranking and special rules', async () => {
    await act(async () => render('SHORT_DECK'));
    await click('牌型大小');
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('同花大于葫芦');
    expect(dialog?.textContent).toContain('A-6-7-8-9');
    const ranking = [...dialog!.querySelectorAll('.hand-ranking-list li strong')].map((item) => item.textContent);
    expect(ranking.indexOf('同花')).toBeLessThan(ranking.indexOf('葫芦'));
  });

  it('closes with Escape and backdrop click', async () => {
    await act(async () => render('STANDARD'));
    await click('牌型大小');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click('牌型大小');
    const backdrop = host.querySelector('[data-testid="hand-ranking-backdrop"]') as HTMLElement;
    expect(backdrop).not.toBeNull();
    await act(async () => backdrop.click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});
