import { useState } from 'react';
import type { CareerState } from '../../career/careerState';
import { getTableAvailability } from '../../career/careerService';
import { TABLE_LEVELS, type TableLevelId } from '../../career/tableLevels';
import type { GameMode } from '../../game/rules';

export function TournamentSelectPage({ career, onEnter, onBack }: { career: CareerState; onEnter: (mode: GameMode, level: TableLevelId) => void; onBack?: () => void }) {
  const [mode, setMode] = useState<GameMode>('STANDARD');
  const [level, setLevel] = useState<TableLevelId>(1);
  const availability = getTableAvailability(career);
  return <section className="page tournament-select-page">
    <div className="page-heading"><div><p className="eyebrow">Mini 锦标赛</p><h2>六人桌 · 一次报名</h2></div><span className="funds-chip">资金 {career.currentFunds.toLocaleString('zh-CN')}</span></div>
    <div className="form-section"><h3>游戏模式</h3><div className="segmented">{(['STANDARD', 'SHORT_DECK'] as const).map((entry) => <button className={mode === entry ? 'selected' : ''} key={entry} onClick={() => setMode(entry)}>{entry === 'STANDARD' ? '标准德州' : '短牌德州'}</button>)}</div></div>
    <div className="form-section"><h3>报名等级</h3><div className="level-grid">{TABLE_LEVELS.map((entry) => { const status = availability.find((item) => item.level.id === entry.id)!; return <button className={`level-card${level === entry.id ? ' selected' : ''}`} disabled={!status.unlocked} key={entry.id} onClick={() => setLevel(entry.id)}><strong>Lv.{entry.id} {entry.nameZh}</strong><span>报名费 {entry.buyIn.toLocaleString('zh-CN')}</span><span>初始筹码 {entry.bigBlind * 100} · 6 人固定</span><small>{status.unlocked ? status.affordable ? '可进入' : '资金不足' : `历史最高 ${status.level.unlockAt.toLocaleString('zh-CN')} 解锁`}</small></button>; })}</div></div>
    <div className="page-links">{onBack && <button className="button button--muted" onClick={onBack}>返回生涯</button>}<button className="button button--primary button--large" disabled={!availability[level - 1].canEnter} onClick={() => onEnter(mode, level)}>支付报名费并进入</button></div>
  </section>;
}
