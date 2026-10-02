import { chooseActionForState } from '../ai/turn';
import { applyAction } from '../game/gameEngine';
import type { GameState } from '../game/gameState';
import { settleGameState } from '../game/handSettlement';
import { finishTournament } from './tournamentSettlement';
import { settleTournamentHand, startTournamentHand } from './tournamentEngine';
import type { TournamentState } from './types';

/** A small deterministic RNG for the spectator fast-forward path. */
function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function runAiHand(input: GameState, rng: () => number): GameState {
  let state = input;
  let actions = 0;
  while (state.street !== 'SHOWDOWN' && state.street !== 'SETTLEMENT') {
    if (state.actingSeat === null) throw new Error(`锦标赛快速模拟卡在 ${state.handId ?? '当前牌局'}`);
    if (actions >= 1_000) throw new Error(`锦标赛快速模拟行动次数异常: ${state.handId ?? '当前牌局'}`);
    const actor = state.players.find((player) => player.seat === state.actingSeat);
    if (!actor || actor.isHuman) throw new Error('真人仍在牌桌上，不能进入观战快速模拟');
    const decision = chooseActionForState(state, rng);
    if (!decision) throw new Error(`AI 未能为 ${actor.id} 生成行动`);
    const transition = applyAction(state, { playerId: decision.playerId, action: decision.action });
    if (!transition.ok) throw new Error(`锦标赛快速模拟出现非法行动: ${transition.error.message}`);
    state = transition.state;
    actions += 1;
  }
  return state.street === 'SHOWDOWN' ? settleGameState(state).state : state;
}

/**
 * Continue a spectator tournament with the real engine and AI until exactly
 * one player remains. No rebuy, random champion assignment, or UI timers are
 * involved. An active spectator hand may be supplied so it is settled first.
 */
export function fastSimulateTournamentToEnd(input: { tournament: TournamentState; game?: GameState; seed?: number }): TournamentState {
  let tournament = structuredClone(input.tournament);
  const rng = seeded(input.seed ?? 0x5212_026);
  let activeGame = input.game;

  while (tournament.players.length > 1) {
    let game: GameState;
    if (activeGame && activeGame.street !== 'SETTLEMENT') {
      game = activeGame;
    } else if (activeGame && activeGame.street === 'SETTLEMENT') {
      game = activeGame;
    } else {
      game = startTournamentHand(tournament, rng);
    }
    game = runAiHand(game, rng);
    tournament = settleTournamentHand(tournament, game);
    activeGame = undefined;
  }

  return finishTournament(tournament).state;
}
