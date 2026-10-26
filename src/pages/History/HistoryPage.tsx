import type { CareerState } from '../../career/careerState';
import { useState } from 'react';
import type { HandSummary } from '../../career/handHistory';
import { HandReview } from '../../components/HandReview/HandReview';

export function HistoryPage({ career }: { career: CareerState }) {
  const [selected, setSelected] = useState<HandSummary | null>(career.handHistory[0] ?? null);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(career.handHistory.length / 20));
  const currentPage = Math.min(page, pages - 1);
  return <section className="page"><p className="eyebrow">手牌记录</p><h2>最近手牌</h2>{career.handHistory.length === 0 ? <p className="empty-state">还没有手牌记录。</p> : <div className="history-layout"><div className="history-list">{career.handHistory.slice(currentPage * 20, (currentPage + 1) * 20).map((hand) => <button className={`history-row${selected?.handId === hand.handId ? ' selected' : ''}`} key={hand.handId} onClick={() => setSelected(hand)}><div><strong>{hand.handId}</strong><span>{hand.matchType === 'MINI_TOURNAMENT' ? 'Mini 锦标赛' : '现金桌'} · {hand.mode === 'STANDARD' ? '标准德州' : '短牌德州'} · {hand.tableSize} 人桌</span></div><strong className={hand.playerNet >= 0 ? 'profit' : 'loss'}>{hand.playerNet >= 0 ? '+' : ''}{hand.playerNet.toLocaleString('zh-CN')}{hand.matchType === 'MINI_TOURNAMENT' ? ' 筹码' : ''}</strong></button>)}<nav className="history-pagination" aria-label="手牌记录翻页"><button className="button button--muted" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span>第 {currentPage + 1} / {pages} 页 · 共 {career.handHistory.length.toLocaleString('zh-CN')} 手</span><button className="button button--muted" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>下一页</button></nav></div>{selected && <HandReview key={selected.handId} hand={selected} defaultExpanded collapsible={false} />}</div>}</section>;
}
