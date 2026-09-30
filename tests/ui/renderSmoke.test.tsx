import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../../src/App';
import { PokerTable } from '../../src/components/PokerTable/PokerTable';
import { HomePage } from '../../src/pages/Home/HomePage';
import { createCareer } from '../../src/career/careerService';
import { createDeck } from '../../src/game/cards';
import { createTable, startHand } from '../../src/game/gameEngine';
import { HandReview } from '../../src/components/HandReview/HandReview';
import type { HandSummary } from '../../src/career/handHistory';

describe('Chinese white minimal UI', () => {
  it('renders the home and career summary in Chinese', () => {
    const html = renderToStaticMarkup(<App initialCareer={createCareer('测试玩家')} initialView="CAREER" />);
    expect(html).toContain('本地德州扑克生涯');
    expect(html).toContain('测试玩家');
    expect(html).toContain('生涯资金');
    expect(html).toContain('进入牌桌');
    expect(html).toContain('#FFFFFF');
  });

  it('renders table selection with five levels and the supported table sizes', () => {
    const html = renderToStaticMarkup(<App initialCareer={createCareer('测试玩家')} initialView="TABLE_SELECT" />);
    expect(html).toContain('标准德州');
    expect(html).toContain('短牌德州');
    for (const size of [2, 3, 4, 5, 6, 8, 9]) expect(html).toContain(`${size} 人桌`);
    for (const name of ['新手桌', '普通桌', '进阶桌', '高手桌', '高额桌']) expect(html).toContain(name);
  });

  it('renders seats, dealer/blind labels, pot text, Chinese controls and disables an invalid raise', () => {
    const table = createTable({
      mode: 'STANDARD',
      tableSize: 2,
      smallBlind: 5,
      bigBlind: 10,
      dealerSeat: 0,
      players: [{ id: 'human', name: '玩家', seat: 0, stack: 100, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 100 }],
    });
    const state = startHand(table, createDeck('STANDARD'));
    const html = renderToStaticMarkup(<App initialCareer={createCareer('玩家')} initialView="GAME" initialGame={state} />);
    expect(html).toContain('D');
    expect(html).toContain('SB');
    expect(html).toContain('BB');
    expect(html).toContain('底池');
    expect(html).toContain('本轮下注 5');
    expect(html).toContain('本轮下注 10');
    for (const label of ['弃牌', '过牌', '跟注', '加注', '全下']) expect(html).toContain(label);
    expect(html).toMatch(/disabled="">加注/);
  });

  it('makes the latest AI action visible on its seat', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [{ id: 'human', name: '玩家', seat: 0, stack: 100, isHuman: true }, { id: 'ai', name: '凯文', seat: 1, stack: 100 }],
    });
    const state = {
      ...startHand(table, createDeck('STANDARD')),
      actionHistory: [{ playerId: 'ai', street: 'PRE_FLOP' as const, action: 'raise-to' as const, amount: 30, totalTo: 40 }],
    };
    const html = renderToStaticMarkup(<PokerTable game={state} />);
    expect(html).toContain('action-badge--raise');
    expect(html).toContain('action-badge__icon');
    expect(html).toContain('加注');
    expect(html).toContain('+30');
  });

  it('labels the active AI seat as thinking while its timer is running', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [{ id: 'human', name: '玩家', seat: 0, stack: 100, isHuman: true }, { id: 'ai', name: '迈克', seat: 1, stack: 100 }],
    });
    const state = { ...startHand(table, createDeck('STANDARD')), actingSeat: 1 };
    const html = renderToStaticMarkup(<PokerTable game={state} />);
    expect(html).toContain('思考中');
  });

  it('keeps live players and community cards together while hiding folded seats', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 3, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [
        { id: 'human', name: '玩家', seat: 0, stack: 100, isHuman: true },
        { id: 'folded', name: '已弃牌的凯文', seat: 1, stack: 100 },
        { id: 'live', name: '仍在牌局的杰克', seat: 2, stack: 100 },
      ],
    });
    const started = startHand(table, createDeck('STANDARD'));
    const state = { ...started, players: started.players.map((player) => player.id === 'folded' ? { ...player, folded: true, status: 'FOLDED' as const } : player) };
    const html = renderToStaticMarkup(<PokerTable game={state} />);
    expect(html).toContain('仍在牌局的杰克');
    expect(html).not.toContain('已弃牌的凯文');
    expect(html).toContain('class="table-center"');
    expect(html).toContain('aria-label="公共牌"');
  });

  it('reveals eligible AI hole cards at showdown', () => {
    const table = createTable({
      mode: 'STANDARD', tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      players: [{ id: 'human', name: '玩家', seat: 0, stack: 100, isHuman: true }, { id: 'ai', name: 'AI', seat: 1, stack: 100 }],
    });
    const state = { ...startHand(table, createDeck('STANDARD')), street: 'SHOWDOWN' as const };
    const html = renderToStaticMarkup(<PokerTable game={state} />);
    expect(html.match(/playing-card--hidden/g)).toHaveLength(5);
  });

  it('renders a recoverable save error instead of a blank screen', () => {
    const html = renderToStaticMarkup(<HomePage career={null} loadError="存档无法恢复" onContinue={() => undefined} onNewCareer={() => undefined} onNavigate={() => undefined} />);
    expect(html).toContain('存档无法恢复');
  });

  it('renders a collapsible previous-hand review with pot awards and action timeline', () => {
    const hand: HandSummary = {
      handId: 'hand-review-1', timestamp: '2026-09-30T00:00:00.000Z', mode: 'STANDARD', tableLevel: 1, tableSize: 2, smallBlind: 5, bigBlind: 10, dealerSeat: 0,
      playerHoleCards: [], communityCards: [], finalCategory: '两对', finalPot: 120, playerContribution: 60, playerNet: 60, result: 'WIN',
      actionHistory: [{ playerId: 'AI', street: 'RIVER', action: 'call', amount: 20, totalTo: 60 }], potResults: [{ amount: 120, winnerPlayerIds: ['玩家'], awards: [{ playerId: '玩家', amount: 120 }] }],
    };
    const html = renderToStaticMarkup(<HandReview hand={hand} defaultExpanded collapsible />);
    expect(html).toContain('上一手回顾');
    expect(html).toContain('主池 120');
    expect(html).toContain('玩家');
    expect(html).toContain('行动时间线');
    expect(html).toContain('收起上一手');
  });
});
