import type { ActionRecord } from '../game/gameState';
import type { HandSummary } from '../career/handHistory';

export type ObservedActionRecord = ActionRecord & {
  handId?: string;
  facingBet?: boolean;
  isThreeBet?: boolean;
  potAmount?: number;
};

export type PlayerModel = {
  handsObserved: number;
  vpipHands: number;
  pfrHands: number;
  threeBetCount: number;
  threeBetOpportunities: number;
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
  const voluntary = record.action === 'call' || record.action === 'bet-to' || record.action === 'raise-to' || record.action === 'all-in';
  if (voluntary && record.handId && !next.vpipSeenHands.includes(record.handId)) {
    next.vpipSeenHands.push(record.handId);
    next.vpipHands += 1;
  }
  const raised = record.action === 'bet-to' || record.action === 'raise-to' || record.action === 'all-in';
  if (raised && record.street === 'PRE_FLOP' && record.handId && !next.pfrSeenHands.includes(record.handId)) {
    next.pfrSeenHands.push(record.handId);
    next.pfrHands += 1;
  }
  if (record.facingBet) {
    next.facedBetCount += 1;
    if (record.action === 'fold') next.foldToBetCount += 1;
  }
  if (record.isThreeBet) next.threeBetCount += 1;
  if (record.facingBet && record.street === 'PRE_FLOP') next.threeBetOpportunities += 1;
  if (record.potAmount && record.potAmount > 0 && raised) {
    const fraction = record.amount / record.potAmount;
    const previous = next.totalActions - 1;
    next.averageBetFraction = previous > 0 ? (next.averageBetFraction * previous + fraction) / next.totalActions : fraction;
  }
  return next;
}

export function modelRates(model: PlayerModel): { vpip: number; pfr: number; threeBet: number; foldToBet: number } {
  return {
    vpip: model.handsObserved ? model.vpipHands / model.handsObserved : 0,
    pfr: model.handsObserved ? model.pfrHands / model.handsObserved : 0,
    threeBet: model.threeBetOpportunities ? model.threeBetCount / model.threeBetOpportunities : 0,
    foldToBet: model.facedBetCount ? model.foldToBetCount / model.facedBetCount : 0,
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
        isThreeBet: action.action === 'raise-to',
        potAmount: hand.finalPot,
      });
    }
  }
  return models;
}
