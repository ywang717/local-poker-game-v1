// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareer, enterTournament } from '../../src/career/careerService';
import { TournamentSelectPage } from '../../src/pages/TournamentSelect/TournamentSelectPage';
import { TournamentResultPage } from '../../src/pages/TournamentResult/TournamentResultPage';
import { TournamentInfo } from '../../src/components/TournamentInfo/TournamentInfo';
import { startTournament } from '../../src/tournament/tournamentEngine';
import { GamePage } from '../../src/pages/Game/GamePage';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { settleGameState } from '../../src/game/handSettlement';
import { App } from '../../src/App';
import { HistoryPage } from '../../src/pages/History/HistoryPage';
import { startTournamentHand } from '../../src/tournament/tournamentEngine';
import { flushCareerPersistenceQueue, useCareerStore } from '../../src/store/careerStore';
import { useGameStore } from '../../src/store/gameStore';
import { loadCareer, loadHandSnapshot, resetStorageForTests, saveCareer, saveHandSnapshot } from '../../src/storage/saveSystem';
import { CURRENT_SAVE_VERSION } from '../../src/types/persistence';

const roots: Root[] = [];
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

describe('mini tournament flow UI', () => {
  it('shows affordability/unlock, fixed six seats and tournament information', () => {
    const career = createCareer('玩家');
    const select = renderToStaticMarkup(<TournamentSelectPage career={career} onEnter={() => undefined} />);
    expect(select).toContain('Mini 锦标赛');
    expect(select).toContain('可进入');
    const tournament = startTournament({ tournamentId: 'ui-t1', humanId: 'human' });
    expect(tournament.players).toHaveLength(6);
    const info = renderToStaticMarkup(<TournamentInfo tournament={tournament} />);
    expect(info).toContain('存活 6 人');
    expect(info).toContain('冠军奖金');
  });

  it('renders result rank and omits cash buy-in in tournament play', () => {
    const tournament = startTournament({ tournamentId: 'ui-t2', humanId: 'human' });
    const result = renderToStaticMarkup(<TournamentResultPage tournament={{ ...tournament, championId: 'ai-1', rankings: [{ playerId: 'human', rank: 2 }], spectator: true }} onDone={() => undefined} />);
    expect(result).toContain('第 2 名');
    const table = createTable({ mode: 'STANDARD', tableSize: 6, smallBlind: 25, bigBlind: 50, matchType: 'MINI_TOURNAMENT', tableLevel: 1, sessionId: 'ui-game', players: Array.from({ length: 6 }, (_, seat) => ({ id: seat === 0 ? 'human' : `ai-${seat}`, seat, stack: 1_000, isHuman: seat === 0 })) });
    const game = startHand(table, createDeck('STANDARD'));
    const html = renderToStaticMarkup(<GamePage game={game} matchType="MINI_TOURNAMENT" tableLevel={undefined} previousHand={null} paused={false} leaveRequested={false} canContinue={false} onContinue={() => undefined} onLeave={() => undefined} onPause={() => undefined} onAction={() => undefined} />);
    expect(html).not.toContain('data-testid="cash-buy-in"');
  });

  it('offers fast simulation and exit controls after human elimination', () => {
    const tournament = startTournament({ tournamentId: 'ui-spectator', humanId: 'human' });
    const spectator = { ...tournament, spectator: true, players: tournament.players.filter((player) => !player.isHuman) };
    const game = startTournamentHand(spectator, () => 0.5);
    const html = renderToStaticMarkup(<GamePage game={{ ...game, tournamentState: spectator }} tournament={spectator} matchType="MINI_TOURNAMENT" previousHand={null} paused={false} leaveRequested={false} canContinue={false} onContinue={() => undefined} onLeave={() => undefined} onPause={() => undefined} onAction={() => undefined} onFastSimulate={() => undefined} onExitTournament={() => undefined} />);
    expect(html).toContain('data-testid="tournament-fast-simulate"');
    expect(html).toContain('data-testid="tournament-exit-spectator"');
  });

  it('drives production App entry and forfeit leave accounting', async () => {
    const career = createCareer('玩家');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => root.render(<App initialCareer={career} initialView="CAREER" />));
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('进入 Mini'))?.click());
    expect(host.textContent).toContain('Mini 锦标赛');
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('支付报名费'))?.click());
    expect(useGameStore.getState().game?.matchType).toBe('MINI_TOURNAMENT');
    expect(host.querySelector('[data-testid="cash-buy-in"]')).toBeNull();
    const settled = { ...useGameStore.getState().game!, street: 'SETTLEMENT' as const };
    await act(async () => useGameStore.getState().setGame(settled));
    const handHistory = useCareerStore.getState().career?.handHistory;
    expect(handHistory).toHaveLength(1);
    expect(handHistory?.[0]).toMatchObject({ handId: settled.handId, matchType: 'MINI_TOURNAMENT' });
    expect(useCareerStore.getState().career?.statistics.overall.totalHands).toBe(0);
    expect(renderToStaticMarkup(<HistoryPage career={useCareerStore.getState().career!} />)).toContain('Mini 锦标赛');
    await flushCareerPersistenceQueue();
    expect((await loadCareer()).career?.handHistory).toHaveLength(1);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="leave-table"]')?.click());
    expect(useCareerStore.getState().career?.handHistory).toHaveLength(1);
    expect(useCareerStore.getState().career?.tournamentStatistics.tournamentsPlayed).toBe(1);
    expect(useCareerStore.getState().career?.tournamentStatistics.tournamentsWon).toBe(0);
    expect(useCareerStore.getState().career?.financialTransactions.filter((entry) => entry.kind === 'TOURNAMENT_CHAMPION_REWARD')).toHaveLength(0);
    expect(host.textContent).toContain('第 6 名');
  });

  it('records a forfeit after an in-hand leave request reaches settlement', async () => {
    const career = createCareer('玩家');
    const tournament = startTournament({ tournamentId: 'active-forfeit', humanId: 'human' });
    const game = startTournamentHand(tournament, () => 0.5);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => root.render(<App initialCareer={career} initialView="GAME" initialGame={{ ...game, tournamentState: tournament }} />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="leave-table"]')?.click());
    expect(useGameStore.getState().leaveRequested).toBe(true);
    await act(async () => useGameStore.getState().setGame({ ...useGameStore.getState().game!, street: 'SETTLEMENT' }));
    expect(useCareerStore.getState().career?.tournamentStatistics.tournamentsPlayed).toBe(1);
    expect(useGameStore.getState().game).toBeNull();
  });

  it('reloads App into the persisted tournament hand and reward guard', async () => {
    const entered = enterTournament(createCareer('玩家'), 'STANDARD', 1, 'reload-tournament');
    const tournamentHand = startTournamentHand(entered.tournament, () => 0.5);
    const snapshot = { ...tournamentHand, tournamentState: { ...entered.tournament, blindLevel: 3, handsAtLevel: 2, handNumber: tournamentHand.handNumber, rewardPaid: true } };
    await saveCareer(entered.career);
    await saveHandSnapshot({ saveVersion: CURRENT_SAVE_VERSION, savedAt: new Date().toISOString(), state: snapshot });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => root.render(<App />));
    await act(async () => { await vi.waitFor(() => expect(host.textContent).toContain('存活 6 人')); });
    expect(host.textContent).toContain('盲注阶段');
    expect(useGameStore.getState().game?.tournamentState?.rewardPaid).toBe(true);
  });

  it('records a real tournament settlement before publishing the next hand', async () => {
    const career = createCareer('玩家');
    const tournament = startTournament({ tournamentId: 'real-history-flow', humanId: 'human' });
    const hand = startTournamentHand(tournament, () => 0.5);
    const settled = settleGameState({
      ...hand,
      street: 'SHOWDOWN',
      actingSeat: null,
      players: hand.players.map((player) => ({ ...player, folded: !player.isHuman })),
    }).state;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => root.render(<App initialCareer={career} initialGame={settled} initialView="GAME" />));
    expect(useCareerStore.getState().career?.handHistory[0]?.handId).toBe(settled.handId);
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === '继续下一手')?.click());
    await act(async () => { await vi.waitFor(() => expect(useGameStore.getState().game?.handId).not.toBe(settled.handId)); });
    const nextHandId = useGameStore.getState().game?.handId;
    expect((await loadHandSnapshot())?.state.handId).toBe(nextHandId);
    expect((await loadCareer()).career?.handHistory[0]?.handId).toBe(settled.handId);
    expect(useCareerStore.getState().career?.statistics.overall.totalHands).toBe(0);
  });
});
