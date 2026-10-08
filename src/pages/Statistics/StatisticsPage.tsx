import type { CareerState } from '../../career/careerState';
import { useState } from 'react';
import type { GameMode } from '../../game/rules';

export function StatisticsPage({ career }: { career: CareerState }) {
  const [mode, setMode] = useState<GameMode>('STANDARD');
  const stats = career.statistics.overall;
  const vpipRate = stats.totalHands ? Math.round(stats.vpipHands / stats.totalHands * 100) : 0;
  const startingHands = career.statistics.byStartingHand[mode] ?? {};
  const rows = Object.entries(startingHands).sort(([handA, statsA], [handB, statsB]) => statsB.hands - statsA.hands || handA.localeCompare(handB));
  return <section className="page"><p className="eyebrow">生涯数据</p><h2>长期表现</h2><div className="stat-list"><div><span>总手数</span><strong>{stats.totalHands}</strong></div><div><span>获胜手数</span><strong>{stats.wonHands}</strong></div><div><span>胜率</span><strong>{stats.totalHands ? `${Math.round(stats.wonHands / stats.totalHands * 100)}%` : '0%'}</strong></div><div><span>入池率（VPIP）</span><strong>{vpipRate}%</strong></div><div><span>累计盈利</span><strong>{stats.totalProfit.toLocaleString('zh-CN')}</strong></div><div><span>最大底池</span><strong>{stats.largestPot.toLocaleString('zh-CN')}</strong></div><div><span>All-in 胜率</span><strong>{stats.allInCount ? `${Math.round(stats.allInWins / stats.allInCount * 100)}%` : '0%'}</strong></div></div>
    <section className="starting-hand-stats" aria-labelledby="starting-hand-heading">
      <h3 id="starting-hand-heading">手牌胜率</h3>
      <p className="starting-hand-note">按起手牌组合统计：单独获胜手数 ÷ 发到该组合的总手数。平分单独记录；弃牌计入总手数和未获胜手数。</p>
      <div className="segmented" role="group" aria-label="选择统计模式">
        <button type="button" className={mode === 'STANDARD' ? 'selected' : ''} aria-pressed={mode === 'STANDARD'} onClick={() => setMode('STANDARD')}>标准德州</button>
        <button type="button" className={mode === 'SHORT_DECK' ? 'selected' : ''} aria-pressed={mode === 'SHORT_DECK'} onClick={() => setMode('SHORT_DECK')}>短牌德州</button>
      </div>
      {rows.length === 0 ? <p className="empty-state">该模式暂时没有手牌记录。</p> : <div className="starting-hand-table-wrap"><table className="starting-hand-table"><thead><tr><th>起手牌</th><th>手数</th><th>单独获胜</th><th>平分</th><th>未获胜</th><th>实战胜率</th></tr></thead><tbody>{rows.map(([hand, result]) => <tr key={hand}><th scope="row">{hand}</th><td>{result.hands}</td><td>{result.wins}</td><td aria-label={`平分 ${result.splits}`}>{result.splits}</td><td>{result.losses}</td><td>{result.hands ? `${Math.round(result.wins / result.hands * 100)}%` : '—'}</td></tr>)}</tbody></table></div>}
    </section>
  </section>;
}
