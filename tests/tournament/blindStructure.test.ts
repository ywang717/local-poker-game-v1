import { describe, expect, it } from 'vitest';
import { getBlindStructure, blindStructureFor } from '../../src/tournament/blindStructure';

describe('mini tournament blind structure', () => {
  it('starts from the selected table level and grows after each stage', () => {
    expect(getBlindStructure(1, 1)).toEqual({ level: 1, smallBlind: 25, bigBlind: 50 });
    expect(getBlindStructure(3, 1)).toEqual({ level: 1, smallBlind: 100, bigBlind: 200 });
    expect(getBlindStructure(1, 2).bigBlind).toBeGreaterThan(getBlindStructure(1, 1).bigBlind);
    expect(blindStructureFor(2, 3).bigBlind).toBeGreaterThan(blindStructureFor(2, 2).bigBlind);
  });
});
