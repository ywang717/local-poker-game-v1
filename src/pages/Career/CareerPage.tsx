import type { CareerState } from '../../career/careerState';

export function CareerPage({ career, onEnterTable, onEnterTournament, onViewTournamentCareer, onNavigate }: { career: CareerState; onEnterTable: () => void; onEnterTournament?: () => void; onViewTournamentCareer?: () => void; onNavigate: (view: 'STATISTICS' | 'HISTORY' | 'SETTINGS') => void }) {
  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">生涯主页</p><h2>{career.nickname}</h2></div><button className="link-button" onClick={() => onNavigate('SETTINGS')}>设置</button></div>
    <div className="hero-stat"><span>生涯资金</span><strong>{career.currentFunds.toLocaleString('zh-CN')}</strong></div>
    <div className="stat-grid"><div><span>历史最高</span><strong>{career.peakFunds.toLocaleString('zh-CN')}</strong></div><div><span>累计盈利</span><strong>{career.statistics.overall.totalProfit.toLocaleString('zh-CN')}</strong></div><div><span>总手数</span><strong>{career.statistics.overall.totalHands}</strong></div><div><span>最高牌桌</span><strong>Lv.{Math.max(...career.unlockedLevels)}</strong></div></div>
    <button className="button button--primary button--large" onClick={onEnterTable}>进入牌桌</button>
    {onEnterTournament && <button className="button button--secondary button--large" onClick={onEnterTournament}>进入 Mini 锦标赛</button>}
    <div className="stat-grid tournament-career-stats"><div><span>锦标赛场次</span><strong>{career.tournamentStatistics.tournamentsPlayed}</strong></div><div><span>锦标赛胜场</span><strong>{career.tournamentStatistics.tournamentsWon}</strong></div><div><span>锦标赛净收益</span><strong>{career.tournamentStatistics.totalNet.toLocaleString('zh-CN')}</strong></div></div>
    <div className="page-links">{onViewTournamentCareer && <button className="button button--muted" onClick={onViewTournamentCareer}>查看锦标赛生涯</button>}<button className="button button--muted" onClick={() => onNavigate('STATISTICS')}>生涯数据</button><button className="button button--muted" onClick={() => onNavigate('HISTORY')}>手牌记录</button></div>
  </section>;
}
