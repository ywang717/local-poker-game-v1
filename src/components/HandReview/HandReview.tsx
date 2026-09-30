import { useState } from 'react';
import type { HandSummary } from '../../career/handHistory';
import { PlayingCard } from '../PlayingCard/PlayingCard';

const actionLabels: Record<string, string> = {
  fold: '弃牌',
  check: '过牌',
  call: '跟注',
  'bet-to': '下注',
  'raise-to': '加注',
  'all-in': '全下',
};

const streetLabels: Record<string, string> = {
  PRE_FLOP: '翻牌前',
  FLOP: '翻牌',
  TURN: '转牌',
  RIVER: '河牌',
};

export function HandReview({ hand, defaultExpanded = false, collapsible = true }: { hand: HandSummary; defaultExpanded?: boolean; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const potResults = hand.potResults ?? [];
  const resultLabel = hand.result === 'WIN' ? '获胜' : hand.result === 'SPLIT' ? '平分' : hand.result === 'FOLD' ? '弃牌' : '未获胜';
  return <section className="hand-review" aria-label="上一手回顾">
    <div className="hand-review-header"><div><p className="eyebrow">上一手回顾</p><strong>{hand.handId}</strong></div>{collapsible && <button type="button" className="link-button" onClick={() => setExpanded((value) => !value)}>{expanded ? '收起上一手' : '查看上一手'}</button>}</div>
    {expanded && <div className="hand-review-body">
      <div className="hand-review-cards"><div><span>玩家底牌</span><div>{hand.playerHoleCards.length ? hand.playerHoleCards.map((card) => <PlayingCard card={card} key={card.id} />) : '未记录'}</div></div><div><span>公共牌</span><div>{hand.communityCards.length ? hand.communityCards.map((card) => <PlayingCard card={card} key={card.id} />) : '未记录'}</div></div></div>
      <div className="detail-stats"><span>最终牌型 <strong>{hand.finalCategory ?? '无'}</strong></span><span>最终底池 <strong>{hand.finalPot.toLocaleString('zh-CN')}</strong></span><span>结果 <strong className={hand.playerNet >= 0 ? 'profit' : 'loss'}>{resultLabel}</strong></span></div>
      {potResults.length > 0 && <div className="pot-review-list"><strong>底池结算</strong>{potResults.map((pot, index) => <div className="pot-review-row" key={`${hand.handId}-pot-${index}`}><span>{index === 0 ? '主池' : `边池 ${index}`} {pot.amount.toLocaleString('zh-CN')}</span><span>获胜者：{pot.winnerPlayerIds.join('、') || '无'}</span><span>派奖：{pot.awards.map((award) => `${award.playerId} ${award.amount.toLocaleString('zh-CN')}`).join('、') || '无'}</span></div>)}</div>}
      <h4>行动时间线</h4><ol className="timeline">{hand.actionHistory.length ? hand.actionHistory.map((action, index) => <li key={`${action.playerId}-${index}`}><span>{streetLabels[action.street] ?? action.street}</span>{action.playerId} {actionLabels[action.action] ?? action.action} {action.amount.toLocaleString('zh-CN')}</li>) : <li>暂无行动记录</li>}</ol>
    </div>}
  </section>;
}
