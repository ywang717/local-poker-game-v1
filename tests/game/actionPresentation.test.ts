import { describe, expect, it } from 'vitest';
import { presentPlayerAction } from '../../src/game/actionPresentation';
import type { ActionRecord } from '../../src/game/gameState';

const record = (action: ActionRecord['action'], amount = 125): ActionRecord => ({
  playerId: 'ai', street: 'FLOP', action, amount, totalTo: amount,
});

describe('player action presentation', () => {
  it('uses distinct visual tones for each action', () => {
    expect(presentPlayerAction(record('fold'))).toMatchObject({ label: '弃牌', tone: 'folded', icon: '×' });
    expect(presentPlayerAction(record('check', 0))).toMatchObject({ label: '过牌', tone: 'check', icon: '✓' });
    expect(presentPlayerAction(record('call'))).toMatchObject({ label: '跟注', tone: 'call', icon: '→' });
    expect(presentPlayerAction(record('bet-to'))).toMatchObject({ label: '下注', tone: 'bet', icon: '●' });
    expect(presentPlayerAction(record('raise-to'))).toMatchObject({ label: '加注', tone: 'raise', icon: '●' });
    expect(presentPlayerAction(record('all-in'))).toMatchObject({ label: '全下', tone: 'all-in', icon: '!' });
  });

  it('formats the amount actually committed by the action', () => {
    expect(presentPlayerAction(record('raise-to', 1_250)).amountLabel).toBe('+1,250');
    expect(presentPlayerAction(record('check', 0)).amountLabel).toBe('');
  });
});
