import type { HandCategory, GameMode } from '../../game/rules';
import { getRuleConfig } from '../../game/rules';

export function HandRankingGuide({ mode, onClose }: { mode: GameMode; onClose: () => void }) {
  const rules = getRuleConfig(mode);
  const categories = (Object.keys(rules.categoryRank) as HandCategory[])
    .sort((left, right) => rules.categoryRank[right] - rules.categoryRank[left]);

  return <div
    className="hand-ranking-backdrop"
    data-testid="hand-ranking-backdrop"
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <section className="hand-ranking-guide" role="dialog" aria-modal="true" aria-labelledby="hand-ranking-title">
      <div className="hand-ranking-guide__header">
        <div><p className="eyebrow">{mode === 'SHORT_DECK' ? '短牌德州' : '标准德州'}</p><h3 id="hand-ranking-title">牌型大小</h3></div>
        <button type="button" className="link-button" aria-label="关闭牌型大小" onClick={onClose}>关闭牌型大小</button>
      </div>
      <ol className="hand-ranking-list">
        {categories.map((category) => <li key={category}><span className="hand-ranking-list__rank">{rules.categoryRank[category] + 1}</span><strong>{rules.labels[category].zh}</strong><span>{rules.labels[category].en}</span></li>)}
      </ol>
      {mode === 'SHORT_DECK' && <div className="hand-ranking-guide__notes"><p>同花大于葫芦</p><p>A-6-7-8-9 为有效顺子</p></div>}
    </section>
  </div>;
}
