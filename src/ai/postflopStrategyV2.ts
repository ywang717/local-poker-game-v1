import type { Card } from '../game/cards';
import { createDeck } from '../game/cards';
import { compareEvaluations, evaluateHand } from '../game/handEvaluator';
import type { GameMode } from '../game/rules';
import { postflopStrength } from './postflop';
import { calculatePotOdds, calculateSpr } from './decisionFeatures';
import type { AIDifficulty } from './difficulty';
import { getPersonality, type AIPersonality, type PersonalityId } from './personalities';
import { classifyRiverHand } from './riverHandQuality';
import type { RiverHandQuality } from './riverHandQuality';

export { classifyRiverHand } from './riverHandQuality';
export type { RiverHandQuality } from './riverHandQuality';

export type PostflopAction = 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'FOLD' | 'ALL_IN';
export type BoardTexture = 'DRY' | 'WET' | 'PAIRED' | 'MONOTONE' | 'CONNECTED';
export type BoardFeatures = {
  paired: boolean;
  monotone: boolean;
  twoTone: boolean;
  connected: boolean;
  highCardHeavy: boolean;
};
export type PostflopIntent = 'VALUE' | 'SEMI_BLUFF' | 'BLUFF' | 'NONE';
export type PostflopDecision = { action: PostflopAction; intent: PostflopIntent };
export type PostflopDecisionInput = {
  holeCards: readonly Card[]; board: readonly Card[]; mode: GameMode;
  potAmount: number; toCall: number; effectiveStack: number;
  bigBlind?: number; difficulty?: AIDifficulty; priorAggressor?: 'SELF' | 'OPPONENT' | string;
  opponentCount?: number; canCheck?: boolean; canCall?: boolean; canBet?: boolean; canRaise?: boolean; canAllIn?: boolean;
  legalActions?: readonly string[];
  boardTexture?: BoardTexture; simulationBudget?: number;
  effectiveStackBeforeAction?: number;
  effectiveStackBehindAfterCall?: number;
  opponentFoldRate?: number;
  /** Public river line metadata. Counts only aggressive actions on this river. */
  riverAggressiveActionCount?: number;
  riverAggressorPosition?: string;
  /** Needed to distinguish an all-in call from an all-in raise. */
  selfStack?: number;
  /** Personality is a bounded decision preference, never a math/equity input. */
  personality?: PersonalityId | AIPersonality;
};
export type PostflopAnalysis = ReturnType<typeof analyzePostflopV2>;

export function boardFeatures(board: readonly Card[]): BoardFeatures {
  const suits = new Map<string, number>(); for (const card of board) suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  const suitCounts = [...suits.values()];
  const paired = new Set(board.map((card) => card.rank)).size < board.length;
  const monotone = suitCounts.some((count) => count >= 3);
  const twoTone = suitCounts.some((count) => count >= 2);
  const ranks = [...new Set(board.map((card) => card.rank))].sort((a, b) => a - b);
  const connected = ranks.length === 2
    ? paired && ranks[1] - ranks[0] <= 2
    : ranks.some((rank, index) => index >= 2 && rank - ranks[index - 2] <= 4);
  const highCardHeavy = board.length > 0 && board.filter((card) => card.rank >= 12).length >= Math.ceil(board.length / 2);
  return { paired, monotone, twoTone, connected, highCardHeavy };
}

function texture(board: readonly Card[]): BoardTexture {
  const features = boardFeatures(board);
  if (features.monotone) return 'MONOTONE';
  if (features.paired) return 'PAIRED';
  if (features.connected) return 'CONNECTED';
  if (features.highCardHeavy && board.every((card) => card.rank >= 4)) return 'DRY';
  return 'WET';
}

export function analyzePostflopV2(input: PostflopDecisionInput) {
  const strength = postflopStrength(input.holeCards, input.board, input.mode);
  const potOdds = calculatePotOdds(input.toCall, input.potAmount);
  const spr = calculateSpr(input.effectiveStackBehindAfterCall ?? input.effectiveStack, input.potAmount);
  const selectedTexture = input.boardTexture ?? texture(input.board);
  const features = boardFeatures(input.board);
  // Keep the public equity estimate deliberately bounded.  The estimate is
  // used on every post-flop decision, including mobile devices, so a larger
  // difficulty level should improve the sample quality without turning into
  // an unbounded solver.  Multi-way pots use the same budget and spend each
  // sample on all opponents rather than silently modelling heads-up only.
  // Direct strategy callers retain the inexpensive heuristic unless they
  // provide a budget; the turn engine supplies the level-specific profile
  // budget explicitly (including the LV3 12-sample step).
  const budget = input.simulationBudget ?? ((input.difficulty ?? 1) >= 5 ? 48 : (input.difficulty ?? 1) >= 4 ? 32 : 0);
  const estimatedEquity = boundedPublicEquity(input, budget);
  return { ...strength, texture: selectedTexture, features, potOdds, spr, opponentCount: Math.max(1, input.opponentCount ?? 1), priorAggressor: input.priorAggressor ?? 'OPPONENT', simulationBudget: budget, estimatedEquity, effectiveStackBeforeAction: input.effectiveStackBeforeAction ?? input.effectiveStack, effectiveStackBehindAfterCall: input.effectiveStackBehindAfterCall ?? input.effectiveStack, opponentFoldRate: input.opponentFoldRate };
}

/**
 * Sample public runouts and all currently live opponent holdings without
 * looking at hidden cards.  Every card is removed from the sample deck as it
 * is dealt, so opponents cannot receive duplicate cards or cards from the
 * board/runout.  Ties contribute an equal share of the sample equity.
 */
export function boundedPublicEquity(input: PostflopDecisionInput, budget: number): number {
  const samples = Math.max(0, Math.min(48, Math.floor(budget)));
  const fallback = Math.max(0, Math.min(1, postflopStrength(input.holeCards, input.board, input.mode).strength));
  if (samples === 0) return fallback;
  // Use rank/suit identity instead of trusting the card's display id. Test
  // fixtures and old snapshots may use a different id separator, while the
  // physical card identity is always its rank and suit.
  const cardKey = (card: Card): string => `${card.rank}:${card.suit}`;
  const known = new Set([...input.holeCards, ...input.board].map(cardKey));
  const remaining = createDeck(input.mode).filter((card) => !known.has(cardKey(card)));
  const opponentCount = Math.max(1, Math.floor(input.opponentCount ?? 1));
  if (remaining.length < opponentCount * 2) return fallback;
  let total = 0; let seed = 0x9e3779b9;
  for (let index = 0; index < samples; index += 1) {
    seed = Math.imul(seed ^ (index + input.board.length * 131), 1664525) + 1013904223;
    const cards = [...remaining];
    const take = (offset: number): Card => {
      const slot = Math.abs((seed + offset * 1013904223) | 0) % cards.length;
      return cards.splice(slot, 1)[0];
    };
    const opponents: Card[][] = [];
    for (let opponentIndex = 0; opponentIndex < opponentCount; opponentIndex += 1) {
      opponents.push([take(1 + opponentIndex * 2), take(2 + opponentIndex * 2)]);
    }
    const runout = [...input.board];
    while (runout.length < 5 && cards.length > 0) runout.push(take(runout.length + 3));
    const hero = evaluateHand(input.holeCards, runout, input.mode);
    const opponentEvaluations = opponents.map((opponent) => evaluateHand(opponent, runout, input.mode));
    const comparisons = opponentEvaluations.map((evaluation) => compareEvaluations(hero, evaluation, input.mode));
    const worstOpponentComparison = Math.min(...comparisons);
    if (worstOpponentComparison > 0) total += 1;
    else if (worstOpponentComparison === 0) {
      // A tie is split amongst every player sharing the best hand.  The hero
      // is known to be in that group because no opponent beat them.
      const tiedOpponents = comparisons.filter((comparison) => comparison === 0).length;
      total += 1 / (tiedOpponents + 1);
    }
  }
  return total / samples;
}

function deterministicMix(input: PostflopDecisionInput): number {
  const value = [...input.holeCards, ...input.board].reduce((sum, card, index) => sum + card.rank * (index + 3) + card.suit.charCodeAt(0), 0);
  return ((value * 2654435761) >>> 0) / 0x1_0000_0000;
}

function riverMadeHandScore(quality: RiverHandQuality): number {
  switch (quality) {
    case 'AIR': return 0;
    case 'BOARD_ONLY_PAIR': return 0.24;
    case 'BOARD_ONLY_HAND': return 0.43;
    case 'WEAK_PAIR': return 0.4;
    case 'MIDDLE_PAIR': return 0.5;
    case 'TOP_PAIR_WEAK_KICKER': return 0.57;
    case 'TOP_PAIR_GOOD_KICKER': return 0.7;
    case 'OVERPAIR': return 0.74;
    case 'TWO_PAIR_PLUS': return 0.86;
  }
}

function riverCallMargin(input: PostflopDecisionInput, personality: AIPersonality, quality: RiverHandQuality): number {
  const qualityMargin: Record<RiverHandQuality, number> = {
    AIR: 0.2,
    BOARD_ONLY_PAIR: 0.16,
    BOARD_ONLY_HAND: 0.08,
    WEAK_PAIR: 0.1,
    MIDDLE_PAIR: 0.055,
    TOP_PAIR_WEAK_KICKER: 0.035,
    TOP_PAIR_GOOD_KICKER: -0.025,
    OVERPAIR: -0.045,
    TWO_PAIR_PLUS: -0.1,
  };
  const betToPot = input.toCall / Math.max(1, input.potAmount);
  // Convert the price share into an approximate bet/pot fraction so larger
  // river bets demand a modestly stronger bluff-catcher.
  const betFraction = betToPot >= 0.99 ? 100 : betToPot / Math.max(0.01, 1 - betToPot);
  const sizePressure = Math.min(0.08, Math.max(0, betFraction - 0.5) * 0.08);
  const aggressionCount = Math.max(1, input.riverAggressiveActionCount ?? 1);
  const repeatedPressure = Math.min(0.12, (aggressionCount - 1) * 0.06);
  const extraOpponents = Math.max(0, (input.opponentCount ?? 1) - 1);
  const multiwayPressure = Math.min(0.16, extraOpponents * 0.055);
  const earlyAggressor = ['UTG', 'UTG1', 'MP', 'EARLY'].includes(input.riverAggressorPosition ?? '') ? 0.025 : 0;
  const skillMargin = ((input.difficulty ?? 1) - 3) * 0.008;
  return qualityMargin[quality] + sizePressure + repeatedPressure + multiwayPressure + earlyAggressor + skillMargin - personality.callBias * 0.45;
}

function decideRiverFacingBet(
  input: PostflopDecisionInput,
  analysis: PostflopAnalysis,
  personality: AIPersonality,
  mix: number,
  canCall: boolean,
  canRaise: boolean,
  canFold: boolean,
  canAllIn: boolean,
): PostflopDecision {
  const quality = classifyRiverHand(input.holeCards, input.board, input.mode);
  if (quality === 'AIR') {
    if (canFold) return { action: 'FOLD', intent: 'NONE' };
    if (canCall) return { action: 'CALL', intent: 'NONE' };
    if (canAllIn && (input.selfStack ?? Number.POSITIVE_INFINITY) <= input.toCall) return { action: 'ALL_IN', intent: 'NONE' };
    return { action: 'FOLD', intent: 'NONE' };
  }

  const score = riverMadeHandScore(quality);
  const requiredScore = analysis.potOdds + riverCallMargin(input, personality, quality);
  const strongValue = quality === 'TWO_PAIR_PLUS';
  const selfStack = input.selfStack ?? input.effectiveStack;
  const jamThreshold = Math.max(0.82, 0.86 - personality.aggression * 0.04);
  if (strongValue && canAllIn && selfStack > input.toCall && analysis.spr <= 0.9 && score >= jamThreshold) {
    return { action: 'ALL_IN', intent: 'VALUE' };
  }
  if (strongValue && canRaise) {
    const raiseChance = Math.max(0.18, Math.min(0.58,
      0.28 + personality.aggression * 0.8 + (analysis.spr <= 3 ? 0.08 : 0) - (analysis.opponentCount - 1) * 0.07));
    if (mix < raiseChance) return { action: 'RAISE', intent: 'VALUE' };
  }
  if (score >= requiredScore) {
    if (canCall) return { action: 'CALL', intent: 'NONE' };
    if (canAllIn && (input.selfStack ?? Number.POSITIVE_INFINITY) <= input.toCall) return { action: 'ALL_IN', intent: 'NONE' };
  }
  return { action: canFold ? 'FOLD' : canCall ? 'CALL' : 'FOLD', intent: 'NONE' };
}

export function decidePostflopV2WithIntent(input: PostflopDecisionInput): PostflopDecision {
  // The board is complete on the river. The dedicated response deliberately
  // avoids sampling uniformly random holdings that ignore the public bet line.
  const analysisInput = input.board.length === 5 && input.toCall > 0 ? { ...input, simulationBudget: 0 } : input;
  const analysis = analyzePostflopV2(analysisInput);
  const personality = getPersonality(input.personality ?? 'BALANCED');
  const textureAdjustment = analysis.texture === 'WET' || analysis.texture === 'CONNECTED' || analysis.features.monotone || analysis.features.connected
    ? -0.08
    : analysis.texture === 'DRY' || analysis.features.highCardHeavy && !analysis.features.paired ? 0.04 : 0;
  const strength = Math.max(0, Math.min(1, (analysis.simulationBudget > 0 ? analysis.estimatedEquity : analysis.strength) + analysis.drawPotential * 0.35 + textureAdjustment));
  const can = (kind: string, fallback: boolean | undefined): boolean => input.legalActions ? input.legalActions.includes(kind) : fallback !== false;
  const canCheck = can('check', input.canCheck); const canCall = can('call', input.canCall); const canBet = can('bet-to', input.canBet); const canRaise = can('raise-to', input.canRaise); const canAllIn = can('all-in', input.canAllIn);
  const betThreshold = Math.max(0.68, 0.78 - personality.aggression * 0.08);
  const jamThreshold = Math.max(0.82, 0.86 - personality.aggression * 0.04);
  const foldCutoff = Math.max(0.22, analysis.potOdds - 0.08 - personality.callBias * 0.45);
  const callStrength = strength + personality.callBias * 0.5;
  const mix = deterministicMix(input);
  const strongValue = analysis.strength >= 0.7 && (['THREE_OF_A_KIND', 'STRAIGHT', 'FLUSH', 'FULL_HOUSE', 'FOUR_OF_A_KIND', 'STRAIGHT_FLUSH', 'ROYAL_FLUSH'].includes(analysis.madeCategory ?? '') || analysis.madeCategory === 'TWO_PAIR' && strength >= 0.76);
  const draw = analysis.drawPotential >= 0.18;
  if (input.board.length === 5 && input.toCall > 0) {
    return decideRiverFacingBet(input, analysis, personality, mix, canCall, canRaise, can('fold', true), canAllIn);
  }
  if (canAllIn && analysis.spr <= 0.9 && strength >= jamThreshold) return { action: 'ALL_IN', intent: strongValue ? 'VALUE' : 'SEMI_BLUFF' };
  if (input.toCall > 0 && strength < foldCutoff && !draw) return { action: can('fold', true) ? 'FOLD' : (canCheck ? 'CHECK' : 'CALL'), intent: 'NONE' };
  const headsUp = analysis.opponentCount <= 1;
  if (input.toCall > 0 && canRaise && strongValue) {
    const raiseChance = Math.max(0.24, Math.min(0.8, 0.38 + personality.aggression * 0.9 + (analysis.spr <= 3 ? 0.12 : 0) - (analysis.opponentCount - 1) * 0.08));
    if (mix < raiseChance) return { action: 'RAISE', intent: 'VALUE' };
  }
  if (input.toCall > 0 && canRaise && draw && (input.difficulty ?? 1) >= 3) {
    const semiBluffChance = Math.max(0.04, 0.12 + personality.bluffFrequency + personality.aggression * 0.4);
    if (mix < semiBluffChance) return { action: 'RAISE', intent: 'SEMI_BLUFF' };
  }
  if (input.toCall > 0 && canRaise && headsUp && !strongValue && !draw && (input.difficulty ?? 1) >= 5 && (input.opponentFoldRate ?? 0.25) >= 0.55 && mix < 0.08 + personality.bluffFrequency) {
    return { action: 'RAISE', intent: 'BLUFF' };
  }
  if (strength >= betThreshold && (canRaise || canBet)) return { action: canRaise ? 'RAISE' : 'BET', intent: strongValue ? 'VALUE' : draw ? 'SEMI_BLUFF' : 'BLUFF' };
  if (strength >= 0.5 && (canBet || canRaise) && input.toCall <= 0 && (headsUp || analysis.priorAggressor === 'SELF')) return { action: canRaise ? 'RAISE' : 'BET', intent: draw ? 'SEMI_BLUFF' : 'VALUE' };
  if (input.toCall > 0 && canCall && (callStrength >= analysis.potOdds || analysis.drawPotential >= analysis.potOdds * (0.9 - personality.callBias * 0.2))) return { action: 'CALL', intent: 'NONE' };
  return { action: canCheck ? 'CHECK' : input.toCall > 0 && can('fold', true) ? 'FOLD' : canCall ? 'CALL' : 'FOLD', intent: 'NONE' };
}

/** Compatibility wrapper for callers that only need the action kind. */
export function decidePostflopV2(input: PostflopDecisionInput): PostflopAction {
  return decidePostflopV2WithIntent(input).action;
}

export const decidePostflop = decidePostflopV2;
