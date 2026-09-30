import { chooseAction } from '../ai/aiEngine';
import { PERSONALITIES } from '../ai/personalities';
import { toPublicContext } from '../ai/publicContext';
import { createDeck, shuffleDeck } from '../game/cards';
import { applyAction, createTable, startHand } from '../game/gameEngine';
import { nextDealerSeat } from '../game/dealer';
import { settleGameState } from '../game/handSettlement';
import type { GameState, TableSize } from '../game/gameState';
import type { GameMode } from '../game/rules';

const STARTING_STACK = 1_000;
const SMALL_BLIND = 5;
const BIG_BLIND = 10;
const MAX_ACTIONS_PER_HAND = 1_000;

export type SimulationOptions = { mode: GameMode; hands: number; seed: number; tableSize: TableSize };

export type SimulationReport = {
  mode: GameMode; tableSize: TableSize; handsRequested: number; handsCompleted: number;
  actions: number; foldCount: number; callCount: number; raiseCount: number; allInCount: number; showdowns: number;
  deadlocks: number; illegalActions: number; negativeChipStates: number; unclaimedPots: number; refundErrors: number;
  chipConservationFailures: number; rebuyCount: number; maxSidePots: number; maxActions: number; digest: string;
};

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x1_0000_0000; };
}

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}

function playersFor(tableSize: TableSize) {
  return Array.from({ length: tableSize }, (_, seat) => ({ id: `p${seat}`, name: `AI ${seat}`, seat, stack: STARTING_STACK, isHuman: seat === 0 }));
}

function assertSafeState(state: GameState): void {
  for (const player of state.players) {
    if (!Number.isSafeInteger(player.stack) || !Number.isSafeInteger(player.streetContribution) || !Number.isSafeInteger(player.handContribution)) {
      throw new Error(`Unsafe chips in ${state.handId} at seat ${player.seat}`);
    }
    if (player.stack < 0 || player.streetContribution < 0 || player.handContribution < 0) throw new Error(`Negative chips in ${state.handId} at seat ${player.seat}`);
  }
}

function newReport(options: SimulationOptions): SimulationReport {
  return {
    mode: options.mode, tableSize: options.tableSize, handsRequested: options.hands, handsCompleted: 0,
    actions: 0, foldCount: 0, callCount: 0, raiseCount: 0, allInCount: 0, showdowns: 0,
    deadlocks: 0, illegalActions: 0, negativeChipStates: 0, unclaimedPots: 0, refundErrors: 0,
    chipConservationFailures: 0, rebuyCount: 0, maxSidePots: 0, maxActions: 0, digest: '',
  };
}

/** Runs one seeded table continuously; stacks and dealer position survive hand boundaries. */
export function runContinuousTableSimulation(options: SimulationOptions): SimulationReport {
  if (!Number.isSafeInteger(options.hands) || options.hands < 1) throw new Error('Simulation hands must be a positive integer');
  const rng = seeded(options.seed);
  const report = newReport(options);
  const outcomes: string[] = [];
  let players = playersFor(options.tableSize);
  let dealerSeat = 0;

  for (let hand = 0; hand < options.hands; hand += 1) {
    for (const player of players) {
      if (player.stack <= 0) { player.stack = STARTING_STACK; report.rebuyCount += 1; }
    }
    const occupiedSeats = new Set(players.map((player) => player.seat));
    const table = createTable({ mode: options.mode, tableSize: options.tableSize, smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND, dealerSeat, players });
    table.handNumber = hand;
    const preHandChips = table.players.reduce((sum, player) => sum + player.stack, 0);
    const stateAtStart = startHand(table, shuffleDeck(createDeck(options.mode), rng));
    // The production engine uses a UUID for human hand IDs; simulation IDs
    // must stay reproducible for fixed seeds.
    stateAtStart.handId = `sim-${options.mode}-${options.tableSize}-${hand + 1}`;
    let state = stateAtStart;
    let actionSteps = 0;
    const handActions: string[] = [];

    while (state.street !== 'SHOWDOWN' && state.street !== 'SETTLEMENT') {
      if (state.actingSeat === null) { report.deadlocks += 1; throw new Error(`Deadlock at ${state.handId}`); }
      if (actionSteps >= MAX_ACTIONS_PER_HAND) { report.deadlocks += 1; throw new Error(`Action limit exceeded at ${state.handId}`); }
      const actor = state.players.find((player) => player.seat === state.actingSeat);
      if (!actor) { report.illegalActions += 1; throw new Error(`Missing acting player at ${state.handId}`); }
      const context = toPublicContext(state, actor.id);
      const action = chooseAction(context, 3, PERSONALITIES.BALANCED, rng);
      const transition = applyAction(state, { playerId: actor.id, action });
      if (!transition.ok) { report.illegalActions += 1; throw new Error(`Illegal action at ${state.handId}: ${transition.error.message}`); }
      state = transition.state;
      actionSteps += 1;
      report.actions += 1;
      if (action.kind === 'fold') report.foldCount += 1;
      if (action.kind === 'call') report.callCount += 1;
      if (action.kind === 'bet-to' || action.kind === 'raise-to') report.raiseCount += 1;
      if (action.kind === 'all-in') report.allInCount += 1;
      handActions.push(`${actor.id}:${action.kind}`);
      try { assertSafeState(state); } catch (error) { report.negativeChipStates += 1; throw error; }
    }

    if (state.street === 'SHOWDOWN') report.showdowns += 1;
    const settled = settleGameState(state);
    const result = settled.result;
    const endingChips = settled.state.players.reduce((sum, player) => sum + player.stack, 0);
    const contributionTotal = state.players.reduce((sum, player) => sum + player.handContribution, 0);
    const refundTotal = result.refunds.reduce((sum, refund) => sum + refund.amount, 0);
    if (result.totalAwarded !== result.totalPot) { report.unclaimedPots += 1; throw new Error(`Unclaimed pot at ${state.handId}`); }
    if (refundTotal !== result.totalRefunded || contributionTotal !== result.totalPot + result.totalRefunded) { report.refundErrors += 1; throw new Error(`Refund accounting failed at ${state.handId}`); }
    if (preHandChips !== endingChips) { report.chipConservationFailures += 1; throw new Error(`Chip conservation failed at ${state.handId}: ${preHandChips} != ${endingChips}`); }
    report.maxSidePots = Math.max(report.maxSidePots, result.pots.length);
    report.maxActions = Math.max(report.maxActions, actionSteps);
    report.handsCompleted += 1;
    outcomes.push(`${state.handId}:${actionSteps}:${result.totalPot}:${result.totalRefunded}:${result.awards.map((award) => `${award.playerId}=${award.amount}`).join(',')}:${handActions.join('|')}`);

    players = settled.state.players.map((player) => ({ id: player.id, name: player.name, seat: player.seat, stack: player.stack, isHuman: player.isHuman }));
    dealerSeat = nextDealerSeat(options.tableSize, state.dealerSeat, occupiedSeats);
  }
  report.digest = hash(JSON.stringify({ options, outcomes }));
  return report;
}

export function runSimulation(options: SimulationOptions): SimulationReport {
  return runContinuousTableSimulation(options);
}
