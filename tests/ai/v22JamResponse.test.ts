import { describe, expect, it } from 'vitest';
import { decideJam } from '../../src/ai/jamStrategy';

describe('V2.2 jam response by effective stack bucket', () => {
  it('tightens a marginal deep-stack response to an all-in', () => {
    expect(decideJam({ situation: 'FACING_ALL_IN', effectiveStackBB: 100, handStrength: 0.55, potOdds: 0.2, canRaise: false, canCall: true })).toBe('FOLD');
  });

  it('keeps a short-stack response available at the same price', () => {
    expect(decideJam({ situation: 'FACING_ALL_IN', effectiveStackBB: 12, handStrength: 0.55, potOdds: 0.2, canRaise: false, canCall: true })).toBe('CALL');
  });
});
