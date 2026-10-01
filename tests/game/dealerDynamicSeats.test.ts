import { describe, expect, it } from 'vitest';
import { blindSeatsForPlayers, getActionOrderForPlayers } from '../../src/game/dealer';

describe('dynamic occupied-seat dealer helpers', () => {
  const players = [{ seat: 0 }, { seat: 2 }, { seat: 5 }, { seat: 7 }, { seat: 8 }, { seat: 9 }];

  it('uses only occupied seats when a table is reduced to heads-up', () => {
    const headsUp = [{ seat: 2 }, { seat: 8 }];
    expect(blindSeatsForPlayers(headsUp, 2)).toEqual({ smallBlindSeat: 2, bigBlindSeat: 8 });
    expect(getActionOrderForPlayers(headsUp, 2, 'PRE_FLOP')).toEqual([2, 8]);
    expect(getActionOrderForPlayers(headsUp, 2, 'FLOP')).toEqual([8, 2]);
  });

  it('skips eliminated seats for six-to-three transitions', () => {
    const remaining = players.filter(({ seat }) => seat !== 2 && seat !== 7);
    expect(blindSeatsForPlayers(remaining, 5)).toEqual({ smallBlindSeat: 8, bigBlindSeat: 9 });
    expect(getActionOrderForPlayers(remaining, 5, 'PRE_FLOP')).toEqual([0, 5, 8, 9]);
  });
});
