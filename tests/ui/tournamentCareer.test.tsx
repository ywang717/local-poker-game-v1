// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { StatisticsPage } from '../../src/pages/Statistics/StatisticsPage';
import { createCareer, recordHand, enterTournament, recordTournamentFinish } from '../../src/career/careerService';
import { tournamentSummary } from '../helpers/tournamentSummary';
import { useCareerStore, flushCareerPersistenceQueue } from '../../src/store/careerStore';
import { useGameStore, flushGamePersistenceQueue } from '../../src/store/gameStore';
import { startTournamentHand } from '../../src/tournament/tournamentEngine';
import { settleGameState } from '../../src/game/handSettlement';
import { createCard, type Rank } from '../../src/game/cards';
import { loadCareer, resetStorageForTests } from '../../src/storage/saveSystem';

let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await flushCareerPersistenceQueue();
  await flushGamePersistenceQueue();
  await resetStorageForTests();
  useCareerStore.setState({ career: null });
  useGameStore.setState({ game: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent === label);
  expect(button, `missing button ${label}`).toBeDefined();
  await act(async () => button!.click());
}
function careerFixture() {
  let career = createCareer('玩家');
  career = recordHand(career, tournamentSummary('cash-hand', { matchType: 'CASH', result: 'LOSS' }));
  career = recordHand(career, tournamentSummary('t-win'));
  career = recordHand(career, tournamentSummary('t-split', { result: 'SPLIT' }));
  career = recordHand(career, tournamentSummary('t-short', { mode: 'SHORT_DECK', result: 'FOLD' }));
  const entered = enterTournament(career, 'STANDARD', 1, 'ui-record');
  return recordTournamentFinish(entered.career, { ...entered.tournament, championId: 'human', players: [entered.tournament.players[0]], rankings: [{ playerId: 'human', rank: 1 }] });
}

describe('tournament career navigation and win rates', () => {
  it('opens tournament career from the homepage and lets players switch cash/tournament and rules independently', async () => {
    const career = careerFixture();
    await act(async () => root.render(<App initialCareer={career} initialView="CAREER" />));
    await click('查看锦标赛生涯');
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toBe('锦标赛');
    expect(host.textContent).toContain('冠军率');
    expect(host.textContent).toContain('最近比赛');
    expect(host.textContent).toContain('可恢复的历史样本');
    expect(host.querySelector('.starting-hand-table tbody')?.textContent).toContain('50%');
    await click('短牌德州');
    expect(host.querySelector('.starting-hand-table tbody')?.textContent).toContain('0%');
    await click('现金桌');
    expect(host.textContent).toContain('该模式暂时没有手牌记录');
    await click('标准德州');
    expect(host.querySelector('.starting-hand-table tbody')?.textContent).toContain('0%');
  });

  it('shows completed and exited match records, exact fees/reward/net and the date coverage note', async () => {
    let career = careerFixture();
    const entered = enterTournament(career, 'SHORT_DECK', 1, 'ui-exit');
    career = recordTournamentFinish(entered.career, { ...entered.tournament, players: entered.tournament.players.filter(p => !p.isHuman), rankings: [{ playerId: 'human', rank: 6 }] });
    await act(async () => root.render(<StatisticsPage career={career} initialMatchType="MINI_TOURNAMENT" />));
    expect(host.textContent).toContain('前三次数');
    expect(host.textContent).toContain('统计起点');
    const records = host.querySelectorAll('.tournament-record');
    expect(records).toHaveLength(2);
    expect(records[0].textContent).toContain('已退出');
    expect(records[0].textContent).toContain('第 6 名');
    expect(records[0].textContent).not.toContain('冠军：');
    expect(records[1].textContent).toContain('已完成');
    expect(records[1].textContent).toContain('50,000');
    expect(records[1].textContent).toContain('45,000');
    expect(host.textContent).toContain('50%');
  });

  it('handles empty tournament data without NaN rates or invented match records', async () => {
    await act(async () => root.render(<StatisticsPage career={createCareer('新玩家')} initialMatchType="MINI_TOURNAMENT" />));
    expect(host.textContent).toContain('暂无已结算比赛记录');
    expect(host.textContent).toContain('0%');
    expect(host.textContent).not.toContain('NaN');
    expect(host.querySelectorAll('.tournament-record')).toHaveLength(0);
  });
  it.each(['human', 'ai-1'])('records a completed match when leaving the final settled hand won by %s', async (winner) => {
    const entered = enterTournament(createCareer('玩家'), 'STANDARD', 1, `last-hand-${winner}`);
    const tournament = { ...entered.tournament, players: entered.tournament.players.slice(0, 2).map(p => ({ ...p, stack: 15000 })),
      eliminations: entered.tournament.players.slice(2).map((p, i) => ({ playerId: p.id, playerName: p.name, rank: 6 - i, handNumber: 1, stackBeforeHand: 5000, seat: p.seat })),
      rankings: entered.tournament.players.slice(2).map((p, i) => ({ playerId: p.id, rank: 6 - i })) };
    const hand = startTournamentHand(tournament, () => 0.5);
    const settled = settleGameState({ ...hand, street: 'SHOWDOWN', actingSeat: null,
      communityCards: [2, 3, 7, 8, 9].map((rank, i) => createCard(rank as Rank, i % 2 ? 'clubs' : 'diamonds')),
      players: hand.players.map(p => ({ ...p, stack: 0, allIn: true, streetContribution: 15000, handContribution: 15000,
        holeCards: [createCard(p.id === winner ? 14 : 13, 'spades'), createCard(p.id === winner ? 14 : 13, 'hearts')] })),
    }).state;
    await act(async () => root.render(<App initialCareer={entered.career} initialGame={settled} initialView="GAME" />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="leave-table"]')!.click());
    await flushCareerPersistenceQueue();
    const loaded = (await loadCareer()).career!;
    expect(loaded.tournamentHistory[0]).toMatchObject({ status: 'COMPLETED', humanRank: winner === 'human' ? 1 : 2, reward: winner === 'human' ? 50000 : 0 });
    expect(loaded.currentFunds).toBe(winner === 'human' ? 55000 : 5000);
    expect(loaded.tournamentStatistics.topThreeFinishes).toBe(1);
    expect(loaded.tournamentStatistics.tournamentsPlayed).toBe(1);
  });

  it('records fast-simulated completion without counting spectator hands or paying the eliminated human', async () => {
    const entered = enterTournament(createCareer('玩家'), 'STANDARD', 1, 'fast-record');
    const eliminated = [entered.tournament.players[0], ...entered.tournament.players.slice(4)];
    const tournament = { ...entered.tournament, spectator: true,
      players: entered.tournament.players.slice(1, 4).map(p => ({ ...p, stack: 10000 })),
      eliminations: eliminated.map((p, i) => ({ playerId: p.id, playerName: p.name, rank: 4 + i, handNumber: 1, stackBeforeHand: 5000, seat: p.seat })),
      rankings: eliminated.map((p, i) => ({ playerId: p.id, rank: 4 + i })) };
    const game = startTournamentHand(tournament, () => 0.5);
    await act(async () => root.render(<App initialCareer={entered.career} initialGame={game} initialView="GAME" />));
    await click('快速模拟至结束');
    await flushCareerPersistenceQueue();
    const loaded = (await loadCareer()).career!;
    expect(loaded.tournamentHistory).toHaveLength(1);
    expect(loaded.tournamentHistory[0]).toMatchObject({ humanRank: 4, status: 'COMPLETED', reward: 0 });
    expect(loaded.tournamentHistory[0].championName).toBeTruthy();
    expect(loaded.tournamentStatistics.byStartingHand).toEqual({ STANDARD: {}, SHORT_DECK: {} });
    expect(loaded.statistics.overall.totalHands).toBe(0);
    expect(loaded.currentFunds).toBe(5000);
  });

});
