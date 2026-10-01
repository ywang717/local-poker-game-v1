import type { Card } from '../game/cards';
import { createDeck } from '../game/cards';
import { compareEvaluations, evaluateHand } from '../game/handEvaluator';
import type { GameMode } from '../game/rules';
import { postflopStrength } from './postflop';
import { calculatePotOdds, calculateSpr } from './decisionFeatures';
import type { AIDifficulty } from './difficulty';

export type PostflopAction = 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'FOLD' | 'ALL_IN';
export type BoardTexture = 'DRY' | 'WET' | 'PAIRED' | 'MONOTONE' | 'CONNECTED';
export type PostflopDecisionInput = {
  holeCards: readonly Card[]; board: readonly Card[]; mode: GameMode;
  potAmount: number; toCall: number; effectiveStack: number;
  bigBlind?: number; difficulty?: AIDifficulty; priorAggressor?: 'SELF' | 'OPPONENT' | string;
  opponentCount?: number; canCheck?: boolean; canCall?: boolean; canBet?: boolean; canRaise?: boolean; canAllIn?: boolean;
  legalActions?: readonly string[];
  boardTexture?: BoardTexture; simulationBudget?: number;
};
export type PostflopAnalysis = ReturnType<typeof analyzePostflopV2>;

function texture(board: readonly Card[]): BoardTexture {
  const suits = new Map<string, number>(); for (const card of board) suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  if ([...suits.values()].some((count) => count >= 3)) return 'MONOTONE';
  const ranks = [...new Set(board.map((card) => card.rank))].sort((a, b) => a - b);
  if (ranks.some((rank, index) => index > 0 && rank - ranks[index - 1] <= 2)) return 'CONNECTED';
  if (ranks.length < board.length) return 'PAIRED';
  if (board.length >= 3 && board.some((card) => card.rank >= 12) && board.every((card) => card.rank >= 4)) return 'DRY';
  return 'WET';
}

export function analyzePostflopV2(input: PostflopDecisionInput) {
  const strength = postflopStrength(input.holeCards, input.board, input.mode);
  const potOdds = calculatePotOdds(input.toCall, input.potAmount);
  const spr = calculateSpr(input.effectiveStack, input.potAmount);
  const selectedTexture = input.boardTexture ?? texture(input.board);
  const budget = input.simulationBudget ?? ((input.difficulty ?? 1) >= 5 ? 64 : (input.difficulty ?? 1) >= 4 ? 32 : 0);
  const estimatedEquity = boundedPublicEquity(input, budget);
  return { ...strength, texture: selectedTexture, potOdds, spr, opponentCount: Math.max(1, input.opponentCount ?? 1), priorAggressor: input.priorAggressor ?? 'OPPONENT', simulationBudget: budget, estimatedEquity };
}

/** Sample public runouts and one random opponent holding without hidden data. */
export function boundedPublicEquity(input: PostflopDecisionInput, budget: number): number {
  const samples = Math.max(0, Math.min(64, Math.floor(budget)));
  const fallback = Math.max(0, Math.min(1, postflopStrength(input.holeCards, input.board, input.mode).strength));
  if (samples === 0) return fallback;
  const known = new Set([...input.holeCards, ...input.board].map((card) => card.id));
  const remaining = createDeck(input.mode).filter((card) => !known.has(card.id));
  if (remaining.length < 2) return fallback;
  let total = 0; let seed = 0x9e3779b9;
  for (let index = 0; index < samples; index += 1) {
    seed = Math.imul(seed ^ (index + input.board.length * 131), 1664525) + 1013904223;
    const cards = [...remaining];
    const take = (offset: number): Card => {
      const slot = Math.abs((seed + offset * 1013904223) | 0) % cards.length;
      return cards.splice(slot, 1)[0];
    };
    const opponent = [take(1), take(2)];
    const runout = [...input.board];
    while (runout.length < 5 && cards.length > 0) runout.push(take(runout.length + 3));
    const hero = evaluateHand(input.holeCards, runout, input.mode);
    const villain = evaluateHand(opponent, runout, input.mode);
    const comparison = compareEvaluations(hero, villain, input.mode);
    total += comparison > 0 ? 1 : comparison === 0 ? 0.5 : 0;
  }
  return total / samples;
}

export function decidePostflopV2(input: PostflopDecisionInput): PostflopAction {
  const analysis = analyzePostflopV2(input);
  const textureAdjustment = analysis.texture === 'WET' || analysis.texture === 'CONNECTED' ? -0.08 : analysis.texture === 'DRY' ? 0.04 : 0;
  const strength = Math.max(0, Math.min(1, (analysis.simulationBudget > 0 ? analysis.estimatedEquity : analysis.strength) + analysis.drawPotential * 0.35 + textureAdjustment));
  const can = (kind: string, fallback: boolean | undefined): boolean => input.legalActions ? input.legalActions.includes(kind) : fallback !== false;
  const canCheck = can('check', input.canCheck); const canCall = can('call', input.canCall); const canBet = can('bet-to', input.canBet); const canRaise = can('raise-to', input.canRaise); const canAllIn = can('all-in', input.canAllIn);
  if (canAllIn && analysis.spr <= 0.9 && strength >= 0.86) return 'ALL_IN';
  if (input.toCall > 0 && strength < Math.max(0.22, analysis.potOdds - 0.08)) return can('fold', true) ? 'FOLD' : (canCheck ? 'CHECK' : 'CALL');
  const headsUp = analysis.opponentCount <= 1;
  if (strength >= 0.78 && (canRaise || canBet)) return canRaise ? 'RAISE' : 'BET';
  if (strength >= 0.5 && (canBet || canRaise) && (headsUp || analysis.priorAggressor === 'SELF')) return canRaise ? 'RAISE' : 'BET';
  if (input.toCall > 0 && canCall && (strength >= analysis.potOdds || analysis.drawPotential >= analysis.potOdds * 0.9)) return 'CALL';
  return canCheck ? 'CHECK' : canCall ? 'CALL' : 'FOLD';
}

export const decidePostflop = decidePostflopV2;
