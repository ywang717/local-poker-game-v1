import { chooseAction } from '../ai/aiEngine';
import { PERSONALITIES } from '../ai/personalities';
import type { AIDifficulty } from '../ai/difficulty';
import { toPublicContext } from '../ai/publicContext';
import { settleGameState } from '../game/handSettlement';
import { applyAction } from '../game/gameEngine';
import { finishTournament, settleTournamentHand, startTournament, startTournamentHand } from '../tournament/tournamentEngine';
import type { TournamentState } from '../tournament/types';
import type { GameMode } from '../game/rules';
import type { TableLevelId } from '../career/tableLevels';
import { seeded } from './runSimulation';

const MAX_ACTIONS_PER_HAND = 1_000;
const MAX_HANDS_PER_TOURNAMENT = 100_000;

export type TournamentSimulationOptions = {
  mode: GameMode;
  tableLevel: TableLevelId;
  tournaments: number;
  seed: number;
  difficulty?: AIDifficulty;
};

export type TournamentRun = {
  tournamentId: string;
  mode: GameMode;
  tableLevel: TableLevelId;
  difficulty: AIDifficulty;
  championId: string;
  playersRemaining: number;
  handsCompleted: number;
  actions: number;
  foldCount: number;
  callCount: number;
  raiseCount: number;
  allInCount: number;
  deadlocks: number;
  illegalActions: number;
  negativeChipStates: number;
  unclaimedPots: number;
  refundErrors: number;
  chipConservationFailures: number;
  rebuyCount: number;
  maxActions: number;
  digest: string;
};

export type TournamentReport = {
  mode: GameMode;
  tableLevel: TableLevelId;
  difficulty: AIDifficulty;
  tournamentsRequested: number;
  tournamentsCompleted: number;
  champions: string[];
  handsCompleted: number;
  actions: number;
  foldCount: number;
  callCount: number;
  raiseCount: number;
  allInCount: number;
  deadlocks: number;
  illegalActions: number;
  negativeChipStates: number;
  unclaimedPots: number;
  refundErrors: number;
  chipConservationFailures: number;
  rebuyCount: number;
  runs: TournamentRun[];
  digest: string;
};

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}

function safeState(state: TournamentState): void {
  for (const player of state.players) {
    if (!Number.isSafeInteger(player.stack) || player.stack < 0) throw new Error(`Unsafe tournament chips for ${player.id}`);
  }
}

function validateOptions(options: TournamentSimulationOptions): void {
  if (!Number.isSafeInteger(options.tournaments) || options.tournaments < 1) throw new Error('tournaments must be a positive integer');
  if (!Number.isSafeInteger(options.seed)) throw new Error('seed must be a safe integer');
}

function emptyReport(options: TournamentSimulationOptions, difficulty: AIDifficulty): TournamentReport {
  return {
    mode: options.mode, tableLevel: options.tableLevel, difficulty,
    tournamentsRequested: options.tournaments, tournamentsCompleted: 0, champions: [], handsCompleted: 0, actions: 0,
    foldCount: 0, callCount: 0, raiseCount: 0, allInCount: 0, deadlocks: 0, illegalActions: 0,
    negativeChipStates: 0, unclaimedPots: 0, refundErrors: 0, chipConservationFailures: 0, rebuyCount: 0,
    runs: [], digest: '',
  };
}

/** Run every requested tournament to a champion; a hand limit is a safety error, never a completion path. */
export function runTournamentSimulation(options: TournamentSimulationOptions): TournamentReport {
  validateOptions(options);
  const difficulty = options.difficulty ?? options.tableLevel;
  const report = emptyReport(options, difficulty);
  const runDigests: string[] = [];
  for (let tournamentIndex = 0; tournamentIndex < options.tournaments; tournamentIndex += 1) {
    const tournamentId = `sim-${options.mode}-${options.tableLevel}-${tournamentIndex + 1}`;
    let tournament = startTournament({ mode: options.mode, tableLevel: options.tableLevel, tournamentId, humanId: 'sim-human' });
    const initialChips = tournament.players.reduce((sum, player) => sum + player.stack, 0);
    const dealRng = seeded((options.seed ^ 0x9e3779b9 ^ Math.imul(tournamentIndex + 1, 0x45d9f3b)) >>> 0);
    const decisionRng = seeded((options.seed ^ 0x243f6a88 ^ Math.imul(tournamentIndex + 1, 0x119de1f3)) >>> 0);
    let hands = 0;
    let actions = 0;
    let folds = 0;
    let calls = 0;
    let raises = 0;
    let allIns = 0;
    let maxActions = 0;
    const outcomes: string[] = [];
    while (tournament.players.length > 1) {
      if (hands >= MAX_HANDS_PER_TOURNAMENT) throw new Error(`Tournament ${tournamentId} exceeded safety hand limit without a champion`);
      const beforeHand = tournament.players.reduce((sum, player) => sum + player.stack, 0);
      let game = startTournamentHand(tournament, dealRng);
      game.handId = `${tournamentId}-hand-${hands + 1}`;
      let actionSteps = 0;
      const handActions: string[] = [];
      while (game.street !== 'SHOWDOWN' && game.street !== 'SETTLEMENT') {
        if (game.actingSeat === null) throw new Error(`Deadlock at ${game.handId}`);
        if (actionSteps >= MAX_ACTIONS_PER_HAND) throw new Error(`Action limit exceeded at ${game.handId}`);
        const actor = game.players.find((player) => player.seat === game.actingSeat);
        if (!actor) throw new Error(`Missing acting player at ${game.handId}`);
        const context = toPublicContext(game, actor.id);
        const stackBB = actor.stack / Math.max(1, game.bigBlind);
        const action = chooseAction(context, difficulty, actor.personalityId ?? PERSONALITIES.BALANCED, decisionRng, {
          matchType: 'MINI_TOURNAMENT',
          tournament: {
            stackBB,
            effectiveStackBB: Math.min(...game.players.filter((player) => !player.folded && player.stack > 0).map((player) => player.stack / Math.max(1, game.bigBlind))),
            blindLevel: tournament.blindLevel,
            handsAtLevel: tournament.handsAtLevel,
            playersRemaining: tournament.players.length,
          },
        });
        const transition = applyAction(game, { playerId: actor.id, action });
        if (!transition.ok) throw new Error(`Illegal action at ${game.handId}: ${transition.error.message}`);
        game = transition.state;
        actionSteps += 1;
        actions += 1;
        if (action.kind === 'fold') folds += 1;
        if (action.kind === 'call') calls += 1;
        if (action.kind === 'bet-to' || action.kind === 'raise-to') raises += 1;
        if (action.kind === 'all-in') allIns += 1;
        handActions.push(`${actor.id}:${action.kind}`);
        safeState({ ...tournament, players: game.players.map((player) => ({ ...player, startingStack: tournament.players.find((entry) => entry.id === player.id)?.startingStack ?? player.stack })) });
      }
      const settled = settleGameState(game);
      const result = settled.result;
      if (result.totalAwarded !== result.totalPot) throw new Error(`Unclaimed pot at ${game.handId}`);
      const contributionTotal = game.players.reduce((sum, player) => sum + player.handContribution, 0);
      if (contributionTotal !== result.totalPot + result.totalRefunded) throw new Error(`Refund accounting failed at ${game.handId}`);
      const afterHand = settled.state.players.reduce((sum, player) => sum + player.stack, 0);
      if (beforeHand !== afterHand) throw new Error(`Chip conservation failed at ${game.handId}`);
      tournament = settleTournamentHand(tournament, settled.state);
      safeState(tournament);
      // Eliminated players are removed only at zero chips, so live stacks must
      // still equal the original tournament bankroll after every hand.
      if (initialChips !== tournament.players.reduce((sum, player) => sum + player.stack, 0)) throw new Error(`Tournament chip conservation failed at ${game.handId}`);
      hands += 1;
      maxActions = Math.max(maxActions, actionSteps);
      outcomes.push(`${game.handId}:${actionSteps}:${result.totalPot}:${result.totalRefunded}:${result.awards.map((award) => `${award.playerId}=${award.amount}`).join(',')}:${handActions.join('|')}`);
    }
    const finished = finishTournament(tournament);
    if (finished.state.players[0]?.stack !== initialChips) throw new Error(`Champion chip conservation failed at ${tournamentId}`);
    const run: TournamentRun = {
      tournamentId, mode: options.mode, tableLevel: options.tableLevel, difficulty,
      championId: finished.championId, playersRemaining: finished.state.players.length, handsCompleted: hands,
      actions, foldCount: folds, callCount: calls, raiseCount: raises, allInCount: allIns,
      deadlocks: 0, illegalActions: 0, negativeChipStates: 0, unclaimedPots: 0, refundErrors: 0,
      chipConservationFailures: 0, rebuyCount: 0, maxActions,
      digest: hash(JSON.stringify({ tournamentId, outcomes })),
    };
    report.runs.push(run);
    report.champions.push(run.championId);
    report.tournamentsCompleted += 1;
    report.handsCompleted += hands;
    report.actions += actions;
    report.foldCount += folds;
    report.callCount += calls;
    report.raiseCount += raises;
    report.allInCount += allIns;
    runDigests.push(run.digest);
  }
  report.digest = hash(JSON.stringify({ options, runs: runDigests }));
  return report;
}
