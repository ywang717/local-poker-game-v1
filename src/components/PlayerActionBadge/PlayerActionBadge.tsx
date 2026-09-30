import type { ActionRecord } from '../../game/gameState';
import { presentPlayerAction } from '../../game/actionPresentation';

export function PlayerActionBadge({ action }: { action: Pick<ActionRecord, 'action' | 'amount'> }) {
  const presentation = presentPlayerAction(action);
  return <span className={`action-badge action-badge--${presentation.tone}`} aria-label={`${presentation.label}${presentation.amountLabel}`}>
    <span className="action-badge__icon" aria-hidden="true">{presentation.icon}</span>
    <span>{presentation.label}{presentation.amountLabel && ` ${presentation.amountLabel}`}</span>
    {presentation.tone === 'all-in' && <small>ALL-IN</small>}
  </span>;
}
