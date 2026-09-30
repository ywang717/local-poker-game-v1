import { describe, expect, it } from 'vitest';
import { applyBankruptcyProtection, buyIn, createCareer, getTableAvailability } from '../../src/career/careerService';
import { TABLE_LEVELS } from '../../src/career/tableLevels';
import { SUPPORTED_TABLE_SIZES } from '../../src/game/gameState';
import { runSimulation } from '../../src/simulation/runSimulation';
import { createCareer as makeCareer } from '../../src/career/careerService';
import { getStartupDestination } from '../../src/App';

describe('V1 release acceptance', () => {
  it('keeps all seven table sizes and five levels available through the public APIs', () => {
    expect(SUPPORTED_TABLE_SIZES).toEqual([2, 3, 4, 5, 6, 8, 9]);
    expect(TABLE_LEVELS).toHaveLength(5);
    const career = createCareer('验收玩家');
    expect(getTableAvailability(career)).toHaveLength(5);
    expect(getTableAvailability(career).filter((entry) => entry.unlocked)).toHaveLength(1);
  });

  it('does not delete a career when bankruptcy protection is applied', () => {
    const career = createCareer('验收玩家');
    const protectedCareer = applyBankruptcyProtection({ ...career, currentFunds: 0, activeTableStack: 0 });
    expect(protectedCareer.nickname).toBe('验收玩家');
    expect(protectedCareer.currentFunds).toBe(5_000);
    expect(protectedCareer.bankruptcyCount).toBe(1);
  });

  it('allows the default buy-in and selects an unfinished hand on resume', () => {
    const career = makeCareer('验收玩家');
    const entered = buyIn(career, 1);
    expect(entered.tableStack).toBe(5_000);
    const fakeSnapshot = { saveVersion: 1 as const, savedAt: '2026-09-30T00:00:00.000Z', state: { handId: 'resume-1', street: 'RIVER' } as never };
    expect(getStartupDestination(entered.career, fakeSnapshot)).toBe('GAME');
  });

  it('runs a smoke hand for every supported table size in both modes', () => {
    for (const tableSize of SUPPORTED_TABLE_SIZES) {
      for (const mode of ['STANDARD', 'SHORT_DECK'] as const) {
        const report = runSimulation({ mode, hands: 2, seed: tableSize * 100 + (mode === 'SHORT_DECK' ? 1 : 0), tableSize });
        expect(report.handsCompleted).toBe(2);
        expect(report.chipConservationFailures).toBe(0);
      }
    }
  }, 20_000);
});
