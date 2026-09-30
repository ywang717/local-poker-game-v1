import type { ActionRecord } from './gameState';

export type ActionPresentationTone = 'folded' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export type ActionPresentation = {
  label: string;
  tone: ActionPresentationTone;
  icon: '×' | '✓' | '→' | '●' | '!';
  amountLabel: string;
};

const PRESENTATIONS: Readonly<Record<ActionRecord['action'], Omit<ActionPresentation, 'amountLabel'>>> = {
  fold: { label: '弃牌', tone: 'folded', icon: '×' },
  check: { label: '过牌', tone: 'check', icon: '✓' },
  call: { label: '跟注', tone: 'call', icon: '→' },
  'bet-to': { label: '下注', tone: 'bet', icon: '●' },
  'raise-to': { label: '加注', tone: 'raise', icon: '●' },
  'all-in': { label: '全下', tone: 'all-in', icon: '!' },
};

export function presentPlayerAction(action: Pick<ActionRecord, 'action' | 'amount'>): ActionPresentation {
  const presentation = PRESENTATIONS[action.action];
  const amountLabel = action.amount > 0 ? `+${action.amount.toLocaleString('en-US')}` : '';
  return { ...presentation, amountLabel };
}
