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
import { decidePostflopV2WithIntent } from './postflopStrategyV2';

export type RandomSource = () => number;
export type PersonalityChoice = PersonalityId | AIPersonality;
export type TournamentDecisionContext = { stackBB?: number; effectiveStackBB?: number; blindLevel?: number; handsAtLevel?: number; playersRemaining?: number; pressure?: number; payoutPressure?: number };
export type DecisionOptions = { matchType?: MatchType; tournament?: TournamentDecisionContext; forcedPersonality?: PersonalityId };
function random(rng: RandomSource): number { const value = rng(); return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5; }
function legal(context: PublicTableContext, kind: LegalAction['kind']): LegalAction | undefined { return context.legalActions.find((action) => action.kind === kind); }
function fallback(context: PublicTableContext): PlayerAction { if (legal(context, 'check')) return { kind: 'check' }; if (legal(context, 'call')) return { kind: 'call' }; if (legal(context, 'fold')) return { kind: 'fold' }; return { kind: 'all-in' }; }
function averageOpponentFold(context: PublicTableContext): number {
  const rates = context.opponents
    .filter((opponent) => !opponent.folded)
    .map((opponent) => context.opponentModels[opponent.id])
    .filter((model): model is NonNullable<typeof model> => Boolean(model && model.facedBetCount > 0))
    .map(modelRates);
  return rates.length ? rates.reduce((sum, entry) => sum + entry.foldToBet, 0) / rates.length : 0.25;
}
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
function rangeWeight(context: PublicTableContext, difficulty: AIDifficulty, situation: PreflopSituation): number {
  const position = context.self.isButton ? 'BTN' : context.self.isBigBlind ? 'BB' : context.detailedPosition ?? (context.position === 'LATE' ? 'BTN' : context.position === 'EARLY' ? 'UTG' : 'MP');
  const range = weightedPreflopRange({ mode: context.mode, difficulty, position: position as never, situation });
  const hand = normalizeHandClass(context.self.holeCards, context.mode);
  return range.classes.find((entry) => entry.notation === hand.notation)?.weight ?? 0;
}
function raiseAction(context: PublicTableContext, intent: 'OPEN' | 'THREE_BET' | 'FOUR_BET' | 'VALUE' | 'SEMI_BLUFF' | 'BLUFF', position: string): PlayerAction | undefined {
  const action = legal(context, 'raise-to') ?? legal(context, 'bet-to'); if (!action || !('minAmount' in action)) return undefined;
  const target = chooseRaiseTarget({ intent, bigBlind: context.bigBlind, currentBet: context.currentBet, potAmount: context.potAmount, position, inPosition: context.self.inPosition });
  return { kind: action.kind, amount: clampRaiseTarget(target, action.minAmount, action.maxAmount) };
}
function preflopAction(context: PublicTableContext, difficulty: AIDifficulty, personality: AIPersonality, rng: RandomSource, options: DecisionOptions): PlayerAction | undefined {
  const classification = classifyPreflopSituation(context);
  const situation = classification.situation;
  const strength = handStrength(context);
  const hand = normalizeHandClass(context.self.holeCards, context.mode);
  const position = context.self.isButton ? 'BTN' : context.self.isBigBlind ? 'BB' : context.detailedPosition ?? context.position;
  const tournament = options.tournament;
  const effectiveStackBB = tournament?.effectiveStackBB ?? tournament?.stackBB ?? classification.effectiveStack / Math.max(1, context.bigBlind);
  const canRaise = Boolean(legal(context, 'raise-to') ?? legal(context, 'bet-to'));
  const canCall = Boolean(legal(context, 'call'));
  const canAllIn = Boolean(legal(context, 'all-in'));
  const range = rangeWeight(context, difficulty, situation);
  const opener = classification.openerId
    ? context.players.find((player) => player.id === classification.openerId)?.detailedPosition ?? 'UTG'
    : 'UTG';
  const openerEarly = opener === 'UTG' || opener === 'UTG1' || opener === 'MP';
  const openerLate = opener === 'CO' || opener === 'BTN';
  const openSizeBB = Math.max(1, classification.currentBet / Math.max(1, context.bigBlind));
  const openPressure = Math.max(-0.05, Math.min(0.12, (openSizeBB - 2.5) * 0.025));
  const pressure = Math.max(0, Math.min(0.2,
    (tournament?.pressure ?? tournament?.payoutPressure ?? 0)
    + (tournament?.playersRemaining !== undefined && tournament.playersRemaining <= 3 ? 0.08 : 0)
    + (tournament?.handsAtLevel !== undefined && tournament.handsAtLevel >= 8 ? 0.04 : 0)
    + (tournament?.blindLevel !== undefined ? Math.min(0.06, Math.max(0, tournament.blindLevel - 1) * 0.015) : 0),
  ));
  const premium = hand.notation === 'AA' || hand.notation === 'KK' || hand.notation === 'QQ' || hand.notation === 'AKs' || hand.notation === 'AKo';
  const highBroadway = ['AQs', 'AQo', 'AJs', 'KQs'].includes(hand.notation);
  const broadway = hand.high >= 11 && hand.low >= 10;
  const mediumPair = hand.category === 'PAIR' && hand.high >= 8 && hand.high <= 11;
  const smallPair = hand.category === 'PAIR' && hand.high < 8;
  const connected = hand.category === 'SUITED' && hand.high - hand.low <= 3;
  const suitedWheelA = hand.high === 14 && hand.low >= 4 && hand.low <= 5 && hand.category === 'SUITED';
  const trash = hand.category === 'OFFSUIT' && hand.high <= 9 && hand.low <= 7 && !connected;
  const randomValue = random(rng);
  const jam = (threshold: number, cap: number): PlayerAction | undefined => {
    const decision = decideJam({
      situation,
      effectiveStackBB,
      handStrength: strength,
      canRaise,
      canCall,
      canFold: Boolean(legal(context, 'fold')),
      jamType: classification.jamType,
      jammerPosition: classification.jamAggressorId ? context.players.find((player) => player.id === classification.jamAggressorId)?.detailedPosition : undefined,
      heroPosition: position,
      mode: context.mode,
      potOdds: calculatePotOdds(context.toCall, context.potAmount),
    });
    const openJamRequiresShortHero = (situation === 'UNOPENED' || situation === 'LIMPED') && context.self.stack / Math.max(1, context.bigBlind) > cap;
    if (decision === 'JAM' && !openJamRequiresShortHero && canAllIn && strength >= threshold && effectiveStackBB <= cap) return { kind: 'all-in' };
    return undefined;
  };
  if (situation === 'FACING_ALL_IN') {
    const decision = decideJam({
      situation,
      effectiveStackBB,
      handStrength: strength,
      potOdds: calculatePotOdds(context.toCall, context.potAmount),
      canRaise,
      canCall,
      canFold: Boolean(legal(context, 'fold')),
      jamType: classification.jamType,
      jammerPosition: classification.jamAggressorId ? context.players.find((player) => player.id === classification.jamAggressorId)?.detailedPosition : undefined,
      heroPosition: position,
      mode: context.mode,
    });
    if (decision === 'JAM' && canAllIn) return { kind: 'all-in' };
    if (decision === 'CALL' && canCall) return { kind: 'call' };
    return undefined;
  }
  if (situation === 'UNOPENED' || situation === 'LIMPED') {
    const openThreshold = 0.46 + (5 - difficulty) * 0.025 - personality.looseness * 0.2 + pressure;
    const occasionalOpen = situation === 'UNOPENED' && range >= 0.15 && randomValue < 0.02 * difficulty;
    if (range >= openThreshold || strength >= 0.58 - personality.looseness * 0.2 || (position === 'BTN' || position === 'CO') && strength >= 0.45 || occasionalOpen) {
      const allIn = jam(0.9, 18);
      if (allIn) return allIn;
      return canRaise ? raiseAction(context, 'OPEN', position) : canCall ? { kind: 'call' } : undefined;
    }
    if (situation === 'LIMPED' && canCall && range >= 0.2 && strength >= 0.35) return { kind: 'call' };
    return undefined;
  }
  if (situation === 'FACING_OPEN') {
    const squeeze = classification.isSqueeze;
    const baseValue3BetProbability = premium ? 0.98
      : highBroadway ? (openerEarly ? 0.58 : openerLate ? 0.7 : 0.64)
      : mediumPair ? (hand.high === 11 ? (openerEarly ? 0.62 : 0.68) : hand.high === 10 ? (openerEarly ? 0.44 : 0.5) : (openerEarly ? 0.3 : 0.38))
      : 0;
    const personalityThreeBetNudge = personality.id === 'LOOSE_AGGRESSIVE' ? 0.06 : personality.id === 'TIGHT' ? -0.04 : personality.id === 'CALLING' ? -0.08 : 0;
    const value3BetProbability = Math.max(0, Math.min(0.98, baseValue3BetProbability + personalityThreeBetNudge));
    const bluff3BetProbability = suitedWheelA && (position === 'BTN' || position === 'CO')
      ? Math.max(0, 0.035 + difficulty * 0.012 + personality.bluffFrequency + (openerLate ? 0.025 : 0))
      : 0;
    const squeezeProbability = squeeze && !premium
      ? Math.max(0, 0.06 + personality.aggression * 0.4 + (highBroadway || mediumPair ? 0.12 : 0))
      : 0;
    const shouldThreeBet = !trash && (randomValue < value3BetProbability + squeezeProbability || randomValue < bluff3BetProbability);
    if (shouldThreeBet && canRaise) {
      const allIn = jam(0.9, 20);
      if (allIn) return allIn;
      return raiseAction(context, 'THREE_BET', position);
    }
    // A value hand must still continue when a raise is unavailable (for
    // example, facing an all-in legal action only), rather than falling back
    // to a silent fold.
    if (premium && canAllIn && !canRaise) return { kind: 'all-in' };
    const headsUpDefense = context.tableSize === 2 && context.self.isBigBlind && opener === 'BTN';
    const callThreshold = 0.28 + openPressure + pressure * 0.5 + (openerEarly ? 0.05 : openerLate ? -0.03 : 0)
      - (headsUpDefense ? 0.1 : 0)
      + (classification.callerCount > 0 ? 0.02 * Math.min(2, classification.callerCount) : 0)
      - personality.callBias * 0.8;
    if (pressure >= 0.16 && !premium && !highBroadway) return undefined;
    const canFlat = canCall && !trash && (
      highBroadway || broadway || mediumPair || smallPair || connected || suitedWheelA
    ) && strength >= callThreshold || headsUpDefense && canCall && !trash
      && (hand.category === 'SUITED' || hand.category === 'PAIR' || hand.high >= 10)
      && strength >= callThreshold;
    if (canFlat) return { kind: 'call' };
    return undefined;
  }
  if (situation === 'FACING_3BET') {
    const value4Bet = premium && randomValue < 0.94;
    const bluff4Bet = suitedWheelA && difficulty >= 4 && randomValue < Math.max(0.02, 0.03 + personality.bluffFrequency * 0.5);
    if ((value4Bet || bluff4Bet) && canRaise) {
      const allIn = jam(0.94, 30);
      if (allIn) return allIn;
      return raiseAction(context, 'FOUR_BET', position);
    }
    if ((value4Bet || premium) && canAllIn && !canRaise) return { kind: 'all-in' };
    const callThreshold = 0.56 + pressure + (personality.id === 'CALLING' ? -0.04 : personality.id === 'TIGHT' ? 0.04 : 0);
    if (canCall && (premium || highBroadway || (mediumPair && strength >= callThreshold) || (suitedWheelA && strength >= callThreshold))) return { kind: 'call' };
    return undefined;
  }
  if (situation === 'FACING_4BET_PLUS') {
    if (premium && strength >= 0.82) {
      const allIn = jam(0.95, 35);
      if (allIn) return allIn;
      if (canRaise) return raiseAction(context, 'FOUR_BET', position);
      if (canCall) return { kind: 'call' };
    }
    if (canCall && hand.notation === 'AA') return { kind: 'call' };
  }
  return undefined;
}
function postflopAction(context: PublicTableContext, difficulty: AIDifficulty, simulationBudget: number, personality: AIPersonality): PlayerAction | undefined {
  const lastAggressor = [...context.actionHistory].reverse().find((entry) => entry.street === context.street && (entry.isAggressiveRaise ?? (isAggressive(entry.action) && !entry.isAllInCall)));
  const aggressor = lastAggressor ? context.opponents.find((opponent) => opponent.id === lastAggressor.playerId) : undefined;
  const effectiveStackBeforeAction = aggressor
    ? Math.min(context.self.stack, aggressor.stack + aggressor.streetContribution)
    : context.self.stack;
  const effectiveStackBehindAfterCall = aggressor
    ? Math.min(Math.max(0, context.self.stack - context.toCall), aggressor.stack)
    : context.self.stack;
  const riverAggressiveActionCount = context.street === 'RIVER'
    ? context.actionHistory.filter((entry) => entry.street === 'RIVER' && (entry.isAggressiveRaise ?? (isAggressive(entry.action) && !entry.isAllInCall))).length
    : undefined;
  const decision = decidePostflopV2WithIntent({
    holeCards: context.self.holeCards, board: context.communityCards, mode: context.mode,
    potAmount: context.potAmount, toCall: context.toCall, effectiveStack: effectiveStackBeforeAction,
    effectiveStackBeforeAction, effectiveStackBehindAfterCall, bigBlind: context.bigBlind, difficulty,
    simulationBudget, personality, opponentFoldRate: averageOpponentFold(context),
    riverAggressiveActionCount, riverAggressorPosition: aggressor?.detailedPosition, selfStack: context.self.stack,
    priorAggressor: lastAggressor?.playerId === context.aiPlayerId ? 'SELF' : 'OPPONENT',
    opponentCount: context.opponents.filter((opponent) => !opponent.folded).length,
    legalActions: context.legalActions.map((entry) => entry.kind),
  });
  if (decision.action === 'CHECK' && legal(context, 'check')) return { kind: 'check' }; if (decision.action === 'CALL' && legal(context, 'call')) return { kind: 'call' }; if (decision.action === 'FOLD' && legal(context, 'fold')) return { kind: 'fold' }; if (decision.action === 'ALL_IN' && legal(context, 'all-in')) return { kind: 'all-in' }; if (decision.action === 'BET' || decision.action === 'RAISE') return raiseAction(context, decision.intent === 'NONE' ? 'VALUE' : decision.intent, context.detailedPosition ?? context.position); return undefined;
}
export function chooseAction(context: PublicTableContext, difficulty: AIDifficulty, personality: PersonalityChoice, rng: RandomSource, options: DecisionOptions = {}): PlayerAction {
  if (context.actingSeat !== context.aiSeat) return fallback(context); const profile = getDifficultyProfile(difficulty); const character = getPersonality(options.forcedPersonality ?? personality);
  const decisionOptions = options.matchType === 'MINI_TOURNAMENT' && !options.tournament ? { ...options, tournament: { pressure: 0.04 } } : options;
  if (context.street === 'PRE_FLOP') { const action = preflopAction(context, difficulty, character, rng, decisionOptions); if (action) return action; if (context.toCall <= 0 && legal(context, 'check')) return { kind: 'check' }; if (legal(context, 'fold')) return { kind: 'fold' }; return fallback(context); }
  const postflop = postflopAction(context, difficulty, profile.postflopSimulationBudget, character); if (postflop) return postflop;
  const strengthResult = postflopStrength(context.self.holeCards, context.communityCards, context.mode); const modelAdjustment = profile.modelWeight * (averageOpponentFold(context) - 0.25); const positionAdjustment = context.position === 'LATE' || context.position === 'HEADS_UP' ? profile.positionWeight : context.position === 'EARLY' ? -profile.positionWeight : 0; const adjustedStrength = Math.max(0, Math.min(1, strengthResult.strength + strengthResult.drawPotential * profile.quality + modelAdjustment + positionAdjustment + character.looseness * 0.2)); const potOdds = calculatePotOdds(context.toCall, context.potAmount); const spr = calculateSpr(context.self.stack, context.potAmount); const roll = random(rng); const bluffChance = Math.max(0, profile.bluffFrequency + character.bluffFrequency);
  if (adjustedStrength >= profile.valueThreshold && roll < profile.aggression + character.aggression) { const action = raiseAction(context, 'VALUE', context.detailedPosition ?? context.position); if (action) return action; }
  if (context.toCall > 0 && adjustedStrength < Math.max(profile.foldThreshold, potOdds) && roll > bluffChance) return legal(context, 'fold') ? { kind: 'fold' } : fallback(context);
  if (roll < profile.aggression * 0.6 && (context.position === 'LATE' || spr <= 2.5)) { const action = raiseAction(context, strengthResult.drawPotential ? 'SEMI_BLUFF' : 'BLUFF', context.detailedPosition ?? context.position); if (action) return action; }
  if (legal(context, 'call') && (adjustedStrength + character.callBias >= Math.max(profile.callThreshold - 0.1, potOdds) || strengthResult.drawPotential >= potOdds * 0.9)) return { kind: 'call' }; return fallback(context);
}
