import { chooseAction } from '../ai/aiEngine';
import { PERSONALITIES } from '../ai/personalities';
import { toPublicContext } from '../ai/publicContext';
import { createDeck, shuffleDeck } from '../game/cards';
import { applyAction, createTable, startHand } from '../game/gameEngine';
import { nextDealerSeat } from '../game/dealer';
import { settleGameState } from '../game/handSettlement';
import type { GameState, TableSize } from '../game/gameState';
import type { GameMode } from '../game/rules';
import type { AIDifficulty } from '../ai/difficulty';
import type { PublicTableContext } from '../ai/publicContext';
import type { PlayerAction } from '../game/gameState';

const STARTING_STACK = 1_000;
const SMALL_BLIND = 5;
const BIG_BLIND = 10;
const MAX_ACTIONS_PER_HAND = 1_000;

export type SimulationOptions = {
  mode: GameMode; hands: number; seed: number; tableSize: TableSize;
  difficulty?: AIDifficulty;
  /** Optional independent streams for card dealing and AI decisions. */
  dealSeed?: number;
  decisionSeed?: number;
  onAction?: (context: PublicTableContext, action: PlayerAction) => void;
};

export type SimulationReport = {
  mode: GameMode; tableSize: TableSize; handsRequested: number; handsCompleted: number;
  actions: number; foldCount: number; callCount: number; raiseCount: number; allInCount: number;
  /** Deprecated alias kept for existing reports; equals showdownHands. */
  showdowns: number;
  showdownHands: number; wonWithoutShowdown: number; showdownRate: number;
  deadlocks: number; illegalActions: number; negativeChipStates: number; unclaimedPots: number; refundErrors: number;
  chipConservationFailures: number; rebuyCount: number; maxSidePots: number; maxActions: number; digest: string;
};

export function seeded(seed: number): () => number {
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
    actions: 0, foldCount: 0, callCount: 0, raiseCount: 0, allInCount: 0,
    showdowns: 0, showdownHands: 0, wonWithoutShowdown: 0, showdownRate: 0,
    deadlocks: 0, illegalActions: 0, negativeChipStates: 0, unclaimedPots: 0, refundErrors: 0,
    chipConservationFailures: 0, rebuyCount: 0, maxSidePots: 0, maxActions: 0, digest: '',
  };
}

/** Runs one seeded table continuously; stacks and dealer position survive hand boundaries. */
export function runContinuousTableSimulation(options: SimulationOptions): SimulationReport {
  if (!Number.isSafeInteger(options.hands) || options.hands < 1) throw new Error('Simulation hands must be a positive integer');
  // Keep the legacy rules harness byte-for-byte reproducible when no stream
  // override is supplied. The V2 experience harness passes both overrides to
  // isolate card dealing from AI decisions.
  const sharedRng = options.dealSeed === undefined && options.decisionSeed === undefined ? seeded(options.seed) : undefined;
  const dealRng = sharedRng ?? seeded(options.dealSeed ?? ((options.seed ^ 0x9e3779b9) >>> 0));
  const decisionRng = sharedRng ?? seeded(options.decisionSeed ?? ((options.seed ^ 0x243f6a88) >>> 0));
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
    const stateAtStart = startHand(table, shuffleDeck(createDeck(options.mode), dealRng));
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
      const action = chooseAction(context, options.difficulty ?? 3, actor.personalityId ?? PERSONALITIES.BALANCED, decisionRng);
      options.onAction?.(context, action);
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

    // The engine reaches SHOWDOWN for both a genuine hand comparison and the
    // faster one-player-win path after every other player folds.  Only the
    // former is a showdown for experience metrics.
    const livePlayers = state.players.filter((player) => !player.folded).length;
    if (state.street === 'SHOWDOWN' && livePlayers >= 2) {
      report.showdowns += 1;
      report.showdownHands += 1;
    } else if (livePlayers === 1) {
      report.wonWithoutShowdown += 1;
    }
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
    report.showdownRate = report.handsCompleted > 0 ? report.showdownHands / report.handsCompleted : 0;
    outcomes.push(`${state.handId}:${actionSteps}:${result.totalPot}:${result.totalRefunded}:${result.awards.map((award) => `${award.playerId}=${award.amount}`).join(',')}:${handActions.join('|')}`);

    players = settled.state.players.map((player) => ({ id: player.id, name: player.name, seat: player.seat, stack: player.stack, isHuman: player.isHuman, personalityId: player.personalityId }));
    dealerSeat = nextDealerSeat(options.tableSize, state.dealerSeat, occupiedSeats);
  }
  report.digest = hash(JSON.stringify({ options, outcomes }));
  return report;
}

export function runSimulation(options: SimulationOptions): SimulationReport {
  return runContinuousTableSimulation(options);
}

export type RulesRegressionMatrixOptions = { handsPerCell?: number; seed?: number };

/** Run the release rules matrix without changing its fourteen mode/seat cells. */
export function runRulesRegressionMatrix(options: RulesRegressionMatrixOptions = {}): SimulationReport[] {
  const handsPerCell = options.handsPerCell ?? 1_000;
  if (!Number.isSafeInteger(handsPerCell) || handsPerCell < 1) throw new Error('handsPerCell must be a positive integer');
  const seed = options.seed ?? 0x1400_0000;
  const reports: SimulationReport[] = [];
  for (const mode of ['STANDARD', 'SHORT_DECK'] as const) {
    for (const tableSize of [2, 3, 4, 5, 6, 8, 9] as const) {
      reports.push(runSimulation({
        mode, tableSize, hands: handsPerCell,
        seed: seed + tableSize + (mode === 'SHORT_DECK' ? 100 : 0),
      }));
    }
  }
  return reports;
}
