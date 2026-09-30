import type { ActionRecord } from '../game/gameState';
import { createPlayerModel, recordObservedAction, type PlayerModel } from './playerModel';

export type OpponentObservation = Partial<ActionRecord> & {
  handId?: string;
  voluntary?: boolean;
  pfr?: boolean;
  facingOpen?: boolean;
  threeBet?: boolean;
  isThreeBet?: boolean;
  facingThreeBet?: boolean;
  facing3Bet?: boolean;
  fourBet?: boolean;
  isFourBet?: boolean;
  foldToThreeBet?: boolean;
  foldTo3Bet?: boolean;
  amount?: number;
  potAmount?: number;
  raiseSize?: number;
};

export type OpponentModel = PlayerModel;

export function createOpponentModel(): OpponentModel {
  return createPlayerModel();
}

/**
 * Apply one public observation. Aggression flags are explicit inputs: a large
 * raise or final pot size alone never upgrades an action to a 3-Bet/4-Bet.
 */
export function updateOpponentModel(model: OpponentModel, observation: OpponentObservation): OpponentModel {
  if (!observation.action) throw new Error('Opponent observations require an action');
  const action = observation.action;
  return recordObservedAction(model, {
    playerId: observation.playerId ?? 'opponent',
    street: observation.street ?? 'PRE_FLOP',
    action,
    amount: observation.amount ?? 0,
    totalTo: observation.totalTo ?? observation.amount ?? 0,
    handId: observation.handId,
    facingBet: observation.facingOpen || observation.facingThreeBet,
    isThreeBet: observation.threeBet === true || observation.isThreeBet === true,
    facingOpen: observation.facingOpen === true,
    facingThreeBet: observation.facingThreeBet === true || observation.facing3Bet === true,
    isFourBet: observation.fourBet === true || observation.isFourBet === true,
    foldToThreeBet: observation.foldToThreeBet === true || observation.foldTo3Bet === true || ((observation.facingThreeBet === true || observation.facing3Bet === true) && action === 'fold'),
    potAmount: observation.potAmount,
    raiseSize: observation.raiseSize,
    voluntary: observation.voluntary,
    isPfr: observation.pfr,
  });
}

/** Minimum-sample rates keep new opponents near neutral defaults. */
export function opponentRates(model: OpponentModel, minimumSamples = 3): {
  vpip: number; pfr: number; threeBet: number; fourBet: number; foldToThreeBet: number; averageRaiseSize: number;
} {
  const neutral = { vpip: 0.22, pfr: 0.14, threeBet: 0.07, fourBet: 0.03, foldToThreeBet: 0.55, averageRaiseSize: 0 };
  const vpip = model.handsObserved >= minimumSamples ? model.vpipHands / model.handsObserved : neutral.vpip;
  const pfr = model.handsObserved >= minimumSamples ? model.pfrHands / model.handsObserved : neutral.pfr;
  const threeBet = model.threeBetOpportunities >= minimumSamples ? model.threeBetCount / model.threeBetOpportunities : neutral.threeBet;
  const fourBet = model.fourBetOpportunities >= minimumSamples ? model.fourBetCount / model.fourBetOpportunities : neutral.fourBet;
  const foldToThreeBet = model.foldToThreeBetOpportunities >= minimumSamples ? model.foldToThreeBetCount / model.foldToThreeBetOpportunities : neutral.foldToThreeBet;
  const averageRaiseSize = model.raiseSizingSamples >= minimumSamples ? model.raiseSizingSum / model.raiseSizingSamples : neutral.averageRaiseSize;
  return { vpip, pfr, threeBet, fourBet, foldToThreeBet, averageRaiseSize };
}
