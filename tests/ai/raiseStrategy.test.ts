import { describe, expect, it } from 'vitest';
import { chooseRaiseTarget } from '../../src/ai/raiseStrategy';

describe('V2 raise targets', () => {
  it('uses Raise To semantics for an open, 3-bet and 4-bet', () => {
    expect(chooseRaiseTarget({ intent: 'OPEN', bigBlind: 10 })).toBe(25);
    expect(chooseRaiseTarget({ intent: 'THREE_BET', currentBet: 30, position: 'BTN', bigBlind: 10 })).toBe(90);
    expect(chooseRaiseTarget({ intent: 'THREE_BET', currentBet: 30, position: 'UTG', bigBlind: 10 })).toBe(113);
    expect(chooseRaiseTarget({ intent: 'FOUR_BET', currentBet: 90, bigBlind: 10 })).toBe(216);
  });
});
