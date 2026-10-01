import type { Street } from '../game/gameState';

export type BettingIntent = 'VALUE' | 'SEMI_BLUFF' | 'BLUFF';

export function calculatePotOdds(toCall: number, potAmount: number): number {
  if (toCall <= 0) return 0;
  return toCall / Math.max(1, potAmount + toCall);
}

export function calculateSpr(effectiveStack: number, potAmount: number): number {
  if (potAmount <= 0) return Math.max(0, effectiveStack);
  return Math.max(0, effectiveStack) / potAmount;
}

export function selectBetFraction({
  street,
  strength: _strength,
  drawPotential: _drawPotential,
  spr: _spr,
  intent,
}: {
  street: Exclude<Street, 'PRE_FLOP' | 'SHOWDOWN' | 'SETTLEMENT'>;
  strength: number;
  drawPotential: number;
  spr: number;
  intent: BettingIntent;
}): 0.33 | 0.5 | 0.66 | 0.75 {
  if (intent === 'BLUFF') return 0.33;
  if (intent === 'SEMI_BLUFF') return 0.5;
  return street === 'RIVER' ? 0.75 : 0.66;
}
