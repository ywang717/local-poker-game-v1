import { useMemo, useState } from 'react';
import { getLegalActions } from '../../game/betting';
import type { GameState, PlayerAction } from '../../game/gameState';
import { useSettingsStore } from '../../store/settingsStore';

export function ActionPanel({ game, playerId, onAction }: { game: GameState; playerId: string; onAction: (action: PlayerAction) => void }) {
  const legal = useMemo(() => getLegalActions(game, playerId), [game, playerId]);
  const raiseRule = legal.find((entry) => entry.kind === 'raise-to' || entry.kind === 'bet-to');
  const [amount, setAmount] = useState(0);
  const allInConfirmation = useSettingsStore((state) => state.allInConfirmation);
  const submitRaise = raiseRule && 'minAmount' in raiseRule && amount >= raiseRule.minAmount && amount <= raiseRule.maxAmount;
  const has = (kind: string) => legal.some((entry) => entry.kind === kind);
  const potAmount = game.players.reduce((sum, player) => sum + player.handContribution, 0);
  const quickBet = (fraction: number) => {
    if (!raiseRule || !('minAmount' in raiseRule)) return;
    const base = game.currentBet + Math.round(potAmount * fraction);
    setAmount(Math.max(raiseRule.minAmount, Math.min(raiseRule.maxAmount, base)));
  };
  return <section className="action-panel" aria-label="操作区">
    <button className="button button--secondary" disabled={!has('fold')} onClick={() => onAction({ kind: 'fold' })}>弃牌</button>
    <button className="button button--muted" disabled={!has('check')} onClick={() => onAction({ kind: 'check' })}>过牌</button>
    <button className="button button--muted" disabled={!has('call')} onClick={() => onAction({ kind: 'call' })}>跟注</button>
    <label className="raise-control"><span>下注金额</span><input aria-label="下注金额" type="number" min={raiseRule && 'minAmount' in raiseRule ? raiseRule.minAmount : 0} max={raiseRule && 'maxAmount' in raiseRule ? raiseRule.maxAmount : 0} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span className="quick-bets">{[[1 / 3, '1/3 底池'], [1 / 2, '1/2 底池'], [2 / 3, '2/3 底池'], [1, '1 倍底池']].map(([fraction, label]) => <button type="button" className="quick-bet" key={label as string} disabled={!raiseRule} onClick={() => quickBet(fraction as number)}>{label as string}</button>)}</span></label>
    <button className="button button--primary" disabled={!submitRaise} onClick={() => raiseRule && 'minAmount' in raiseRule && onAction({ kind: raiseRule.kind, amount })}>加注</button>
    <button className="button button--dark" disabled={!has('all-in')} onClick={() => { if (!allInConfirmation || typeof window === 'undefined' || window.confirm('确认全下？')) onAction({ kind: 'all-in' }); }}>全下 <small>ALL-IN</small></button>
  </section>;
}
