import type { CareerState } from './careerState';
import { applyPendingCashBuyIn, syncActiveTableStack } from './cashBuyInService';
import type { GameState } from '../game/gameState';
import { CURRENT_SAVE_VERSION, type HandSnapshot } from '../types/persistence';
import { saveCareerAndHandSnapshot } from '../storage/saveSystem';

export type CashNextHandTransitionResult = {
  career: CareerState;
  game: GameState;
  appliedAmount: number;
  refundedAmount: number;
};

export type PreparedCashNextHandTransition = CashNextHandTransitionResult & { snapshot: HandSnapshot };

/**
 * Resolve a cash-table settlement and persist the following hand atomically.
 *
 * The caller supplies the existing table's next-hand factory so this module
 * remains independent from the UI and from the dealer/engine implementation.
 * A transaction is selected by session id and can therefore only be applied
 * once: an already APPLIED or REFUNDED pending record is a no-op in
 * applyPendingCashBuyIn.
 */
export function prepareCashNextHandTransition(
  career: CareerState,
  settledTable: GameState,
  createNextHand: (state: GameState) => GameState,
): PreparedCashNextHandTransition {
  const human = settledTable.players.find((player) => player.isHuman);
  if (!human || human.stack < 0 || !Number.isSafeInteger(human.stack)) throw new Error('Cash table human stack is invalid');

  let nextCareer = syncActiveTableStack(career, human.stack);
  let tableForNextHand = settledTable;
  let appliedAmount = 0;
  let refundedAmount = 0;
  const pending = nextCareer.pendingCashBuyIns.find((entry) => entry.status === 'PENDING' && entry.sessionId === settledTable.sessionId);
  if (pending) {
    const resolved = applyPendingCashBuyIn(nextCareer, pending, human.stack);
    nextCareer = resolved.career;
    appliedAmount = resolved.appliedAmount;
    refundedAmount = resolved.refundedAmount;
    if (appliedAmount > 0) {
      tableForNextHand = {
        ...settledTable,
        players: settledTable.players.map((player) => player.isHuman ? { ...player, stack: player.stack + appliedAmount } : player),
      };
    }
  }

  const nextGame = createNextHand(tableForNextHand);
  nextCareer = syncActiveTableStack(nextCareer, nextGame.players.find((player) => player.isHuman)?.stack ?? human.stack);
  const snapshot: HandSnapshot = {
    saveVersion: CURRENT_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state: structuredClone(nextGame),
  };
  return { career: nextCareer, game: nextGame, appliedAmount, refundedAmount, snapshot };
}

export async function persistPreparedCashNextHandTransition(prepared: PreparedCashNextHandTransition): Promise<void> {
  await saveCareerAndHandSnapshot(prepared.career, prepared.snapshot);
}

export async function commitCashNextHandTransition(
  career: CareerState,
  settledTable: GameState,
  createNextHand: (state: GameState) => GameState,
): Promise<CashNextHandTransitionResult> {
  const prepared = prepareCashNextHandTransition(career, settledTable, createNextHand);
  await persistPreparedCashNextHandTransition(prepared);
  return prepared;
}
