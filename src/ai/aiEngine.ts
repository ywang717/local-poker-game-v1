import type { LegalAction, PlayerAction } from '../game/gameState';
import type { MatchType } from '../match/matchTypes';
import { getDifficultyProfile, type AIDifficulty } from './difficulty';
import { getPersonality, type AIPersonality, type PersonalityId } from './personalities';
import { postflopStrength } from './postflop';
import { normalizeHandClass, classifyPreflopSituation, weightedPreflopRange, type PreflopSituation } from './preflopStrategy';
import type { PublicTableContext } from './publicContext';
import { modelRates } from './playerModel';
import { calculatePotOdds, calculateSpr } from './decisionFeatures';
import { chooseRaiseTarget, clampRaiseTarget } from './raiseStrategy';
import { decideJam } from './jamStrategy';
import { decidePostflopV2 } from './postflopStrategyV2';

export type RandomSource = () => number;
export type PersonalityChoice = PersonalityId | AIPersonality;
export type TournamentDecisionContext = { stackBB?: number; effectiveStackBB?: number; blindLevel?: number; handsAtLevel?: number; playersRemaining?: number; pressure?: number; payoutPressure?: number };
export type DecisionOptions = { matchType?: MatchType; tournament?: TournamentDecisionContext; forcedPersonality?: PersonalityId };
function random(rng: RandomSource): number { const value = rng(); return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5; }
function legal(context: PublicTableContext, kind: LegalAction['kind']): LegalAction | undefined { return context.legalActions.find((action) => action.kind === kind); }
function fallback(context: PublicTableContext): PlayerAction { if (legal(context, 'check')) return { kind: 'check' }; if (legal(context, 'call')) return { kind: 'call' }; if (legal(context, 'fold')) return { kind: 'fold' }; return { kind: 'all-in' }; }
function averageOpponentFold(context: PublicTableContext): number { const rates = Object.values(context.opponentModels).map(modelRates).filter((entry) => entry.foldToBet > 0); return rates.length ? rates.reduce((sum, entry) => sum + entry.foldToBet, 0) / rates.length : 0.25; }
function handStrength(context: PublicTableContext): number {
  const hand = normalizeHandClass(context.self.holeCards, context.mode); const high = hand.high; const low = hand.low;
  if (hand.category === 'PAIR') return Math.min(1, 0.52 + (high - 2) * 0.035);
  let score = 0.16 + (high - 8) * 0.045 + (low - 6) * 0.02;
  if (hand.category === 'SUITED') score += 0.08;
  if (high === 14) score += low >= 10 ? 0.26 : low >= 5 ? 0.12 : 0.02;
  if (high === 13 && low >= 10) score += 0.15;
  if (high === 12 && low >= 10) score += 0.08;
  if (high - low <= 2) score += 0.06;
  return Math.max(0, Math.min(1, score));
}
function isAggressive(kind: PlayerAction['kind']): boolean { return kind === 'bet-to' || kind === 'raise-to' || kind === 'all-in'; }
function detailedPositionForSeat(context: PublicTableContext, seat: number): string {
  const seats = [...new Set(context.players.map((player) => player.seat))].sort((left, right) => left - right);
  const dealerIndex = seats.indexOf(context.dealerSeat); const playerIndex = seats.indexOf(seat);
  if (playerIndex < 0 || dealerIndex < 0 || seats.length <= 2) return 'HEADS_UP';
  const distance = (playerIndex - dealerIndex + seats.length) % seats.length;
  if (distance === 0) return 'BTN'; if (seat === context.smallBlindSeat) return 'SB'; if (seat === context.bigBlindSeat) return 'BB';
  const labels = seats.length >= 8 ? ['UTG', 'UTG1', 'MP', 'HJ', 'CO'] : seats.length === 6 ? ['UTG', 'UTG1', 'MP', 'CO'] : ['UTG', 'MP', 'HJ', 'CO'];
  return labels[Math.max(0, distance - 3)] ?? 'MP';
}
function openerPosition(context: PublicTableContext, openerId?: string): string {
  const opener = openerId ? context.players.find((player) => player.id === openerId) : undefined;
  return opener ? detailedPositionForSeat(context, opener.seat) : 'UTG';
}
function rangeWeight(context: PublicTableContext, difficulty: AIDifficulty, situation: PreflopSituation): number {
  const position = context.detailedPosition ?? (context.position === 'LATE' ? 'BTN' : context.position === 'EARLY' ? 'UTG' : 'MP');
  const range = weightedPreflopRange({ mode: context.mode, difficulty, position: position as never, situation });
  const hand = normalizeHandClass(context.self.holeCards, context.mode);
  return range.classes.find((entry) => entry.notation === hand.notation)?.weight ?? 0;
}
function raiseAction(context: PublicTableContext, intent: 'OPEN' | 'THREE_BET' | 'FOUR_BET' | 'VALUE' | 'SEMI_BLUFF' | 'BLUFF', position: string): PlayerAction | undefined {
  const action = legal(context, 'raise-to') ?? legal(context, 'bet-to'); if (!action || !('minAmount' in action)) return undefined;
  const target = chooseRaiseTarget({ intent, bigBlind: context.bigBlind, currentBet: context.currentBet, potAmount: context.potAmount, position });
  return { kind: action.kind, amount: clampRaiseTarget(target, action.minAmount, action.maxAmount) };
}
function preflopAction(context: PublicTableContext, difficulty: AIDifficulty, personality: AIPersonality, rng: RandomSource, options: DecisionOptions): PlayerAction | undefined {
  const classification = classifyPreflopSituation(context); const situation = classification.situation; const strength = handStrength(context); const hand = normalizeHandClass(context.self.holeCards, context.mode); const suitedWheelA = hand.high === 14 && hand.low >= 4 && hand.low <= 5 && hand.category === 'SUITED'; const position = context.detailedPosition ?? context.position; const effectiveStackBB = options.tournament?.effectiveStackBB ?? classification.effectiveStack / Math.max(1, context.bigBlind); const canRaise = Boolean(legal(context, 'raise-to') ?? legal(context, 'bet-to')); const canCall = Boolean(legal(context, 'call')); const canAllIn = Boolean(legal(context, 'all-in')); const range = rangeWeight(context, difficulty, situation); const pressure = Math.max(0, Math.min(0.2, options.tournament?.pressure ?? options.tournament?.payoutPressure ?? 0));
  const jam = (threshold: number, cap: number): PlayerAction | undefined => { const decision = decideJam({ situation, effectiveStackBB, handStrength: strength, canRaise, canCall }); const openJamRequiresShortHero = (situation === 'UNOPENED' || situation === 'LIMPED') && context.self.stack / Math.max(1, context.bigBlind) > cap; if (decision === 'JAM' && !openJamRequiresShortHero && canAllIn && strength >= threshold && effectiveStackBB <= cap) return { kind: 'all-in' }; return undefined; };
  if (situation === 'FACING_ALL_IN') { const decision = decideJam({ situation, effectiveStackBB, handStrength: strength, potOdds: calculatePotOdds(context.toCall, context.potAmount), canRaise, canCall }); if (decision === 'JAM' && canAllIn) return { kind: 'all-in' }; if ((decision === 'CALL' || decision === 'RAISE') && canCall) return { kind: 'call' }; return undefined; }
  if (situation === 'UNOPENED' || situation === 'LIMPED') { const openThreshold = 0.46 + (5 - difficulty) * 0.025 - personality.looseness * 0.2 + pressure; const occasionalOpen = situation === 'UNOPENED' && range >= 0.15 && random(rng) < 0.02 * difficulty; if (range >= openThreshold || strength >= 0.58 - personality.looseness * 0.2 || (position === 'BTN' || position === 'CO') && strength >= 0.45 || occasionalOpen) { const allIn = jam(0.9, 18); if (allIn) return allIn; return canRaise ? raiseAction(context, 'OPEN', position) : canCall ? { kind: 'call' } : undefined; } if (situation === 'LIMPED' && canCall && range >= 0.2 && strength >= 0.35) return { kind: 'call' }; return undefined; }
  if (situation === 'FACING_OPEN') { const opener = openerPosition(context, classification.openerId); const openerTightness = opener === 'UTG' || opener === 'UTG1' ? 0.08 : opener === 'CO' || opener === 'BTN' ? -0.04 : 0; const value3Bet = range >= 0.48 + openerTightness + pressure && strength >= 0.72; const bluff3Bet = suitedWheelA && (position === 'BTN' || position === 'CO') && range >= 0.18 && random(rng) < 0.08 + difficulty * 0.025; if (value3Bet || bluff3Bet) { const allIn = jam(0.9, 20); if (allIn) return allIn; return canRaise ? raiseAction(context, 'THREE_BET', position) : canCall ? { kind: 'call' } : undefined; } if (canCall && range >= 0.25 + pressure * 1.5 && strength >= 0.42 && context.toCall <= context.potAmount * 0.5) return { kind: 'call' }; return undefined; }
  if (situation === 'FACING_3BET') { const value4Bet = range >= 0.58 + pressure && strength >= (hand.category === 'PAIR' ? 0.8 : 0.84); const bluff4Bet = suitedWheelA && difficulty >= 3 && range >= 0.12 && random(rng) < 0.04 + difficulty * 0.02; const premium = hand.notation === 'AA' || hand.notation === 'KK' || hand.notation === 'QQ' || hand.notation === 'AKs'; if (value4Bet || bluff4Bet || premium) { const allIn = jam(0.94, 30); if (allIn) return allIn; return canRaise ? raiseAction(context, 'FOUR_BET', position) : canCall ? { kind: 'call' } : undefined; } if (canCall && range >= 0.3 && strength >= 0.58 - pressure) return { kind: 'call' }; return undefined; }
  if (situation === 'FACING_4BET_PLUS') { if (strength >= 0.93 && range >= 0.65) { const allIn = jam(0.95, 35); if (allIn) return allIn; if (canRaise) return raiseAction(context, 'FOUR_BET', position); } if (canCall && strength >= 0.8 && range >= 0.45) return { kind: 'call' }; }
  return undefined;
}
function postflopAction(context: PublicTableContext, difficulty: AIDifficulty, simulationBudget: number): PlayerAction | undefined {
  const lastAggressor = [...context.actionHistory].reverse().find((entry) => entry.street === context.street && isAggressive(entry.action));
  const decision = decidePostflopV2({ holeCards: context.self.holeCards, board: context.communityCards, mode: context.mode, potAmount: context.potAmount, toCall: context.toCall, effectiveStack: context.self.stack, bigBlind: context.bigBlind, difficulty, simulationBudget, priorAggressor: lastAggressor?.playerId === context.aiPlayerId ? 'SELF' : 'OPPONENT', opponentCount: context.opponents.filter((opponent) => !opponent.folded).length, legalActions: context.legalActions.map((entry) => entry.kind) });
  if (decision === 'CHECK' && legal(context, 'check')) return { kind: 'check' }; if (decision === 'CALL' && legal(context, 'call')) return { kind: 'call' }; if (decision === 'FOLD' && legal(context, 'fold')) return { kind: 'fold' }; if (decision === 'ALL_IN' && legal(context, 'all-in')) return { kind: 'all-in' }; if (decision === 'BET' || decision === 'RAISE') return raiseAction(context, 'VALUE', context.detailedPosition ?? context.position); return undefined;
}
export function chooseAction(context: PublicTableContext, difficulty: AIDifficulty, personality: PersonalityChoice, rng: RandomSource, options: DecisionOptions = {}): PlayerAction {
  if (context.actingSeat !== context.aiSeat) return fallback(context); const profile = getDifficultyProfile(difficulty); const character = getPersonality(options.forcedPersonality ?? personality);
  const decisionOptions = options.matchType === 'MINI_TOURNAMENT' && !options.tournament ? { ...options, tournament: { pressure: 0.04 } } : options;
  if (context.street === 'PRE_FLOP') { const action = preflopAction(context, difficulty, character, rng, decisionOptions); if (action) return action; if (context.toCall <= 0 && legal(context, 'check')) return { kind: 'check' }; if (legal(context, 'fold')) return { kind: 'fold' }; return fallback(context); }
  const postflop = postflopAction(context, difficulty, profile.postflopSimulationBudget); if (postflop) return postflop;
  const strengthResult = postflopStrength(context.self.holeCards, context.communityCards, context.mode); const modelAdjustment = profile.modelWeight * (averageOpponentFold(context) - 0.25); const positionAdjustment = context.position === 'LATE' || context.position === 'HEADS_UP' ? profile.positionWeight : context.position === 'EARLY' ? -profile.positionWeight : 0; const adjustedStrength = Math.max(0, Math.min(1, strengthResult.strength + strengthResult.drawPotential * profile.quality + modelAdjustment + positionAdjustment + character.looseness * 0.2)); const potOdds = calculatePotOdds(context.toCall, context.potAmount); const spr = calculateSpr(context.self.stack, context.potAmount); const roll = random(rng); const bluffChance = Math.max(0, profile.bluffFrequency + character.bluffFrequency);
  if (adjustedStrength >= profile.valueThreshold && roll < profile.aggression + character.aggression) { const action = raiseAction(context, 'VALUE', context.detailedPosition ?? context.position); if (action) return action; }
  if (context.toCall > 0 && adjustedStrength < Math.max(profile.foldThreshold, potOdds) && roll > bluffChance) return legal(context, 'fold') ? { kind: 'fold' } : fallback(context);
  if (roll < profile.aggression * 0.6 && (context.position === 'LATE' || spr <= 2.5)) { const action = raiseAction(context, strengthResult.drawPotential ? 'SEMI_BLUFF' : 'BLUFF', context.detailedPosition ?? context.position); if (action) return action; }
  if (legal(context, 'call') && (adjustedStrength + character.callBias >= Math.max(profile.callThreshold - 0.1, potOdds) || strengthResult.drawPotential >= potOdds * 0.9)) return { kind: 'call' }; return fallback(context);
}
