import type { LegalAction, PlayerAction } from '../game/gameState';
import { getDifficultyProfile, type AIDifficulty } from './difficulty';
import { getPersonality, type AIPersonality, type PersonalityId } from './personalities';
import { postflopStrength } from './postflop';
import { preflopStrength } from './preflopRanges';
import type { PublicTableContext } from './publicContext';
import { modelRates } from './playerModel';
import { calculatePotOdds, calculateSpr, selectBetFraction, type BettingIntent } from './decisionFeatures';

export type RandomSource = () => number;
export type PersonalityChoice = PersonalityId | AIPersonality;

function random(rng: RandomSource): number {
  const value = rng();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5;
}

function legal(context: PublicTableContext, kind: LegalAction['kind']): LegalAction | undefined {
  return context.legalActions.find((action) => action.kind === kind);
}

function aggressiveAction(context: PublicTableContext, rng: RandomSource, intent: BettingIntent): PlayerAction | undefined {
  const raise = legal(context, 'raise-to') ?? legal(context, 'bet-to');
  if (raise && 'minAmount' in raise) {
    const spr = calculateSpr(context.self.stack, context.potAmount);
    const postflopStreet = context.street === 'FLOP' || context.street === 'TURN' || context.street === 'RIVER' ? context.street : 'FLOP';
    const fraction = context.street === 'PRE_FLOP'
      ? 0.5
      : selectBetFraction({ street: postflopStreet, strength: 0, drawPotential: 0, spr, intent });
    const jitter = (random(rng) - 0.5) * 0.12;
    const target = context.currentBet + Math.round(Math.max(1, context.potAmount) * Math.max(0.25, fraction + jitter));
    return { kind: raise.kind, amount: Math.max(raise.minAmount, Math.min(raise.maxAmount, target)) };
  }
  const spr = calculateSpr(context.self.stack, context.potAmount);
  return intent === 'VALUE' && spr <= 1.25 && legal(context, 'all-in') ? { kind: 'all-in' } : undefined;
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
    ? { strength: preflopStrength(context.self.holeCards, context.mode, { tableSize: context.tableSize, position: context.position, difficulty }), drawPotential: 0 }
    : postflopStrength(context.self.holeCards, context.communityCards, context.mode);
  const modelAdjustment = profile.modelWeight * (averageOpponentFold(context) - 0.25);
  const positionAdjustment = context.position === 'LATE' || context.position === 'HEADS_UP' ? profile.positionWeight : context.position === 'EARLY' ? -profile.positionWeight : 0;
  const potOdds = calculatePotOdds(context.toCall, context.potAmount);
  const spr = calculateSpr(context.self.stack, context.potAmount);
  const adjustedStrength = Math.max(0, Math.min(1, strengthResult.strength + strengthResult.drawPotential * profile.quality + modelAdjustment + positionAdjustment + character.looseness * 0.35));
  const bluffChance = Math.max(0, profile.bluffFrequency + character.bluffFrequency + (context.position === 'LATE' ? 0.04 : 0));
  const roll = random(rng);

  if (context.street === 'PRE_FLOP' && legal(context, 'raise-to') && adjustedStrength >= profile.callThreshold - 0.18 && roll < profile.aggression * 0.35) {
    const pressure = aggressiveAction(context, rng, 'BLUFF');
    if (pressure) return pressure;
  }

  if (adjustedStrength >= profile.valueThreshold || (adjustedStrength >= profile.callThreshold && roll < profile.aggression + character.aggression)) {
    const aggressive = aggressiveAction(context, rng, 'VALUE');
    if (aggressive) return aggressive;
    if (legal(context, 'call')) return { kind: 'call' };
    if (legal(context, 'check')) return { kind: 'check' };
  }

  const pressureChance = profile.aggression * (context.position === 'EARLY' ? 0.12 : 0.28);
  if (legal(context, 'raise-to') && adjustedStrength >= profile.callThreshold - 0.12 && roll < pressureChance) {
    const pressure = aggressiveAction(context, rng, 'BLUFF');
    if (pressure) return pressure;
  }

  if (context.toCall > 0 && adjustedStrength + strengthResult.drawPotential * 0.35 < Math.max(profile.foldThreshold, potOdds) && roll > bluffChance) {
    if (legal(context, 'fold')) return { kind: 'fold' };
    if (legal(context, 'check')) return { kind: 'check' };
  }

  const canSemiBluff = strengthResult.drawPotential >= 0.16 && adjustedStrength < profile.valueThreshold;
  if (canSemiBluff && roll < profile.aggression * 0.75) {
    const semiBluff = aggressiveAction(context, rng, 'SEMI_BLUFF');
    if (semiBluff) return semiBluff;
  }
  if (roll < bluffChance + profile.aggression * 0.12 && (context.position === 'LATE' || spr <= 2.5)) {
    const bluff = aggressiveAction(context, rng, 'BLUFF');
    if (bluff) return bluff;
  }
  const drawCall = strengthResult.drawPotential >= Math.max(0.12, potOdds * 0.9);
  if (legal(context, 'call') && (adjustedStrength + character.callBias >= Math.max(profile.callThreshold - 0.1, potOdds) || drawCall || potOdds <= 0.08)) return { kind: 'call' };
  return fallback(context);
}
