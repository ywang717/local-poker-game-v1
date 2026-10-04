import type { CareerState } from '../../career/careerState';

export function StatisticsPage({ career }: { career: CareerState }) {
  const stats = career.statistics.overall;
  const vpipRate = stats.totalHands ? Math.round(stats.vpipHands / stats.totalHands * 100) : 0;
  return <section className="page"><p className="eyebrow">生涯数据</p><h2>长期表现</h2><div className="stat-list"><div><span>总手数</span><strong>{stats.totalHands}</strong></div><div><span>获胜手数</span><strong>{stats.wonHands}</strong></div><div><span>胜率</span><strong>{stats.totalHands ? `${Math.round(stats.wonHands / stats.totalHands * 100)}%` : '0%'}</strong></div><div><span>入池率（VPIP）</span><strong>{vpipRate}%</strong></div><div><span>累计盈利</span><strong>{stats.totalProfit.toLocaleString('zh-CN')}</strong></div><div><span>最大底池</span><strong>{stats.largestPot.toLocaleString('zh-CN')}</strong></div><div><span>All-in 胜率</span><strong>{stats.allInCount ? `${Math.round(stats.allInWins / stats.allInCount * 100)}%` : '0%'}</strong></div></div></section>;
}
