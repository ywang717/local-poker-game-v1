import type { CareerState } from '../../career/careerState';

export function CareerPage({ career, onEnterTable, onNavigate }: { career: CareerState; onEnterTable: () => void; onNavigate: (view: 'STATISTICS' | 'HISTORY' | 'SETTINGS') => void }) {
  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">生涯主页</p><h2>{career.nickname}</h2></div><button className="link-button" onClick={() => onNavigate('SETTINGS')}>设置</button></div>
    <div className="hero-stat"><span>生涯资金</span><strong>{career.currentFunds.toLocaleString('zh-CN')}</strong></div>
    <div className="stat-grid"><div><span>历史最高</span><strong>{career.peakFunds.toLocaleString('zh-CN')}</strong></div><div><span>累计盈利</span><strong>{career.statistics.overall.totalProfit.toLocaleString('zh-CN')}</strong></div><div><span>总手数</span><strong>{career.statistics.overall.totalHands}</strong></div><div><span>最高牌桌</span><strong>Lv.{Math.max(...career.unlockedLevels)}</strong></div></div>
    <button className="button button--primary button--large" onClick={onEnterTable}>进入牌桌</button>
    <div className="page-links"><button className="button button--muted" onClick={() => onNavigate('STATISTICS')}>生涯数据</button><button className="button button--muted" onClick={() => onNavigate('HISTORY')}>手牌记录</button></div>
  </section>;
}
