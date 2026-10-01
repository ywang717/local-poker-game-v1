import type { ActionRecord } from '../game/gameState';
import type { HandSummary } from '../career/handHistory';

export type ObservedActionRecord = ActionRecord & {
  handId?: string;
  facingBet?: boolean;
  isThreeBet?: boolean;
  potAmount?: number;
  facingOpen?: boolean;
  facingThreeBet?: boolean;
  isFourBet?: boolean;
  foldToThreeBet?: boolean;
  raiseSize?: number;
  voluntary?: boolean;
  isPfr?: boolean;
};

export type PlayerModel = {
  handsObserved: number;
  vpipHands: number;
  pfrHands: number;
  threeBetCount: number;
  threeBetOpportunities: number;
  fourBetCount: number;
  fourBetOpportunities: number;
  foldToThreeBetCount: number;
  foldToThreeBetOpportunities: number;
  raiseSizingSamples: number;
  raiseSizingSum: number;
  facedBetCount: number;
  foldToBetCount: number;
  totalActions: number;
  averageBetFraction: number;
  recentActions: ObservedActionRecord[];
  seenHands: string[];
  vpipSeenHands: string[];
  pfrSeenHands: string[];
};

export function createPlayerModel(): PlayerModel {
  return {
    handsObserved: 0,
    vpipHands: 0,
    pfrHands: 0,
    threeBetCount: 0,
    threeBetOpportunities: 0,
    fourBetCount: 0,
    fourBetOpportunities: 0,
    foldToThreeBetCount: 0,
    foldToThreeBetOpportunities: 0,
    raiseSizingSamples: 0,
    raiseSizingSum: 0,
    facedBetCount: 0,
    foldToBetCount: 0,
    totalActions: 0,
    averageBetFraction: 0,
    recentActions: [],
    seenHands: [],
    vpipSeenHands: [],
    pfrSeenHands: [],
  };
}

export function recordObservedAction(model: PlayerModel, record: ObservedActionRecord): PlayerModel {
  const next: PlayerModel = {
    ...model,
    recentActions: [...model.recentActions, { ...record }].slice(-50),
    seenHands: [...model.seenHands],
    vpipSeenHands: [...model.vpipSeenHands],
    pfrSeenHands: [...model.pfrSeenHands],
  };
  if (record.handId && !next.seenHands.includes(record.handId)) {
    next.seenHands.push(record.handId);
    next.handsObserved += 1;
  }
  next.totalActions += 1;
  const voluntary = record.voluntary ?? (record.action === 'call' || record.action === 'bet-to' || record.action === 'raise-to' || record.action === 'all-in');
  if (voluntary && record.handId && !next.vpipSeenHands.includes(record.handId)) {
    next.vpipSeenHands.push(record.handId);
    next.vpipHands += 1;
  }
  const raised = record.action === 'bet-to' || record.action === 'raise-to' || record.action === 'all-in';
  if ((record.isPfr ?? raised) && record.street === 'PRE_FLOP' && record.handId && !next.pfrSeenHands.includes(record.handId)) {
    next.pfrSeenHands.push(record.handId);
    next.pfrHands += 1;
  }
  if (record.facingBet) {
    next.facedBetCount += 1;
    if (record.action === 'fold') next.foldToBetCount += 1;
  }
  if (record.isThreeBet) next.threeBetCount += 1;
  if (record.facingOpen && record.street === 'PRE_FLOP') next.threeBetOpportunities += 1;
  if (record.facingThreeBet && record.street === 'PRE_FLOP') next.fourBetOpportunities += 1;
  if (record.isFourBet) next.fourBetCount += 1;
  if (record.facingThreeBet && record.street === 'PRE_FLOP') {
    next.foldToThreeBetOpportunities += 1;
    if (record.foldToThreeBet || record.action === 'fold') next.foldToThreeBetCount += 1;
  }
  if ((record.raiseSize ?? 0) > 0) {
    next.raiseSizingSamples += 1;
    next.raiseSizingSum += record.raiseSize!;
  } else if (raised && record.potAmount && record.potAmount > 0) {
    next.raiseSizingSamples += 1;
    next.raiseSizingSum += record.amount / record.potAmount;
  }
  if (record.potAmount && record.potAmount > 0 && raised) {
    const fraction = record.amount / record.potAmount;
    const previous = next.totalActions - 1;
    next.averageBetFraction = previous > 0 ? (next.averageBetFraction * previous + fraction) / next.totalActions : fraction;
  }
  return next;
}

export function modelRates(model: PlayerModel): { vpip: number; pfr: number; threeBet: number; fourBet: number; foldToBet: number; foldToThreeBet: number; averageRaiseSize: number } {
  return {
    vpip: model.handsObserved ? model.vpipHands / model.handsObserved : 0,
    pfr: model.handsObserved ? model.pfrHands / model.handsObserved : 0,
    threeBet: model.threeBetOpportunities ? model.threeBetCount / model.threeBetOpportunities : 0,
    fourBet: model.fourBetOpportunities ? model.fourBetCount / model.fourBetOpportunities : 0,
    foldToBet: model.facedBetCount ? model.foldToBetCount / model.facedBetCount : 0,
    foldToThreeBet: model.foldToThreeBetOpportunities ? model.foldToThreeBetCount / model.foldToThreeBetOpportunities : 0,
    averageRaiseSize: model.raiseSizingSamples ? model.raiseSizingSum / model.raiseSizingSamples : 0,
  };
}

/** Build public-action tendencies from saved hand history without reading any hole cards. */
export function buildPlayerModels(history: readonly HandSummary[]): Readonly<Record<string, PlayerModel>> {
  const models: Record<string, PlayerModel> = {};
  for (const hand of history) {
    for (const action of hand.actionHistory) {
      const current = models[action.playerId] ?? createPlayerModel();
      models[action.playerId] = recordObservedAction(current, {
        ...action,
        handId: hand.handId,
        facingBet: action.action === 'fold' || action.action === 'call',
        // A saved action does not contain enough public history to prove that
        // a raise was a 3-Bet. Only explicit observations may set the flag.
        potAmount: hand.finalPot,
      });
    }
  }
  return models;
}
