// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatisticsPage } from '../../src/pages/Statistics/StatisticsPage';
import { createCareer } from '../../src/career/careerService';
import { createHandStatsFact } from '../../src/career/handStats';
import { createCard } from '../../src/game/cards';
import type { HandSummary } from '../../src/career/handHistory';

let root: Root;
let host: HTMLDivElement;

function summary(overrides: Partial<HandSummary> = {}): HandSummary {
  return {
    handId: 'stats-ui-1', matchType: 'CASH', timestamp: '2026-10-09T00:00:00.000Z', mode: 'STANDARD', tableLevel: 1, tableSize: 6,
    smallBlind: 25, bigBlind: 50, dealerSeat: 0, playerHoleCards: [createCard(14, 'spades'), createCard(13, 'spades')], communityCards: [],
    finalCategory: null, finalPot: 300, playerContribution: 100, playerNet: 200, result: 'WIN', actionHistory: [],
    playerPosition: 'BTN', initialPlayerStack: 5000, effectiveStackBB: 100, vpip: true, sawFlop: true, sawTurn: true, sawRiver: true,
    trueShowdown: true, ...overrides,
  };
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('starting-hand statistics UI', () => {
  it('shares filters across table and matrix views and opens detail from a row', async () => {
    const career = createCareer('统计玩家');
    career.handStats = [
      createHandStatsFact(summary(), career.careerId!)!,
      createHandStatsFact(summary({ handId: 'stats-ui-2', playerHoleCards: [createCard(10, 'clubs'), createCard(10, 'diamonds')], result: 'LOSS', playerNet: -50, vpip: false, playerPosition: 'HJ', effectiveStackBB: 30 }), career.careerId!)!,
    ];
    await act(async () => root.render(<StatisticsPage career={career} />));
    expect(host.textContent).toContain('AKs');
    expect(host.textContent).toContain('BB/100');
    const position = host.querySelector('select[aria-label="位置"]') as HTMLSelectElement | null;
    expect(position).toBeTruthy();
    await act(async () => { position!.value = 'LATE'; position!.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.textContent).toContain('AKs');
    expect(host.textContent).not.toContain('TT统计详情');
    const view = [...host.querySelectorAll('select')].find(select => [...select.options].some(option => option.value === 'MATRIX')) as HTMLSelectElement;
    await act(async () => { view.value = 'MATRIX'; view.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.textContent).toContain('169 / 81 矩阵');
    const matrixCell = host.querySelector('button[aria-label^="AKs"]') as HTMLButtonElement | null;
    expect(matrixCell).toBeTruthy();
    await act(async () => matrixCell!.click());
    expect(host.textContent).toContain('AKs 统计详情');
    await act(async () => (host.querySelector('button[aria-label="关闭详情"]') as HTMLButtonElement).click());
    expect(host.textContent).not.toContain('AKs 统计详情');
  });
});
