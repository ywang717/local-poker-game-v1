import { useState } from 'react';
import type { CareerState } from '../../career/careerState';
import { getTableAvailability } from '../../career/careerService';
import { TABLE_LEVELS, type TableLevelId } from '../../career/tableLevels';
import type { GameMode } from '../../game/rules';
import type { TableSize } from '../../game/gameState';
import { useSettingsStore } from '../../store/settingsStore';

export function TableSelectPage({ career, onEnter }: { career: CareerState; onEnter: (mode: GameMode, size: TableSize, level: TableLevelId) => void }) {
  const [mode, setMode] = useState<GameMode>('STANDARD');
  const [size, setSize] = useState<TableSize>(6);
  const [level, setLevel] = useState<TableLevelId>(1);
  const [showShortDeckNotice, setShowShortDeckNotice] = useState(false);
  const settings = useSettingsStore();
  const availability = getTableAvailability(career);
  return <section className="page table-select-page">
    <div className="page-heading"><div><p className="eyebrow">选择牌桌</p><h2>开始一手新牌</h2></div><span className="funds-chip">资金 {career.currentFunds.toLocaleString('zh-CN')}</span></div>
    <div className="form-section"><h3>游戏模式</h3><div className="segmented">{(['STANDARD', 'SHORT_DECK'] as const).map((entry) => <button className={mode === entry ? 'selected' : ''} key={entry} onClick={() => { setMode(entry); if (entry === 'SHORT_DECK' && settings.shortDeckNotice) setShowShortDeckNotice(true); }}>{entry === 'STANDARD' ? '标准德州' : '短牌德州'}</button>)}</div></div>
    <div className="form-section"><h3>人数</h3><div className="size-grid">{([2, 3, 4, 5, 6, 8, 9] as const).map((entry) => <button className={size === entry ? 'selected' : ''} key={entry} onClick={() => setSize(entry)}>{entry} 人桌</button>)}</div></div>
    <div className="form-section"><h3>牌桌等级</h3><div className="level-grid">{TABLE_LEVELS.map((entry) => { const status = availability.find((item) => item.level.id === entry.id)!; return <button className={`level-card${level === entry.id ? ' selected' : ''}`} disabled={!status.unlocked} key={entry.id} onClick={() => setLevel(entry.id)}><strong>Lv.{entry.id} {entry.nameZh}</strong><span>SB / BB {entry.smallBlind} / {entry.bigBlind}</span><span>买入 {entry.buyIn.toLocaleString('zh-CN')} · AI {'★'.repeat(entry.aiDifficulty)}</span><small>{status.unlocked ? status.affordable ? '可进入' : '资金不足' : `历史最高 ${entry.unlockAt.toLocaleString('zh-CN')} 解锁`}</small></button>; })}</div></div>
    <button className="button button--primary button--large" disabled={!availability[level - 1].canEnter} onClick={() => onEnter(mode, size, level)}>买入并进入牌桌</button>
    {showShortDeckNotice && <div className="modal-backdrop"><div className="modal" role="dialog"><p className="eyebrow">短牌德州</p><h3>使用 6–A 共 36 张牌</h3><p>同花大于葫芦，A6789 为有效顺子。</p><label><input type="checkbox" onChange={(event) => { if (event.target.checked) { settings.updateSettings({ shortDeckNotice: false }); void settings.save(); } }} /> 不再提示</label><button className="button button--primary" onClick={() => setShowShortDeckNotice(false)}>知道了</button></div></div>}
  </section>;
}
