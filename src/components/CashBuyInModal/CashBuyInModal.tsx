import { useMemo, useState } from 'react';
import { getCashBuyInOptions } from '../../career/cashBuyInService';
import { getTableLevel, type TableLevel, type TableLevelId } from '../../career/tableLevels';
import './CashBuyInModal.css';

export type CashBuyInModalProps = {
  level: TableLevel | TableLevelId;
  tableStack: number;
  currentFunds: number;
  pending: boolean;
  onConfirm: (targetStack: number) => void;
  onClose: () => void;
  onCancelPending?: () => void;
};

export function CashBuyInModal({ level, tableStack, currentFunds, pending, onConfirm, onClose, onCancelPending }: CashBuyInModalProps) {
  const tableLevel = typeof level === 'number' ? getTableLevel(level) : level;
  const [customTarget, setCustomTarget] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const options = useMemo(() => getCashBuyInOptions(tableLevel.id, tableStack, currentFunds), [currentFunds, tableLevel.id, tableStack]);
  const customValue = Number(customTarget);
  const cap = tableLevel.bigBlind * 100;
  const customValid = customTarget.trim() !== ''
    && /^\d+$/.test(customTarget.trim())
    && Number.isSafeInteger(customValue)
    && customValue > tableStack
    && customValue <= cap
    && customValue - tableStack <= currentFunds;
  const target = customTarget.trim() ? (customValid ? customValue : null) : selectedTarget;
  const targetLabel = target === null ? '' : target.toLocaleString('zh-CN');

  return <div className="modal-backdrop" role="presentation">
    <section className="cash-buy-in-modal" role="dialog" aria-modal="true" aria-labelledby="cash-buy-in-title">
      <div>
        <p className="eyebrow">现金桌买入</p>
        <h3 id="cash-buy-in-title">补充桌上筹码</h3>
      </div>
      <p>当前桌上 {tableStack.toLocaleString('zh-CN')}，余额 {currentFunds.toLocaleString('zh-CN')}。买入会在下一手开始时生效。</p>
      {pending && <p className="cash-buy-in-pending" role="status" aria-live="polite">买入申请已提交，将在下一手开始时生效</p>}
      {!pending && <>
        <div className="cash-buy-in-options" aria-label="买入目标">
          {options.map((option) => <button className={selectedTarget === option.targetStack && !customTarget ? 'selected' : ''} disabled={!option.affordable} key={option.targetStack} type="button" onClick={() => { setCustomTarget(''); setSelectedTarget(option.targetStack); }}>
            <strong>{option.label}</strong><small>补充 {option.amount.toLocaleString('zh-CN')}</small>
          </button>)}
        </div>
        <label className="cash-buy-in-custom">自定义目标桌上筹码
          <input name="customTargetStack" inputMode="numeric" min={tableStack + 1} max={cap} pattern="[0-9]*" placeholder={`1-${cap.toLocaleString('zh-CN')}`} value={customTarget} onChange={(event) => setCustomTarget(event.target.value)} onInput={(event) => setCustomTarget(event.currentTarget.value)} />
        </label>
        {customTarget.trim() !== '' && !customValid && <span className="cash-buy-in-error" role="alert">请输入高于当前桌上筹码、不超过 100BB 且余额足够的整数</span>}
        <p className="cash-buy-in-selection">目标桌上筹码：{targetLabel || '未选择'}</p>
      </>}
      <div className="cash-buy-in-actions">
        {pending && <button className="button button--secondary" data-testid="cash-buy-in-cancel" type="button" onClick={() => onCancelPending?.()}>取消买入</button>}
        <button className="button button--secondary" data-testid="cash-buy-in-close" type="button" onClick={onClose}>关闭</button>
        {!pending && <button className="button button--primary" data-testid="cash-buy-in-confirm" type="button" disabled={target === null} onClick={() => { if (target !== null) onConfirm(target); }}>确认买入</button>}
      </div>
    </section>
  </div>;
}
