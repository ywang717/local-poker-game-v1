export type JamDecision = 'JAM' | 'RAISE' | 'CALL' | 'FOLD';
export type JamSituation = 'OPEN' | 'UNOPENED' | 'FACING_OPEN' | 'FACING_3BET' | 'FACING_4BET' | 'FACING_4BET_PLUS' | 'FACING_ALL_IN' | 'POSTFLOP' | string;
export type JamInput = {
  situation?: JamSituation;
  effectiveStackBB?: number;
  effectiveStack?: number;
  bigBlind?: number;
  handStrength?: number;
  rangeWeight?: number;
  equity?: number;
  potOdds?: number;
  drawPotential?: number;
  canRaise?: boolean;
  canCall?: boolean;
  canFold?: boolean;
  priorAggressor?: 'SELF' | 'OPPONENT' | string;
  opponentCount?: number;
  /** Public position metadata used to tighten deep early-position jams. */
  jammerPosition?: string;
  heroPosition?: string;
  jamType?: 'OPEN_JAM' | '3BET_JAM' | '4BET_JAM' | 'POSTFLOP_JAM' | string;
  mode?: 'STANDARD' | 'SHORT_DECK';
};

function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)); }
function strength(input: JamInput): number { return clamp(input.handStrength ?? input.equity ?? input.rangeWeight ?? 0, 0, 1); }
function stackBB(input: JamInput): number {
  if (input.effectiveStackBB !== undefined) return Math.max(0, input.effectiveStackBB);
  const blind = Math.max(1, input.bigBlind ?? 1);
  return Math.max(0, (input.effectiveStack ?? 0) / blind);
}

function jamCallThreshold(input: JamInput, stack: number): number {
  if (String(input.situation ?? '').toUpperCase() !== 'FACING_ALL_IN') return 0;
  // A deep all-in represents a much stronger range than a push/fold jam.
  // Short-deck widens the threshold slightly, but never enough to make an
  // 80BB+ jam a routine call with a marginal hand.
  const shortDeckAdjustment = input.mode === 'SHORT_DECK' ? -0.04 : 0;
  const bucket = stack <= 10 ? 0.36 : stack <= 20 ? 0.46 : stack <= 40 ? 0.56 : stack <= 80 ? 0.66 : 0.74;
  const positionAdjustment = ['UTG', 'UTG1', 'MP', 'HJ'].includes(String(input.jammerPosition ?? '').toUpperCase()) ? 0.04 : 0;
  const typeAdjustment = String(input.jamType ?? '').toUpperCase() === '4BET_JAM' ? 0.05 : String(input.jamType ?? '').toUpperCase() === '3BET_JAM' ? 0.02 : 0;
  return clamp(bucket + positionAdjustment + typeAdjustment + shortDeckAdjustment, 0.28, 0.9);
}

/** Decide whether an all-in is a planned range action, never an emergency fallback. */
export function decideJam(input: JamInput): JamDecision {
  const situation = String(input.situation ?? 'POSTFLOP').toUpperCase();
  const stack = stackBB(input);
  const strengthValue = strength(input);
  const potOdds = clamp(input.potOdds ?? 1, 0, 1);
  const canRaise = input.canRaise !== false;
  const canCall = input.canCall !== false;
  const postflop = situation === 'POSTFLOP' || situation === 'FLOP' || situation === 'TURN' || situation === 'RIVER';
  const jamCap = postflop ? 18 : situation === 'FACING_4BET' || situation === 'FACING_4BET_PLUS' ? 35 : situation === 'FACING_3BET' ? 30 : 20;
  const threshold = postflop ? 0.84 : situation === 'FACING_4BET' || situation === 'FACING_4BET_PLUS' ? 0.9 : situation === 'FACING_3BET' ? 0.82 : 0.78;
  if (canRaise && stack <= jamCap && strengthValue >= threshold) return 'JAM';
  if (canRaise && stack <= jamCap && postflop && (strengthValue + (input.drawPotential ?? 0) * 0.4) >= 0.78) return 'JAM';
  if (situation === 'FACING_ALL_IN') {
    const required = jamCallThreshold(input, stack);
    if (canCall && strengthValue >= Math.max(required, potOdds + (stack > 80 ? 0.08 : 0))) return 'CALL';
    return input.canFold === false && canCall ? 'CALL' : 'FOLD';
  }
  if (canCall && strengthValue >= Math.max(0.35, potOdds - 0.05)) return 'CALL';
  if (canRaise && strengthValue >= threshold - 0.12 && stack > jamCap) return 'RAISE';
  return input.canFold === false && canCall ? 'CALL' : 'FOLD';
}
