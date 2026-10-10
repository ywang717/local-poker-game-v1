import type { Card } from '../game/cards';
import type { DetailedPosition } from '../ai/positionStrategy';
import type { ActionRecord } from '../game/gameState';
import type { GameMode } from '../game/rules';
import type { HandResult, HandSummary } from './handHistory';
import type { MatchType } from '../match/matchTypes';

export type PositionGroup = 'EARLY' | 'MIDDLE' | 'LATE' | 'SB' | 'BB' | 'HEADS_UP';
export type StackBucket = 'UP_TO_20' | 'FROM_20_TO_40' | 'FROM_40_TO_100' | 'OVER_100';

export type HandStatsFact = {
  factKey: string;
  careerId: string;
  handId: string;
  playerId: string;
  matchType: MatchType;
  mode: GameMode;
  tableLevel: number;
  tableSize: number;
  seat: number;
  dealerSeat: number;
  position: DetailedPosition | null;
  positionGroup: PositionGroup | null;
  timestamp: string;
  startingHand: string;
  bigBlind: number;
  initialStack: number | null;
  effectiveStackBB: number | null;
  result: HandResult | 'PARTIAL_WIN';
  hands: 1;
  wins: 0 | 1;
  splits: 0 | 1;
  partialWins: 0 | 1;
  losses: 0 | 1;
  playerNet: number;
  playerNetBB: number;
  finalPot: number;
  vpip: 0 | 1;
  pfr: 0 | 1;
  pfrKnown?: boolean;
  vpipKnown?: boolean;
  foldPreflopKnown?: boolean;
  threeBetKnown?: boolean;
  fourBetKnown?: boolean;
  streetKnown?: boolean;
  foldPreflop: 0 | 1;
  threeBetOpportunity: 0 | 1;
  threeBet: 0 | 1;
  fourBetOpportunity: 0 | 1;
  fourBet: 0 | 1;
  allIn: 0 | 1;
  allInCall: 0 | 1;
  sawFlop: 0 | 1;
  sawTurn: 0 | 1;
  sawRiver: 0 | 1;
  showdown: 0 | 1;
  showdownWon: 0 | 1;
  wonWithoutShowdown: 0 | 1;
  showdownNetBB: number;
  wonWithoutShowdownNetBB: number;
};

export type HandStatsAggregate = {
  startingHand: string;
  hands: number;
  wins: number;
  splits: number;
  partialWins: number;
  losses: number;
  vpipHands: number;
  vpipOpportunities: number;
  pfrHands: number;
  pfrOpportunities: number;
  foldPreflopHands: number;
  foldPreflopOpportunities: number;
  threeBetHands: number;
  threeBetOpportunities: number;
  fourBetHands: number;
  fourBetOpportunities: number;
  allInHands: number;
  allInCallHands: number;
  sawFlopHands: number;
  sawTurnHands: number;
  sawRiverHands: number;
  streetOpportunities: number;
  showdownHands: number;
  showdownWonHands: number;
  wonWithoutShowdownHands: number;
  totalProfit: number;
  totalProfitBB: number;
  profitableHands: number;
  maxProfitBB: number;
  minProfitBB: number;
  showdownProfitBB: number;
  wonWithoutShowdownProfitBB: number;
};

const STANDARD_RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const SHORT_RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6] as const;
const rankLabel = (rank: number): string => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' }[rank] ?? String(rank));

export function startingHandNotation(cards: readonly Card[], mode: GameMode): string | null {
  if (cards.length !== 2) return null;
  const allowed = new Set(mode === 'SHORT_DECK' ? SHORT_RANKS : STANDARD_RANKS);
  if (cards.some((card) => !allowed.has(card.rank as (typeof STANDARD_RANKS)[number]))) return null;
  const high = Math.max(cards[0].rank, cards[1].rank);
  const low = Math.min(cards[0].rank, cards[1].rank);
  if (high === low) return `${rankLabel(high)}${rankLabel(low)}`;
  return `${rankLabel(high)}${rankLabel(low)}${cards[0].suit === cards[1].suit ? 's' : 'o'}`;
}

export function startingHandClasses(mode: GameMode): string[] {
  const ranks = mode === 'SHORT_DECK' ? SHORT_RANKS : STANDARD_RANKS;
  const rankValues = [...ranks] as number[];
  const result: string[] = [];
  for (const high of ranks) {
    for (const low of ranks) {
      if (high === low) result.push(`${rankLabel(high)}${rankLabel(low)}`);
      else if (rankValues.indexOf(high) < rankValues.indexOf(low)) result.push(`${rankLabel(high)}${rankLabel(low)}s`);
      else result.push(`${rankLabel(low)}${rankLabel(high)}o`);
    }
  }
  return result;
}

export function positionGroupFor(position: DetailedPosition | null): PositionGroup | null {
  if (!position) return null;
  if (position === 'SB' || position === 'BB' || position === 'HEADS_UP') return position;
  if (position === 'UTG' || position === 'UTG1') return 'EARLY';
  if (position === 'MP' || position === 'HJ') return 'MIDDLE';
  return 'LATE';
}

export function stackBucketFor(effectiveStackBB: number | null): StackBucket | null {
  if (effectiveStackBB === null || !Number.isFinite(effectiveStackBB)) return null;
  if (effectiveStackBB <= 20) return 'UP_TO_20';
  if (effectiveStackBB <= 40) return 'FROM_20_TO_40';
  if (effectiveStackBB <= 100) return 'FROM_40_TO_100';
  return 'OVER_100';
}

function blankAggregate(startingHand: string): HandStatsAggregate {
  return { startingHand, hands: 0, wins: 0, splits: 0, partialWins: 0, losses: 0, vpipHands: 0, vpipOpportunities: 0, pfrHands: 0, pfrOpportunities: 0, foldPreflopHands: 0, foldPreflopOpportunities: 0, threeBetHands: 0, threeBetOpportunities: 0, fourBetHands: 0, fourBetOpportunities: 0, allInHands: 0, allInCallHands: 0, sawFlopHands: 0, sawTurnHands: 0, sawRiverHands: 0, streetOpportunities: 0, showdownHands: 0, showdownWonHands: 0, wonWithoutShowdownHands: 0, totalProfit: 0, totalProfitBB: 0, profitableHands: 0, maxProfitBB: Number.NEGATIVE_INFINITY, minProfitBB: Number.POSITIVE_INFINITY, showdownProfitBB: 0, wonWithoutShowdownProfitBB: 0 };
}

export function aggregateHandStats(facts: readonly HandStatsFact[], classes?: readonly string[]): HandStatsAggregate[] {
  const map = new Map<string, HandStatsAggregate>();
  for (const startingHand of classes ?? []) map.set(startingHand, blankAggregate(startingHand));
  for (const fact of facts) {
    const current = map.get(fact.startingHand) ?? blankAggregate(fact.startingHand);
    current.hands += fact.hands;
    current.wins += fact.wins;
    current.splits += fact.splits;
    current.partialWins += fact.partialWins;
    current.losses += fact.losses;
    current.vpipHands += fact.vpip;
    current.vpipOpportunities += fact.vpipKnown === false ? 0 : fact.hands;
    current.pfrHands += fact.pfr;
    current.pfrOpportunities += fact.pfrKnown === false ? 0 : fact.hands;
    current.foldPreflopHands += fact.foldPreflop;
    current.foldPreflopOpportunities += fact.foldPreflopKnown === false ? 0 : fact.hands;
    current.threeBetHands += fact.threeBet;
    current.threeBetOpportunities += fact.threeBetKnown === false ? 0 : fact.threeBetOpportunity;
    current.fourBetHands += fact.fourBet;
    current.fourBetOpportunities += fact.fourBetKnown === false ? 0 : fact.fourBetOpportunity;
    current.allInHands += fact.allIn;
    current.allInCallHands += fact.allInCall;
    if (fact.streetKnown !== false) {
      current.streetOpportunities += fact.hands;
      current.sawFlopHands += fact.sawFlop;
      current.sawTurnHands += fact.sawTurn;
      current.sawRiverHands += fact.sawRiver;
    }
    current.showdownHands += fact.showdown;
    current.showdownWonHands += fact.showdownWon;
    current.wonWithoutShowdownHands += fact.wonWithoutShowdown;
    current.totalProfit += fact.playerNet;
    current.totalProfitBB += fact.playerNetBB;
    current.profitableHands += fact.playerNet > 0 ? 1 : 0;
    current.maxProfitBB = Math.max(current.maxProfitBB, fact.playerNetBB);
    current.minProfitBB = Math.min(current.minProfitBB, fact.playerNetBB);
    current.showdownProfitBB += fact.showdownNetBB;
    current.wonWithoutShowdownProfitBB += fact.wonWithoutShowdownNetBB;
    map.set(fact.startingHand, current);
  }
  return [...map.values()].map((row) => ({ ...row, maxProfitBB: row.hands ? row.maxProfitBB : 0, minProfitBB: row.hands ? row.minProfitBB : 0 }));
}

function previousFullRaises(records: readonly ActionRecord[], index: number): number {
  return records.slice(0, index).filter((record) => record.street === 'PRE_FLOP' && !record.isBlind && record.isAggressiveRaise && record.isFullRaise).length;
}

function handResult(summary: HandSummary): { result: HandStatsFact['result']; wins: 0 | 1; splits: 0 | 1; partialWins: 0 | 1; losses: 0 | 1 } {
  const playerId = summary.playerId ?? 'human';
  const pots = summary.potResults ?? [];
  // Pre-V2.4 histories did not persist eligible-player IDs.  Their legacy
  // result is the only trustworthy classification; do not infer a loss from
  // missing side-pot metadata during migration.
  const hasEligibilityMetadata = pots.length > 0 && pots.every((pot) => Array.isArray(pot.eligiblePlayerIds));
  if (!pots.length || !hasEligibilityMetadata) {
    if (summary.result === 'WIN') return { result: 'WIN', wins: 1, splits: 0, partialWins: 0, losses: 0 };
    if (summary.result === 'SPLIT') return { result: 'SPLIT', wins: 0, splits: 1, partialWins: 0, losses: 0 };
    if (summary.result === 'PARTIAL_WIN') return { result: 'PARTIAL_WIN', wins: 0, splits: 0, partialWins: 1, losses: 0 };
    return { result: summary.result === 'FOLD' ? 'FOLD' : 'LOSS', wins: 0, splits: 0, partialWins: 0, losses: 1 };
  }
  const winningPots = pots.filter((pot) => pot.winnerPlayerIds.includes(playerId));
  const award = winningPots.reduce((sum, pot) => sum + pot.awards.filter((entry) => entry.playerId === playerId).reduce((inner, entry) => inner + entry.amount, 0), 0);
  const hasSplit = winningPots.some((pot) => pot.winnerPlayerIds.length > 1);
  const eligiblePots = pots.filter((pot) => pot.eligiblePlayerIds?.includes(playerId));
  const hasCompetingPot = eligiblePots.length > 0;
  const winsAll = hasCompetingPot && eligiblePots.every((pot) => pot.winnerPlayerIds.length === 1 && pot.winnerPlayerIds[0] === playerId);
  if (hasSplit) return { result: 'SPLIT', wins: 0, splits: 1, partialWins: 0, losses: 0 };
  if (award > 0 && winsAll) return { result: 'WIN', wins: 1, splits: 0, partialWins: 0, losses: 0 };
  if (award > 0) return { result: 'PARTIAL_WIN', wins: 0, splits: 0, partialWins: 1, losses: 0 };
  return { result: summary.result === 'FOLD' ? 'FOLD' : 'LOSS', wins: 0, splits: 0, partialWins: 0, losses: 1 };
}

export function createHandStatsFact(summary: HandSummary, careerId: string): HandStatsFact | null {
  const startingHand = startingHandNotation(summary.playerHoleCards, summary.mode);
  if (!startingHand || !summary.handId) return null;
  const records = summary.actionHistory ?? [];
  const preflop = records.filter((record) => record.street === 'PRE_FLOP');
  const playerId = summary.playerId ?? 'human';
  const playerActions = preflop.filter((record) => record.playerId === playerId && !record.isBlind);
  const fullRaiseActions = playerActions.filter((record) => record.isAggressiveRaise && record.isFullRaise);
  const pfrActions = playerActions.filter((record) => record.isAggressiveRaise);
  const threeBetOpportunity = playerActions.some((record, index) => previousFullRaises(preflop, preflop.indexOf(record)) === 1) ? 1 : 0;
  const fourBetOpportunity = playerActions.some((record) => previousFullRaises(preflop, preflop.indexOf(record)) >= 2) ? 1 : 0;
  const threeBet = fullRaiseActions.some((record) => previousFullRaises(preflop, preflop.indexOf(record)) === 1) ? 1 : 0;
  const fourBet = fullRaiseActions.some((record) => previousFullRaises(preflop, preflop.indexOf(record)) >= 2) ? 1 : 0;
  const result = handResult(summary);
  const trueShowdown = Boolean(summary.trueShowdown);
  const playerNetBB = summary.bigBlind > 0 ? summary.playerNet / summary.bigBlind : 0;
  const initialStack = summary.initialPlayerStack ?? null;
  const effectiveStackBB = summary.effectiveStackBB ?? null;
  return {
    factKey: `${careerId}:${summary.handId}:${playerId}`,
    careerId, handId: summary.handId, playerId,
    matchType: summary.matchType ?? 'CASH', mode: summary.mode, tableLevel: summary.tableLevel,
    tableSize: summary.tableSize, seat: summary.playerSeat ?? 0, dealerSeat: summary.dealerSeat,
    position: summary.playerPosition ?? null, positionGroup: positionGroupFor(summary.playerPosition ?? null),
    timestamp: summary.timestamp, startingHand, bigBlind: summary.bigBlind, initialStack, effectiveStackBB,
    hands: 1, ...result,
    playerNet: summary.playerNet, playerNetBB, finalPot: summary.finalPot,
    vpip: summary.vpip ? 1 : 0, pfr: pfrActions.length > 0 ? 1 : 0,
    vpipKnown: summary.vpip !== undefined || records.length > 0,
    pfrKnown: summary.pfr !== undefined || records.length > 0,
    foldPreflopKnown: summary.foldPreflop !== undefined || records.length > 0,
    threeBetKnown: summary.threeBetOpportunity !== undefined || records.length > 0,
    fourBetKnown: summary.fourBetOpportunity !== undefined || records.length > 0,
    streetKnown: summary.sawFlop !== undefined && summary.sawTurn !== undefined && summary.sawRiver !== undefined,
    foldPreflop: playerActions.some((record) => record.action === 'fold') ? 1 : 0,
    threeBetOpportunity, threeBet, fourBetOpportunity, fourBet,
    allIn: summary.allIn ? 1 : 0, allInCall: summary.allInCall ? 1 : 0,
    sawFlop: summary.sawFlop ? 1 : 0, sawTurn: summary.sawTurn ? 1 : 0, sawRiver: summary.sawRiver ? 1 : 0,
    showdown: trueShowdown ? 1 : 0, showdownWon: trueShowdown && result.wins + result.splits + result.partialWins > 0 ? 1 : 0,
    wonWithoutShowdown: summary.wonWithoutShowdown ? 1 : 0,
    showdownNetBB: trueShowdown ? playerNetBB : 0,
    wonWithoutShowdownNetBB: summary.wonWithoutShowdown ? playerNetBB : 0,
  };
}

export function mergeHandStatsFacts(facts: readonly HandStatsFact[], next: HandStatsFact): HandStatsFact[] {
  const index = facts.findIndex((fact) => fact.factKey === next.factKey);
  if (index < 0) return [...facts, next];
  const copy = [...facts]; copy[index] = next; return copy;
}
