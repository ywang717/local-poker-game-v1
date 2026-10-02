import type { Card, Rank } from '../game/cards';
import { getRuleConfig, type GameMode } from '../game/rules';
import type { AIDifficulty } from './difficulty';
import type { PublicTableContext } from './publicContext';
import type { DetailedPosition } from './positionStrategy';

export type PreflopSituation = 'UNOPENED' | 'LIMPED' | 'FACING_OPEN' | 'FACING_3BET' | 'FACING_4BET_PLUS' | 'FACING_ALL_IN';
export type JamType = 'OPEN_JAM' | '3BET_JAM' | '4BET_JAM' | 'POSTFLOP_JAM';

export type PreflopClassification = {
  situation: PreflopSituation;
  openerId?: string;
  lastAggressorId?: string;
  raiseCount: number;
  callerCount: number;
  effectiveStack: number;
  currentBet: number;
  currentAggressorId?: string;
  jamAggressorId?: string;
  jamType?: JamType;
  jamIncrement?: number;
  jamIsFullRaise?: boolean;
  jamIsCall?: boolean;
  isSqueeze: boolean;
};

export type HandClassCategory = 'PAIR' | 'SUITED' | 'OFFSUIT';
export type HandClass = {
  notation: string;
  high: Rank;
  low: Rank;
  category: HandClassCategory;
};

export type WeightedHandClass = HandClass & { weight: number };
export type WeightedRange = {
  mode: GameMode;
  difficulty: AIDifficulty;
  position: DetailedPosition;
  situation: PreflopSituation;
  classes: WeightedHandClass[];
};

const positions: readonly DetailedPosition[] = ['UTG', 'UTG1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'HEADS_UP'];
const positionOrder: Readonly<Record<DetailedPosition, number>> = { UTG: 0, UTG1: 1, MP: 2, HJ: 3, CO: 4, BTN: 5, SB: 3, BB: 1, HEADS_UP: 5 };

function rankLabel(rank: Rank): string {
  return rank === 14 ? 'A' : rank === 13 ? 'K' : rank === 12 ? 'Q' : rank === 11 ? 'J' : rank === 10 ? 'T' : String(rank);
}

function classFor(high: Rank, low: Rank, category: HandClassCategory): HandClass {
  return { high, low, category, notation: high === low ? `${rankLabel(high)}${rankLabel(low)}` : `${rankLabel(high)}${rankLabel(low)}${category === 'SUITED' ? 's' : 'o'}` };
}

/** Normalize two visible hole cards to a 169/81 class label. */
export function normalizeHandClass(cards: readonly Card[], mode: GameMode = 'STANDARD'): HandClass {
  if (cards.length !== 2) throw new RangeError('A hand class requires two hole cards');
  const [first, second] = cards;
  const high = Math.max(first.rank, second.rank) as Rank;
  const low = Math.min(first.rank, second.rank) as Rank;
  if (!getRuleConfig(mode).ranks.includes(high) || !getRuleConfig(mode).ranks.includes(low)) throw new RangeError('Hole cards are outside the selected deck');
  if (high === low) return classFor(high, low, 'PAIR');
  return classFor(high, low, first.suit === second.suit ? 'SUITED' : 'OFFSUIT');
}

function isFullRaise(action: PublicTableContext['actionHistory'][number], currentBet: number, lastFullRaise: number): boolean {
  if (action.isFullRaise !== undefined) return action.isFullRaise;
  if (action.isBlind) return false;
  if (action.action !== 'bet-to' && action.action !== 'raise-to' && action.action !== 'all-in') return false;
  const target = action.totalTo > 0 ? action.totalTo : currentBet + action.amount;
  return target > currentBet && (currentBet === 0 || target - currentBet >= lastFullRaise);
}

/** Classify only pre-flop action history; blind posts and short all-ins do not reopen betting. */
export function classifyPreflopSituation(context: Pick<PublicTableContext, 'actionHistory' | 'players' | 'self' | 'bigBlind' | 'currentBet' | 'aiPlayerId'>): PreflopClassification {
  let currentBet = context.bigBlind;
  let lastFullRaise = context.bigBlind;
  let raiseCount = 0;
  let callerCount = 0;
  let openerId: string | undefined;
  let lastAggressorId: string | undefined;
  let jamAggressorId: string | undefined;
  let jamType: JamType | undefined;
  let jamIncrement: number | undefined;
  let jamIsFullRaise: boolean | undefined;
  let jamIsCall: boolean | undefined;

  for (const action of context.actionHistory.filter((entry) => entry.street === 'PRE_FLOP')) {
    if (action.isBlind) continue;
    if (action.action === 'call') callerCount += 1;
    const target = action.totalTo > 0 ? action.totalTo : currentBet + action.amount;
    const full = isFullRaise(action, currentBet, lastFullRaise);
    const increase = action.increase ?? Math.max(0, target - currentBet);
    const allInCall = action.action === 'all-in' && (action.isAllInCall ?? target <= currentBet);
    const allInRaise = action.action === 'all-in' && !allInCall && target > currentBet;
    // An all-in is only the current price if no later full raise replaced it.
    // Keep its id separately from the last full aggressor so a short all-in
    // does not accidentally reopen raising rights or rewrite the open count.
    if (allInRaise && action.playerId !== context.aiPlayerId) {
      jamAggressorId = action.playerId;
      jamType = raiseCount === 0 ? 'OPEN_JAM' : raiseCount === 1 ? '3BET_JAM' : '4BET_JAM';
      jamIncrement = increase;
      jamIsFullRaise = full;
      jamIsCall = false;
    }
    if (allInCall && action.playerId !== context.aiPlayerId && !jamAggressorId) {
      jamIncrement = 0;
      jamIsFullRaise = false;
      jamIsCall = true;
    }
    if (full) {
      raiseCount += 1;
      if (!openerId) openerId = action.playerId;
      lastAggressorId = action.playerId;
      lastFullRaise = Math.max(1, target - currentBet);
      // A later full raise replaces any earlier all-in as the current price.
      jamAggressorId = undefined;
      jamType = undefined;
      jamIncrement = undefined;
      jamIsFullRaise = undefined;
      jamIsCall = undefined;
      if (allInRaise && action.playerId !== context.aiPlayerId) {
        jamAggressorId = action.playerId;
        jamType = raiseCount === 1 ? 'OPEN_JAM' : raiseCount === 2 ? '3BET_JAM' : '4BET_JAM';
        jamIncrement = increase;
        jamIsFullRaise = full;
        jamIsCall = false;
      }
    }
    currentBet = Math.max(currentBet, target);
  }

  const ownStack = context.self.stack + context.self.handContribution;
  const currentAggressorId = jamAggressorId ?? lastAggressorId;
  const relevantAggressor = currentAggressorId ? context.players.find((player) => player.id === currentAggressorId) : undefined;
  const relevantAggressorAction = currentAggressorId
    ? [...context.actionHistory].reverse().find((action) => action.street === 'PRE_FLOP' && action.playerId === currentAggressorId && (action.isAggressiveRaise ?? (action.action === 'raise-to' || action.action === 'bet-to' || action.action === 'all-in')))
    : undefined;
  const fallbackStacks = context.players.filter((player) => !player.folded && player.id !== context.aiPlayerId).map((player) => player.stack).filter(Number.isFinite);
  const ownStackBeforeAction = context.self.stack + context.self.handContribution;
  const aggressorStackBeforeAction = relevantAggressorAction?.stackBeforeAction
    ?? (relevantAggressor ? relevantAggressor.stack + relevantAggressor.handContribution : undefined);
  const effectiveStack = relevantAggressor
    ? Math.min(ownStackBeforeAction, aggressorStackBeforeAction ?? relevantAggressor.stack)
    : Math.min(ownStackBeforeAction, ...fallbackStacks);
  const facingAllIn = Boolean(jamAggressorId);
  const situation = facingAllIn
    ? 'FACING_ALL_IN'
    : raiseCount === 0 ? (callerCount > 0 ? 'LIMPED' : 'UNOPENED')
      : raiseCount === 1 ? 'FACING_OPEN'
        : raiseCount === 2 ? 'FACING_3BET' : 'FACING_4BET_PLUS';
  return {
    situation, openerId, lastAggressorId, currentAggressorId, jamAggressorId, jamType,
    raiseCount, callerCount, currentBet, jamIncrement, jamIsFullRaise, jamIsCall, isSqueeze: raiseCount === 1 && callerCount > 0,
    effectiveStack: Number.isFinite(effectiveStack) ? effectiveStack : ownStack,
  };
}

function classesFor(mode: GameMode): HandClass[] {
  const ranks = getRuleConfig(mode).ranks;
  const classes: HandClass[] = [];
  for (let highIndex = ranks.length - 1; highIndex >= 0; highIndex -= 1) {
    const high = ranks[highIndex];
    classes.push(classFor(high, high, 'PAIR'));
    for (let lowIndex = highIndex - 1; lowIndex >= 0; lowIndex -= 1) {
      const low = ranks[lowIndex];
      classes.push(classFor(high, low, 'SUITED'));
      classes.push(classFor(high, low, 'OFFSUIT'));
    }
  }
  return classes;
}

/** Build a deterministic 169/81 weighted class table without external range data. */
export function weightedPreflopRange({ mode, difficulty, position, situation }: { mode: GameMode; difficulty: AIDifficulty; position: DetailedPosition; situation: PreflopSituation }): WeightedRange {
  const positionFactor = positionOrder[position];
  const situationFactor = situation === 'UNOPENED' ? 1 : situation === 'LIMPED' ? 0.9 : situation === 'FACING_OPEN' ? 0.68 : situation === 'FACING_3BET' ? 0.42 : situation === 'FACING_4BET_PLUS' ? 0.22 : 0.3;
  const width = Math.max(0.08, Math.min(0.96, 0.24 + difficulty * 0.095 + positionFactor * 0.045)) * situationFactor;
  const classes = classesFor(mode).map((hand) => {
    const pair = hand.category === 'PAIR';
    const suited = hand.category === 'SUITED';
    const raw = pair ? 0.58 + (hand.high - 9) * 0.06 : 0.16 + (hand.high - 10) * 0.045 + (hand.low - 8) * 0.018 + (suited ? 0.06 : 0);
    return { ...hand, weight: Math.max(0, Math.min(1, (raw + width - 0.5) * 1.35)) };
  });
  return { mode, difficulty, position, situation, classes };
}

export const getWeightedPreflopRange = weightedPreflopRange;
export const getPreflopRange = weightedPreflopRange;
export const buildWeightedRange = weightedPreflopRange;
export const handClassFromCards = normalizeHandClass;
