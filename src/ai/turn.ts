import type { GameState, PlayerAction } from '../game/gameState';
import { chooseAction, type RandomSource } from './aiEngine';
import { getDifficultyProfile, type AIDifficulty } from './difficulty';
import { PERSONALITIES } from './personalities';
import { toPublicContext } from './publicContext';
import type { PlayerModel } from './playerModel';

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
  const difficulty = difficultyForBigBlind(state.bigBlind);
  // Reading the profile here makes the mapping explicit and ensures an
  // invalid future level cannot silently reach the decision engine.
  getDifficultyProfile(difficulty);
  const context = toPublicContext(state, actor.id, opponentModels);
  return {
    playerId: actor.id,
    action: chooseAction(context, difficulty, PERSONALITIES.BALANCED, rng),
  };
}
