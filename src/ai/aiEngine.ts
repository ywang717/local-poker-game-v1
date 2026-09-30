import type { LegalAction, PlayerAction } from '../game/gameState';
import { getDifficultyProfile, type AIDifficulty } from './difficulty';
import { getPersonality, type AIPersonality, type PersonalityId } from './personalities';
import { postflopStrength } from './postflop';
import { preflopStrength } from './preflopRanges';
import type { PublicTableContext } from './publicContext';
import { modelRates } from './playerModel';

export type RandomSource = () => number;
export type PersonalityChoice = PersonalityId | AIPersonality;

function random(rng: RandomSource): number {
  const value = rng();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5;
}

function legal(context: PublicTableContext, kind: LegalAction['kind']): LegalAction | undefined {
  return context.legalActions.find((action) => action.kind === kind);
}

function aggressiveAction(context: PublicTableContext, rng: RandomSource): PlayerAction | undefined {
  const raise = legal(context, 'raise-to') ?? legal(context, 'bet-to');
  if (raise && 'minAmount' in raise) {
    const spread = raise.maxAmount - raise.minAmount;
    const target = raise.minAmount + Math.floor(spread * (0.25 + random(rng) * 0.5));
    return { kind: raise.kind, amount: Math.max(raise.minAmount, Math.min(raise.maxAmount, target)) };
  }
  return legal(context, 'all-in') ? { kind: 'all-in' } : undefined;
}

function fallback(context: PublicTableContext): PlayerAction {
  if (legal(context, 'check')) return { kind: 'check' };
  if (legal(context, 'call')) return { kind: 'call' };
  if (legal(context, 'fold')) return { kind: 'fold' };
  return { kind: 'all-in' };
}

function averageOpponentFold(context: PublicTableContext): number {
  const rates = Object.values(context.opponentModels).map(modelRates).filter((rates) => rates.foldToBet > 0);
  if (rates.length === 0) return 0.25;
  return rates.reduce((sum, rates) => sum + rates.foldToBet, 0) / rates.length;
}

export function chooseAction(
  context: PublicTableContext,
  difficulty: AIDifficulty,
  personality: PersonalityChoice,
  rng: RandomSource,
): PlayerAction {
  if (context.actingSeat !== context.aiSeat) return fallback(context);
  const profile = getDifficultyProfile(difficulty);
  const character = getPersonality(personality);
  const strengthResult = context.street === 'PRE_FLOP'
    ? { strength: preflopStrength(context.self.holeCards, context.mode), drawPotential: 0 }
    : postflopStrength(context.self.holeCards, context.communityCards, context.mode);
  const modelAdjustment = profile.modelWeight * (averageOpponentFold(context) - 0.25);
  const positionAdjustment = context.position === 'LATE' || context.position === 'HEADS_UP' ? profile.positionWeight : context.position === 'EARLY' ? -profile.positionWeight : 0;
  const potOdds = context.toCall > 0 ? context.toCall / Math.max(1, context.potAmount + context.toCall) : 0;
  const adjustedStrength = Math.max(0, Math.min(1, strengthResult.strength + strengthResult.drawPotential * profile.quality + modelAdjustment + positionAdjustment + character.looseness * 0.35));
  const bluffChance = Math.max(0, profile.bluffFrequency + character.bluffFrequency + (context.position === 'LATE' ? 0.04 : 0));
  const roll = random(rng);

  if (adjustedStrength >= profile.valueThreshold || (adjustedStrength >= profile.callThreshold && roll < profile.aggression + character.aggression)) {
    const aggressive = aggressiveAction(context, rng);
    if (aggressive) return aggressive;
    if (legal(context, 'call')) return { kind: 'call' };
    if (legal(context, 'check')) return { kind: 'check' };
  }

  if (context.toCall > 0 && adjustedStrength < profile.foldThreshold + potOdds * 0.75 && roll > bluffChance) {
    if (legal(context, 'fold')) return { kind: 'fold' };
    if (legal(context, 'check')) return { kind: 'check' };
  }

  if (roll < bluffChance + profile.aggression * 0.12) {
    const bluff = aggressiveAction(context, rng);
    if (bluff) return bluff;
  }
  if (legal(context, 'call') && (adjustedStrength >= profile.callThreshold - character.callBias || potOdds <= 0.2)) return { kind: 'call' };
  return fallback(context);
}
