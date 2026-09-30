import type { CareerState } from '../../career/careerState';
import { useState } from 'react';
import type { HandSummary } from '../../career/handHistory';
import { PlayingCard } from '../../components/PlayingCard/PlayingCard';

export function HistoryPage({ career }: { career: CareerState }) {
  const [selected, setSelected] = useState<HandSummary | null>(career.handHistory[0] ?? null);
  return <section className="page"><p className="eyebrow">手牌记录</p><h2>最近手牌</h2>{career.handHistory.length === 0 ? <p className="empty-state">还没有手牌记录。</p> : <div className="history-layout"><div className="history-list">{career.handHistory.slice(0, 20).map((hand) => <button className={`history-row${selected?.handId === hand.handId ? ' selected' : ''}`} key={hand.handId} onClick={() => setSelected(hand)}><div><strong>{hand.handId}</strong><span>{hand.mode === 'STANDARD' ? '标准德州' : '短牌德州'} · {hand.tableSize} 人桌</span></div><strong className={hand.playerNet >= 0 ? 'profit' : 'loss'}>{hand.playerNet >= 0 ? '+' : ''}{hand.playerNet.toLocaleString('zh-CN')}</strong></button>)}</div>{selected && <HandDetail hand={selected} />}</div>}</section>;
}

function HandDetail({ hand }: { hand: HandSummary }) {
  return <article className="hand-detail"><p className="eyebrow">手牌详情</p><h3>{hand.handId}</h3><div className="detail-cards"><div><span>玩家底牌</span><div>{hand.playerHoleCards.length ? hand.playerHoleCards.map((card) => <PlayingCard card={card} key={card.id} />) : '未记录'}</div></div><div><span>公共牌</span><div>{hand.communityCards.length ? hand.communityCards.map((card) => <PlayingCard card={card} key={card.id} />) : '未记录'}</div></div></div><div className="detail-stats"><span>最终牌型 <strong>{hand.finalCategory ?? '无'}</strong></span><span>最终底池 <strong>{hand.finalPot.toLocaleString('zh-CN')}</strong></span><span>结果 <strong>{hand.result === 'WIN' ? '获胜' : hand.result === 'SPLIT' ? '平分' : '未获胜'}</strong></span></div><h4>行动时间线</h4><ol className="timeline">{hand.actionHistory.map((action, index) => <li key={`${action.playerId}-${index}`}><span>{action.street}</span>{action.playerId} {action.action} {action.amount}</li>)}</ol></article>;
}
