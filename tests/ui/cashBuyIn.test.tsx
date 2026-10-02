// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { createCareer } from '../../src/career/careerService';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { useCareerStore } from '../../src/store/careerStore';
import { useGameStore } from '../../src/store/gameStore';
import { resetStorageForTests } from '../../src/storage/saveSystem';
import { GamePage } from '../../src/pages/Game/GamePage';
import { getTableLevel } from '../../src/career/tableLevels';
import { renderToStaticMarkup } from 'react-dom/server';
import { requestCashBuyIn } from '../../src/career/cashBuyInService';

const roots: Root[] = [];

function cashGame(stack = 1_000) {
  const table = createTable({
    mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, tableLevel: 1,
    sessionId: 'cash-ui', matchType: 'CASH', dealerSeat: 0,
    players: [{ id: 'human', name: '玩家', seat: 0, stack, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 5_000 }],
  });
  return startHand(table, createDeck('STANDARD'));
}

async function mount(game = cashGame()) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const career = createCareer('玩家');
  career.activeTableStack = game.players.find((player) => player.isHuman)?.stack ?? 0;
  await act(async () => root.render(<App initialCareer={career} initialView="GAME" initialGame={game} />));
  return host;
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useCareerStore.setState({ career: null });
  useGameStore.setState({ game: null, paused: false, leaveRequested: false, zeroStackChoice: false });
  await resetStorageForTests();
});

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  document.body.innerHTML = '';
});

describe('cash buy-in table UI', () => {
  it('orders the cash toolbar as pause, buy-in, leave and hides buy-in for tournaments', async () => {
    const host = await mount();
    const labels = [...host.querySelectorAll('.game-toolbar button')].map((button) => button.textContent);
    expect(labels).toEqual(['暂停', '买入', '离开牌桌']);

    const tournament = { ...cashGame(), matchType: 'MINI_TOURNAMENT' as const };
    const tournamentHtml = renderToStaticMarkup(<GamePage game={tournament} matchType="MINI_TOURNAMENT" tableLevel={getTableLevel(1)} previousHand={null} paused={false} leaveRequested={false} canContinue={false} onContinue={() => undefined} onLeave={() => undefined} onPause={() => undefined} onAction={() => undefined} />);
    expect([...tournamentHtml.matchAll(/<button[^>]*class="link-button"[^>]*>(.*?)<\/button>/g)].map((match) => match[1])).toEqual(['暂停', '离开牌桌']);
  });

  it('opens target options, validates custom targets and shows pending status', async () => {
    const host = await mount();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in"]')!.click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('25BB');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('50BB');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('100BB');

    const custom = host.querySelector<HTMLInputElement>('[name="customTargetStack"]')!;
    await act(async () => { custom.value = '4000'; custom.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in-confirm"]')?.disabled).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in-confirm"]')!.click());
    expect(host.textContent).toContain('买入申请已提交');
    expect(useCareerStore.getState().career?.pendingCashBuyIns).toHaveLength(1);
  });

  it('refunds a pending reservation when the modal cancel action is used', async () => {
    const host = await mount();
    const startingFunds = useCareerStore.getState().career!.currentFunds;
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.cash-buy-in-options button')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in-confirm"]')!.click());
    expect(host.querySelector('[data-testid="cash-buy-in-cancel"]')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in-cancel"]')!.click());
    expect(useCareerStore.getState().career?.currentFunds).toBe(startingFunds);
    expect(useCareerStore.getState().career?.pendingCashBuyIns[0].status).toBe('REFUNDED');
  });

  it('disables buy-in after leave request without changing current-hand state', async () => {
    const game = cashGame();
    const before = structuredClone(game);
    const host = await mount(game);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="leave-table"]')!.click());
    expect(host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in"]')?.disabled).toBe(true);
    expect(useGameStore.getState().game?.pots).toEqual(before.pots);
    expect(useGameStore.getState().game?.players[0].handContribution).toBe(before.players[0].handContribution);
    expect(useGameStore.getState().game?.players[0].allIn).toBe(before.players[0].allIn);
  });

  it('offers rebuy and leave choices when a cash hand settles at zero stack', async () => {
    const game = { ...cashGame(100), street: 'SETTLEMENT' as const, players: cashGame(100).players.map((player) => player.isHuman ? { ...player, stack: 0 } : player) };
    const host = await mount(game);
    expect(host.textContent).toContain('重新买入');
    expect(host.textContent).toContain('离开牌桌');
    expect(host.querySelector('[data-testid="zero-stack-choice"]')).not.toBeNull();
  });

  it('applies a pending buy-in only when starting the next hand', async () => {
    const career = createCareer('玩家');
    career.activeTableStack = 1_000;
    const game = { ...cashGame(1_000), street: 'SETTLEMENT' as const };
    const request = requestCashBuyIn(career, game.session!, 2_500);
    useCareerStore.setState({ career: request.career });
    useGameStore.setState({ game, paused: false, leaveRequested: false, zeroStackChoice: false });
    const host = await mount(game);
    expect(useGameStore.getState().game?.players[0].handContribution).toBe(game.players[0].handContribution);
    await act(async () => host.querySelector<HTMLButtonElement>('.settlement-controls .button--primary')!.click());
    await vi.waitFor(() => expect(useGameStore.getState().game?.street).toBe('PRE_FLOP'));
    expect(useGameStore.getState().game?.handNumber).toBe(game.handNumber + 1);
    expect(useGameStore.getState().game?.players.find((player) => player.isHuman)?.stack).toBe(2_425);
  });

  it('cancels a pending reservation before cashing out on leave', async () => {
    const career = createCareer('玩家');
    career.activeTableStack = 1_000;
    const game = { ...cashGame(1_000), street: 'SETTLEMENT' as const };
    const request = requestCashBuyIn(career, game.session!, 2_500);
    useCareerStore.setState({ career: request.career });
    useGameStore.setState({ game, paused: false, leaveRequested: false, zeroStackChoice: false });
    const host = await mount(game);
    await act(async () => host.querySelector<HTMLButtonElement>('.settlement-controls .button--secondary')!.click());
    expect(useGameStore.getState().game).toBeNull();
    expect(useCareerStore.getState().career?.pendingCashBuyIns[0].status).toBe('REFUNDED');
    expect(useCareerStore.getState().career?.currentFunds).toBe(10_975);
  });

  it('runs the production zero-stack rebuy choice into the next hand', async () => {
    const career = createCareer('玩家');
    career.activeTableStack = 0;
    const started = cashGame(100);
    const game = { ...started, street: 'SETTLEMENT' as const, players: started.players.map((player) => player.isHuman ? { ...player, stack: 0 } : player) };
    useCareerStore.setState({ career });
    useGameStore.setState({ game, paused: false, leaveRequested: false, zeroStackChoice: true });
    const host = await mount(game);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="zero-stack-rebuy"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.cash-buy-in-options button')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="cash-buy-in-confirm"]')!.click());
    expect(host.querySelector('[data-testid="zero-stack-continue"]')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="zero-stack-continue"]')!.click());
    await vi.waitFor(() => expect(useGameStore.getState().game?.street).toBe('PRE_FLOP'));
    expect(useGameStore.getState().game?.street).toBe('PRE_FLOP');
    expect(useGameStore.getState().game?.players.find((player) => player.isHuman)?.stack).toBe(1_200);
    expect(useCareerStore.getState().career?.pendingCashBuyIns[0].status).toBe('APPLIED');
  });
});
