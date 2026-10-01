import { describe, expect, it } from 'vitest';
import { decideJam } from '../../src/ai/jamStrategy';

describe('V2 all-in gates', () => {
  it('gates deep-stack jams and allows short-stack value jams', () => {
    expect(decideJam({ situation: 'FACING_OPEN', effectiveStackBB: 100, handStrength: 0.99, canRaise: true, canCall: true })).not.toBe('JAM');
    expect(decideJam({ situation: 'FACING_OPEN', effectiveStackBB: 12, handStrength: 0.99, canRaise: true, canCall: true })).toBe('JAM');
    expect(decideJam({ situation: 'FACING_OPEN', effectiveStackBB: 12, handStrength: 0.2, canRaise: true, canCall: true, potOdds: 0.2 })).toBe('FOLD');
  });
});
