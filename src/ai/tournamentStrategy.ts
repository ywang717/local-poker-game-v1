import type { GameState, LegalAction, PlayerAction } from '../game/gameState';
import type { DecisionOptions, TournamentDecisionContext } from './aiEngine';

export type TournamentStrategyContext = TournamentDecisionContext & {
  entryLevel: NonNullable<GameState['tableLevel']>;
  stackRank?: number;
  shortestStackBB?: number;
};

/** Build explicit tournament inputs for the V2 decision engine. */
export function buildTournamentDecisionOptions(state: GameState, actorId?: string, extra: Partial<TournamentStrategyContext> = {}): DecisionOptions {
  const actor = actorId ? state.players.find((player) => player.id === actorId) : state.players.find((player) => player.seat === state.actingSeat);
  if (!actor) throw new Error('Tournament actor is required');
  const live = state.players.filter((player) => !player.folded && player.stack > 0);
  const bigBlind = Math.max(1, state.bigBlind);
  const effectiveStackBB = Math.min(actor.stack, ...live.filter((player) => player.id !== actor.id).map((player) => player.stack)) / bigBlind;
  const tournamentRemaining = state.tournamentState?.players.length
    ?? state.tournamentPlayersRemaining
    ?? state.players.length;
  const context: TournamentStrategyContext = {
    stackBB: actor.stack / bigBlind,
    effectiveStackBB,
    blindLevel: state.tournamentBlindLevel ?? 1,
    handsAtLevel: state.tournamentHandsAtLevel ?? 0,
    playersRemaining: tournamentRemaining,
    entryLevel: state.tableLevel ?? 3,
    shortestStackBB: Math.min(...live.map((player) => player.stack)) / bigBlind,
    ...extra,
  };
  return { matchType: 'MINI_TOURNAMENT', tournament: context };
}

export const tournamentDecisionOptions = buildTournamentDecisionOptions;
export const getTournamentAIContext = buildTournamentDecisionOptions;

export function isShortStack(stackBB: number): boolean { return stackBB <= 15; }

/** Keep short-stack choices legal while allowing the shared V2 engine to set ranges. */
export function applyShortStackStrategy(action: PlayerAction, context: TournamentDecisionContext, legalActions: readonly LegalAction[]): PlayerAction {
  if (!isShortStack(context.effectiveStackBB ?? context.stackBB ?? Number.POSITIVE_INFINITY)) return action;
  if (action.kind === 'fold' && legalActions.some((entry) => entry.kind === 'check')) return { kind: 'check' };
  return action;
}

export const shortStackStrategy = applyShortStackStrategy;
