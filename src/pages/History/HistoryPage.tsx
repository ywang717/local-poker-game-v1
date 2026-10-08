import type { CareerState } from '../../career/careerState';
import { useState } from 'react';
import type { HandSummary } from '../../career/handHistory';
import { HandReview } from '../../components/HandReview/HandReview';

export function HistoryPage({ career }: { career: CareerState }) {
  const [selected, setSelected] = useState<HandSummary | null>(career.handHistory[0] ?? null);
  return <section className="page"><p className="eyebrow">手牌记录</p><h2>最近手牌</h2>{career.handHistory.length === 0 ? <p className="empty-state">还没有手牌记录。</p> : <div className="history-layout"><div className="history-list">{career.handHistory.slice(0, 20).map((hand) => <button className={`history-row${selected?.handId === hand.handId ? ' selected' : ''}`} key={hand.handId} onClick={() => setSelected(hand)}><div><strong>{hand.handId}</strong><span>{hand.matchType === 'MINI_TOURNAMENT' ? 'Mini 锦标赛' : '现金桌'} · {hand.mode === 'STANDARD' ? '标准德州' : '短牌德州'} · {hand.tableSize} 人桌</span></div><strong className={hand.playerNet >= 0 ? 'profit' : 'loss'}>{hand.playerNet >= 0 ? '+' : ''}{hand.playerNet.toLocaleString('zh-CN')}{hand.matchType === 'MINI_TOURNAMENT' ? ' 筹码' : ''}</strong></button>)}</div>{selected && <HandReview hand={selected} defaultExpanded collapsible={false} />}</div>}</section>;
}
