import type { GameState, PlayerAction } from '../game/gameState';
import { chooseAction, type RandomSource } from './aiEngine';
import { getDifficultyProfile, type AIDifficulty } from './difficulty';
import { PERSONALITIES } from './personalities';
import { toPublicContext } from './publicContext';
import type { PlayerModel } from './playerModel';
import { applyShortStackStrategy, buildTournamentDecisionOptions } from './tournamentStrategy';

/** Map the table's configured big blind to the five career AI levels. */
export function difficultyForBigBlind(bigBlind: number): AIDifficulty {
  if (bigBlind >= 1_000) return 5;
  if (bigBlind >= 500) return 4;
  if (bigBlind >= 200) return 3;
  if (bigBlind >= 100) return 2;
  return 1;
}

export type AITurnDecision = { playerId: string; action: PlayerAction };

/**
 * Create one legal AI action from the state visible at the moment of the
 * decision. Human turns return null, so callers never create a human timer.
 */
export function chooseActionForState(state: GameState, rng: RandomSource = Math.random, opponentModels: Readonly<Record<string, PlayerModel>> = {}): AITurnDecision | null {
  if (state.actingSeat === null || state.street === 'SHOWDOWN' || state.street === 'SETTLEMENT') return null;
  const actor = state.players.find((player) => player.seat === state.actingSeat);
  if (!actor || actor.isHuman || actor.folded || actor.allIn) return null;
  // V2 difficulty is an explicit table/session setting. The blind fallback is
  // retained only for old snapshots that predate session metadata.
  const matchType = state.matchType ?? state.session?.matchType ?? 'CASH';
  const difficulty = state.tableLevel ?? state.session?.tableLevel ?? (matchType === 'MINI_TOURNAMENT' ? 3 : difficultyForBigBlind(state.bigBlind));
  // Reading the profile here makes the mapping explicit and ensures an
  // invalid future level cannot silently reach the decision engine.
  getDifficultyProfile(difficulty);
  const context = toPublicContext(state, actor.id, opponentModels);
  const liveStacks = state.players.filter((player) => !player.folded && player.id !== actor.id).map((player) => player.stack);
  const effectiveStackBB = Math.min(actor.stack, ...liveStacks.filter((stack) => Number.isFinite(stack))) / Math.max(1, state.bigBlind);
  const playersRemaining = state.players.filter((player) => !player.folded).length;
  const tournamentOptions = matchType === 'MINI_TOURNAMENT'
    ? buildTournamentDecisionOptions(state, actor.id, { effectiveStackBB, playersRemaining, entryLevel: state.tableLevel ?? difficulty, blindLevel: (state as GameStateWithTournament).tournamentBlindLevel ?? 1, handsAtLevel: (state as GameStateWithTournament).tournamentHandsAtLevel ?? 0 })
    : undefined;
  const action = chooseAction(context, difficulty, PERSONALITIES.BALANCED, rng, tournamentOptions ?? {
    matchType,
    tournament: matchType === 'MINI_TOURNAMENT' ? { effectiveStackBB, stackBB: actor.stack / Math.max(1, state.bigBlind), blindLevel: state.tableLevel ?? state.session?.tableLevel ?? difficulty, playersRemaining, handsAtLevel: state.handNumber } : undefined,
  });
  return {
    playerId: actor.id,
    action: tournamentOptions ? applyShortStackStrategy(action, tournamentOptions.tournament!, context.legalActions) : action,
  };
}

type GameStateWithTournament = GameState & { tournamentBlindLevel?: number; tournamentHandsAtLevel?: number };
