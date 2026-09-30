import { chooseAction } from '../ai/aiEngine';
import { PERSONALITIES } from '../ai/personalities';
import { toPublicContext } from '../ai/publicContext';
import { buildPots } from '../game/sidePot';
import { assertChipConservation, settlePots } from '../game/settlement';
import { createDeck, shuffleDeck } from '../game/cards';
import { evaluateHand } from '../game/handEvaluator';
import { applyAction, createTable, startHand } from '../game/gameEngine';
import type { GameState, TableSize } from '../game/gameState';
import type { GameMode } from '../game/rules';

const STARTING_STACK = 1_000;
const SMALL_BLIND = 5;
const BIG_BLIND = 10;

export type SimulationOptions = {
  mode: GameMode;
  hands: number;
  seed: number;
  tableSize: TableSize;
};

export type SimulationReport = {
  mode: GameMode;
  tableSize: TableSize;
  handsRequested: number;
  handsCompleted: number;
  actions: number;
  deadlocks: number;
  illegalActions: number;
  unclaimedPots: number;
  negativeChipStates: number;
  chipConservationFailures: number;
  digest: string;
};

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}

function playersFor(tableSize: TableSize) {
  return Array.from({ length: tableSize }, (_, seat) => ({ id: `p${seat}`, name: `AI ${seat}`, seat, stack: STARTING_STACK }));
}

function assertNoNegative(state: GameState): void {
  for (const player of state.players) {
    if (player.stack < 0 || player.streetContribution < 0 || player.handContribution < 0) throw new Error(`Negative chips in ${state.handId} at seat ${player.seat}`);
  }
}

export function runSimulation(options: SimulationOptions): SimulationReport {
  if (!Number.isSafeInteger(options.hands) || options.hands < 1) throw new Error('Simulation hands must be a positive integer');
  const rng = seeded(options.seed);
  const report: SimulationReport = {
    mode: options.mode,
    tableSize: options.tableSize,
    handsRequested: options.hands,
    handsCompleted: 0,
    actions: 0,
    deadlocks: 0,
    illegalActions: 0,
    unclaimedPots: 0,
    negativeChipStates: 0,
    chipConservationFailures: 0,
    digest: '',
  };
  const outcomes: string[] = [];
  for (let hand = 0; hand < options.hands; hand += 1) {
    const table = createTable({ mode: options.mode, tableSize: options.tableSize, smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND, dealerSeat: hand % options.tableSize, players: playersFor(options.tableSize) });
    const game = startHand(table, shuffleDeck(createDeck(options.mode), rng));
    let state = game;
    const maxActions = 500;
    let actionSteps = 0;
    while (state.street !== 'SHOWDOWN' && state.street !== 'SETTLEMENT') {
      if (state.actingSeat === null) {
        report.deadlocks += 1;
        throw new Error(`Deadlock at ${state.handId}: ${JSON.stringify(state)}`);
      }
      if (actionSteps >= maxActions) {
        report.deadlocks += 1;
        throw new Error(`Action limit exceeded at ${state.handId}: ${JSON.stringify(state.actionHistory)}`);
      }
      const actor = state.players.find((player) => player.seat === state.actingSeat);
      if (!actor) throw new Error(`Missing acting player at ${state.handId}`);
      const context = toPublicContext(state, actor.id);
      const chosen = chooseAction(context, 3, PERSONALITIES.BALANCED, rng);
      // Keep the continuous chip-conservation runout focused on every street
      // and side-pot path; folded-player payout behavior is covered by the
      // dedicated settlement tests.
      const action = chosen.kind === 'fold'
        ? context.legalActions.some((entry) => entry.kind === 'call')
          ? { kind: 'call' as const }
          : context.legalActions.some((entry) => entry.kind === 'check')
            ? { kind: 'check' as const }
            : { kind: 'all-in' as const }
        : chosen;
      const transition = applyAction(state, { playerId: actor.id, action });
      if (!transition.ok) {
        report.illegalActions += 1;
        throw new Error(`Illegal action at ${state.handId}: ${transition.error.message}; history=${JSON.stringify(state.actionHistory)}`);
      }
      state = transition.state;
      actionSteps += 1;
      report.actions += 1;
      try { assertNoNegative(state); } catch (error) { report.negativeChipStates += 1; throw error; }
    }
    if (state.communityCards.length !== 5) throw new Error(`Incomplete board at ${state.handId}`);
    const participants = state.players.map((player) => ({ id: player.id, seat: player.seat, contribution: player.handContribution, folded: player.folded }));
    const pots = buildPots(participants);
    const evaluations = Object.fromEntries(state.players.filter((player) => !player.folded).map((player) => [player.id, evaluateHand(player.holeCards, state.communityCards, options.mode)]));
    const settlement = settlePots(pots, state.players.map((player) => ({ id: player.id, seat: player.seat, folded: player.folded })), evaluations, state.dealerSeat, options.mode);
    if (settlement.totalAwarded !== settlement.totalPot) {
      report.unclaimedPots += 1;
      throw new Error(`Unclaimed pot at ${state.handId}`);
    }
    try {
      assertChipConservation(options.tableSize * STARTING_STACK, state.players.reduce((sum, player) => sum + player.stack, 0) + settlement.totalAwarded);
    } catch (error) {
      report.chipConservationFailures += 1;
      throw new Error(`Chip conservation failed at ${state.handId}: ${String(error)}`);
    }
    report.handsCompleted += 1;
    outcomes.push(`${state.handId}:${actionSteps}:${settlement.totalPot}:${settlement.awards.map((award) => `${award.playerId}=${award.amount}`).join(',')}`);
  }
  report.digest = hash(JSON.stringify({ options, outcomes }));
  return report;
}
