import {
  applyAction,
  advanceStreet,
  createTable,
  getLegalActions,
  startHand,
} from './gameEngine';

/**
 * Stable boundary for callers that need the poker core without importing a UI
 * store. The local implementation remains authoritative for V1 because it
 * supports the product's short-deck and settlement contracts.
 */
export type PokerCoreAdapter = {
  createTable: typeof createTable;
  startHand: typeof startHand;
  getLegalActions: typeof getLegalActions;
  applyAction: typeof applyAction;
  advanceStreet: typeof advanceStreet;
};

export const localPokerCoreAdapter: PokerCoreAdapter = {
  createTable,
  startHand,
  getLegalActions,
  applyAction,
  advanceStreet,
};
