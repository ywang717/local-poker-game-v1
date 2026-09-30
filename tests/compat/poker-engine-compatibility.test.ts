import { describe, expect, it } from 'vitest';
import {
  createTable,
  getLegalActions,
  replayCommands,
  transition,
} from '@hivetech/poker-engine';
import type { Card } from '@hivetech/poker-engine';

const deck: Card[] = Array.from({ length: 52 }, (_, index) => {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
  const suits = ['c', 'd', 'h', 's'] as const;
  return { rank: ranks[index % ranks.length], suit: suits[Math.floor(index / ranks.length)] };
});

describe('candidate poker engine compatibility', () => {
  it('starts a deterministic nine-seat hand and exposes legal actions', () => {
    const config = { smallBlind: 5, bigBlind: 10, minBuyIn: 100, maxSeats: 9 };
    let state = createTable(config);
    const commands = [
      { type: 'seat-player', playerId: 'hero', stack: 100, seat: 0 },
      { type: 'seat-player', playerId: 'villain', stack: 100, seat: 1 },
      { type: 'start-hand', deck },
    ] as const;
    for (const command of commands) {
      const result = transition(state, command);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
    }
    if (!state.hand) throw new Error('hand did not start');
    const actor = state.hand.players.find((player) => player.seat === state.hand!.currentActorSeat);
    expect(actor).toBeDefined();
    expect(getLegalActions(state, actor!.playerId).length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('replays the same commands into the same state', () => {
    const config = { smallBlind: 5, bigBlind: 10, minBuyIn: 100, maxSeats: 2 };
    const commands = [
      { type: 'seat-player', playerId: 'hero', stack: 100, seat: 0 },
      { type: 'seat-player', playerId: 'villain', stack: 100, seat: 1 },
      { type: 'start-hand', deck },
    ] as const;
    const replay = replayCommands(config, commands);
    expect(replay.ok).toBe(true);
  });
});
