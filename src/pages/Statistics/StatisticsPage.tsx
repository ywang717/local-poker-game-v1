import { useState } from 'react';
import type { CareerState } from '../../career/careerState';
import type { GameMode } from '../../game/rules';
import type { MatchType } from '../../match/matchTypes';
import { getTableLevel } from '../../career/tableLevels';

const number = (value: number) => value.toLocaleString('zh-CN');
const rate = (wins: number, hands: number) => `${hands ? Math.round(wins / hands * 100) : 0}%`;
const date = (value: string) => new Date(value).toLocaleDateString('zh-CN');

export function StatisticsPage({ career, initialMatchType = 'CASH' }: { career: CareerState; initialMatchType?: MatchType }) {
  const [matchType, setMatchType] = useState<MatchType>(initialMatchType);
  const [mode, setMode] = useState<GameMode>('STANDARD');
  const isTournament = matchType === 'MINI_TOURNAMENT';
  const cash = career.statistics.overall;
  const tournament = career.tournamentStatistics;
  const startingHands = (isTournament ? tournament.byStartingHand : career.statistics.byStartingHand)[mode] ?? {};
  const rows = Object.entries(startingHands).sort(([handA, statsA], [handB, statsB]) => statsB.hands - statsA.hands || handA.localeCompare(handB));
  const cards = isTournament ? [
    ['已结算参赛次数', number(tournament.tournamentsPlayed)],
    ['冠军次数', number(tournament.tournamentsWon)],
    ['冠军率', rate(tournament.tournamentsWon, tournament.tournamentsPlayed)],
    ['前三次数', number(tournament.topThreeFinishes)],
    ['最佳名次', tournament.bestFinish === null ? '—' : `第 ${tournament.bestFinish} 名`],
    ['累计报名费', number(tournament.totalEntryFees)],
    ['累计奖金', number(tournament.totalRewards)],
    ['锦标赛净收益', number(tournament.totalNet)],
  ] : [
    ['总手数', number(cash.totalHands)], ['获胜手数', number(cash.wonHands)],
    ['胜率', rate(cash.wonHands, cash.totalHands)], ['入池率（VPIP）', rate(cash.vpipHands, cash.totalHands)],
    ['累计盈利', number(cash.totalProfit)], ['最大底池', number(cash.largestPot)],
    ['All-in 胜率', rate(cash.allInWins, cash.allInCount)],
  ];
  return <section className="page">
    <p className="eyebrow">生涯数据</p><h2>{isTournament ? '锦标赛生涯' : '长期表现'}</h2>
    <div className="segmented" role="group" aria-label="选择生涯类型">
      <button type="button" className={!isTournament ? 'selected' : ''} aria-pressed={!isTournament} onClick={() => setMatchType('CASH')}>现金桌</button>
      <button type="button" className={isTournament ? 'selected' : ''} aria-pressed={isTournament} onClick={() => setMatchType('MINI_TOURNAMENT')}>锦标赛</button>
    </div>
    <div className="stat-list">{cards.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    {isTournament && <p className="starting-hand-note tournament-coverage">统计起点：{date(tournament.trackingStartedAt)}。前三次数及逐场比赛记录从此日期开始；其他累计指标保留旧生涯数据。锦标赛筹码不计入现金桌盈利。</p>}
    <section className="starting-hand-stats" aria-labelledby="starting-hand-heading">
      <h3 id="starting-hand-heading">手牌胜率</h3>
      <p className="starting-hand-note">按起手牌组合统计：单独获胜手数 ÷ 发到该组合的总手数。平分单独记录；弃牌计入总手数和未获胜手数。</p>
      {isTournament && <p className="starting-hand-note">包含可恢复的历史样本及更新后的全部样本；仅统计真人参与的手牌，观战不计入。</p>}
      <div className="segmented" role="group" aria-label="选择统计模式">
        <button type="button" className={mode === 'STANDARD' ? 'selected' : ''} aria-pressed={mode === 'STANDARD'} onClick={() => setMode('STANDARD')}>标准德州</button>
        <button type="button" className={mode === 'SHORT_DECK' ? 'selected' : ''} aria-pressed={mode === 'SHORT_DECK'} onClick={() => setMode('SHORT_DECK')}>短牌德州</button>
      </div>
      {rows.length === 0 ? <p className="empty-state">该模式暂时没有手牌记录。</p> : <div className="starting-hand-table-wrap"><table className="starting-hand-table"><thead><tr><th>起手牌</th><th>手数</th><th>单独获胜</th><th>平分</th><th>未获胜</th><th>实战胜率</th></tr></thead><tbody>{rows.map(([hand, result]) => <tr key={hand}>
        <th scope="row">{hand}</th><td data-label="手数">{result.hands}</td><td data-label="单独获胜">{result.wins}</td><td data-label="平分" aria-label={`平分 ${result.splits}`}>{result.splits}</td><td data-label="未获胜">{result.losses}</td><td data-label="实战胜率">{rate(result.wins, result.hands)}</td>
      </tr>)}</tbody></table></div>}
    </section>
    {isTournament && <section className="tournament-history" aria-labelledby="tournament-history-heading">
      <h3 id="tournament-history-heading">最近比赛</h3>
      <p className="starting-hand-note">保留最近 500 场已结算比赛；累计指标不会随记录截断而减少。</p>
      {career.tournamentHistory.length === 0 ? <p className="empty-state">暂无已结算比赛记录。</p> : <div className="tournament-record-list">{career.tournamentHistory.map(record => <article className="tournament-record" key={record.tournamentId}>
        <div className="tournament-record-heading"><strong>{record.mode === 'STANDARD' ? '标准德州' : '短牌德州'} · Lv.{record.tableLevel} {getTableLevel(record.tableLevel).nameZh}</strong><span>{record.status === 'COMPLETED' ? '已完成' : '已退出'}</span></div>
        <p><time dateTime={record.finishedAt}>{new Date(record.finishedAt).toLocaleString('zh-CN')}</time> · 第 {record.humanRank} 名{record.championName && <> · 冠军：{record.championName}</>}</p>
        <dl><div><dt>报名费</dt><dd>{number(record.entryFee)}</dd></div><div><dt>奖金</dt><dd>{number(record.reward)}</dd></div><div><dt>净收益</dt><dd>{number(record.net)}</dd></div></dl>
      </article>)}</div>}
    </section>}
  </section>;
}
