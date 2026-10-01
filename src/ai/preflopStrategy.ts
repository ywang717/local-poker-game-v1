import type { Card, Rank } from '../game/cards';
import { getRuleConfig, type GameMode } from '../game/rules';
import type { AIDifficulty } from './difficulty';
import type { PublicTableContext } from './publicContext';
import type { DetailedPosition } from './positionStrategy';

export type PreflopSituation = 'UNOPENED' | 'LIMPED' | 'FACING_OPEN' | 'FACING_3BET' | 'FACING_4BET_PLUS' | 'FACING_ALL_IN';

export type PreflopClassification = {
  situation: PreflopSituation;
  openerId?: string;
  lastAggressorId?: string;
  raiseCount: number;
  callerCount: number;
  effectiveStack: number;
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
  return rank === 14 ? 'A' : rank === 13 ? 'K' : rank === 12 ? 'Q' : rank === 11 ? 'J' : String(rank);
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
  let facingAllIn = false;

  for (const action of context.actionHistory.filter((entry) => entry.street === 'PRE_FLOP')) {
    if (action.isBlind) continue;
    if (action.action === 'call') callerCount += 1;
    const target = action.totalTo > 0 ? action.totalTo : currentBet + action.amount;
    const full = isFullRaise(action, currentBet, lastFullRaise);
    if (action.action === 'all-in' && action.playerId !== context.aiPlayerId) facingAllIn = true;
    if (full) {
      raiseCount += 1;
      if (!openerId) openerId = action.playerId;
      lastAggressorId = action.playerId;
      lastFullRaise = Math.max(1, target - currentBet);
    }
    currentBet = Math.max(currentBet, target);
  }

  const liveStacks = context.players
    .filter((player) => !player.folded && player.id !== context.aiPlayerId)
    .map((player) => player.stack + player.handContribution);
  const ownStack = context.self.stack + context.self.handContribution;
  const effectiveStack = Math.min(ownStack, ...liveStacks.filter((stack) => Number.isFinite(stack)));
  const situation = facingAllIn
    ? 'FACING_ALL_IN'
    : raiseCount === 0 ? (callerCount > 0 ? 'LIMPED' : 'UNOPENED')
      : raiseCount === 1 ? 'FACING_OPEN'
        : raiseCount === 2 ? 'FACING_3BET' : 'FACING_4BET_PLUS';
  return { situation, openerId, lastAggressorId, raiseCount, callerCount, effectiveStack: Number.isFinite(effectiveStack) ? effectiveStack : ownStack };
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
