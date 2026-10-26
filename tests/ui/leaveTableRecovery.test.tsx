// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { buyIn, createCareer } from '../../src/career/careerService';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { useCareerStore } from '../../src/store/careerStore';
import { useGameStore } from '../../src/store/gameStore';
import * as saves from '../../src/storage/saveSystem';
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
  it('does not publish a cash-out before the durable career write completes', async () => {
    const entered = buyIn(createCareer('耐久测试'), 1);
    const game = { ...startHand(createTable({mode:'STANDARD',tableSize:2,smallBlind:25,bigBlind:50,sessionId:entered.sessionId,players:[{id:'human',seat:0,stack:5000,isHuman:true},{id:'ai',seat:1,stack:5000}]}),createDeck('STANDARD')),street:'SETTLEMENT' as const };
    useCareerStore.setState({career:entered.career});useGameStore.setState({game});
    let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
    const original=saves.saveCareer;const spy=vi.spyOn(saves,'saveCareer').mockImplementation(async career=>{await held;await original(career);});
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
    await act(async()=>root.render(<App/>));
    await act(async()=>host.querySelector<HTMLButtonElement>('[data-testid=leave-table]')!.click());
    try { expect(useGameStore.getState().game).not.toBeNull(); } finally { release();spy.mockRestore(); }
    await act(async()=>{await vi.waitFor(()=>expect(useGameStore.getState().game).toBeNull());});
  });
  it('stays on the career page after leaving a settled hand with an old snapshot present', async () => {
    const career = buyIn(createCareer('测试玩家'), 1).career;
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 25, bigBlind: 50, dealerSeat: 0,
      sessionId: career.activeTableSessionId!, matchType: 'CASH', tableLevel: 1,
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
    expect(useCareerStore.getState().career?.financialTransactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'INITIAL_BUY_IN', amount: 5_000 }),
      expect.objectContaining({ kind: 'TABLE_CASH_OUT', amount: 4_975, sessionId: career.activeTableSessionId }),
    ]));
    expect(await loadHandSnapshot()).toBeNull();
  });
});

it('retains the hand on an atomic cash-out failure and retries without duplicate money', async () => {
 const entered=buyIn(createCareer('重试测试'),1);
 const game={...startHand(createTable({mode:'STANDARD',tableSize:2,smallBlind:25,bigBlind:50,sessionId:entered.sessionId,players:[{id:'human',seat:0,stack:5000,isHuman:true},{id:'ai',seat:1,stack:5000}]}),createDeck('STANDARD')),street:'SETTLEMENT' as const};
 useCareerStore.setState({career:entered.career});useGameStore.setState({game});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
 await act(async()=>root.render(<App/>));const spy=vi.spyOn(saves,'saveCareerAndClearHand').mockRejectedValueOnce(new Error('模拟写入失败'));
 await act(async()=>{host.querySelector<HTMLButtonElement>('[data-testid=leave-table]')!.click();await vi.waitFor(()=>expect(spy).toHaveBeenCalledTimes(1));});
 expect(host.textContent).toContain('模拟写入失败');
 expect(useGameStore.getState().game?.handId).toBe(game.handId);
 await act(async()=>{host.querySelector<HTMLButtonElement>('[data-testid=leave-table]')!.click();await vi.waitFor(()=>expect(useGameStore.getState().game).toBeNull());});
 expect(useCareerStore.getState().career?.currentFunds).toBe(9975);
 expect(useCareerStore.getState().career?.financialTransactions.filter(t=>t.kind==='TABLE_CASH_OUT')).toHaveLength(1);
 expect(await saves.loadHandSnapshot()).toBeNull();spy.mockRestore();
});

it('cannot resurrect a hand when the showdown timer crosses an atomic cash-out', async () => {
 const entered=buyIn(createCareer('摊牌离桌测试'),1);const started=startHand(createTable({mode:'STANDARD',tableSize:2,smallBlind:25,bigBlind:50,sessionId:entered.sessionId,players:[{id:'human',seat:0,stack:5000,isHuman:true},{id:'ai',seat:1,stack:5000}]}),createDeck('STANDARD'));
 const game={...started,street:'SHOWDOWN' as const,actingSeat:null,communityCards:started.deck.slice(5,10)};
 useCareerStore.setState({career:entered.career});useGameStore.setState({game});
 let release!:()=>void;const held=new Promise<void>(r=>{release=r;});const original=saves.saveCareerAndClearHand;
 const spy=vi.spyOn(saves,'saveCareerAndClearHand').mockImplementation(async career=>{await original(career);await held;});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);await act(async()=>root.render(<App/>));
 await act(async()=>{host.querySelector<HTMLButtonElement>('[data-testid=leave-table]')!.click();await new Promise(r=>setTimeout(r,850));});
 release();await act(async()=>{await vi.waitFor(()=>expect(useGameStore.getState().game).toBeNull());});
 await new Promise(r=>setTimeout(r,30));expect(await saves.loadHandSnapshot()).toBeNull();spy.mockRestore();
});
