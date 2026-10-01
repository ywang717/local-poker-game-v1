import type { DetailedPosition } from './positionStrategy';

export type RaiseIntent = 'OPEN' | 'THREE_BET' | 'FOUR_BET' | 'VALUE' | 'SEMI_BLUFF' | 'BLUFF';

export type RaiseTargetInput = {
  intent?: RaiseIntent | string;
  situation?: string;
  bigBlind?: number;
  currentBet?: number;
  priorRaiseTo?: number;
  potAmount?: number;
  toCall?: number;
  position?: DetailedPosition | 'IP' | 'OOP' | string;
  inPosition?: boolean;
  legalMin?: number;
  legalMax?: number;
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function intentOf(input: RaiseTargetInput): string {
  return String(input.intent ?? input.situation ?? 'VALUE').toUpperCase().replace(/[- ]/g, '_');
}

function isInPosition(input: RaiseTargetInput): boolean {
  if (input.inPosition !== undefined) return input.inPosition;
  const position = String(input.position ?? '').toUpperCase();
  return position === 'IP' || position === 'BTN' || position === 'CO' || position === 'LATE' || position === 'HEADS_UP';
}

/**
 * Return a legal-style total contribution target before final action clamping.
 * The value is deliberately deterministic; randomness belongs in range choice,
 * while sizing remains reproducible for review and simulation.
 */
export function chooseRaiseTarget(input: RaiseTargetInput): number {
  const bigBlind = Math.max(1, Math.round(finite(input.bigBlind, 1)));
  const currentBet = Math.max(0, finite(input.currentBet, 0));
  const priorRaiseTo = Math.max(currentBet, finite(input.priorRaiseTo, currentBet));
  const intent = intentOf(input);
  let target: number;
  if (intent === 'OPEN' || intent === 'UNOPENED' || intent === 'LIMPED') {
    target = Math.round(bigBlind * 2.5);
  } else if (intent === 'THREE_BET' || intent === 'FACING_OPEN' || intent === '3BET') {
    const multiplier = isInPosition(input) ? 3 : 3.75;
    target = Math.round(Math.max(currentBet, bigBlind) * multiplier);
  } else if (intent === 'FOUR_BET' || intent === 'FACING_3BET' || intent === '4BET') {
    target = Math.round(Math.max(priorRaiseTo, currentBet, bigBlind) * 2.4);
  } else {
    const pot = Math.max(bigBlind, finite(input.potAmount, bigBlind));
    const fraction = intent === 'BLUFF' ? 0.5 : intent === 'SEMI_BLUFF' ? 0.66 : 0.75;
    target = Math.round(currentBet + pot * fraction);
  }
  if (input.legalMin !== undefined) target = Math.max(target, input.legalMin);
  if (input.legalMax !== undefined) target = Math.min(target, input.legalMax);
  return Math.max(0, Math.round(target));
}

export function clampRaiseTarget(target: number, legalMin: number, legalMax: number): number {
  return Math.max(Math.ceil(legalMin), Math.min(Math.floor(legalMax), Math.round(target)));
}
