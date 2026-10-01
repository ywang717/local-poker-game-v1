import { getTableLevel, type TableLevelId } from '../career/tableLevels';

export type BlindStructureLevel = {
  level: number;
  smallBlind: number;
  bigBlind: number;
};
export type BlindLevel = BlindStructureLevel;

/** Multipliers preserve the selected entry-level blinds while increasing pressure. */
const STAGE_MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128] as const;

export function getBlindStructure(tableLevel: TableLevelId, blindLevel = 1): BlindStructureLevel {
  if (!Number.isSafeInteger(blindLevel) || blindLevel < 1) throw new Error('blindLevel must be a positive integer');
  const base = getTableLevel(tableLevel);
  const multiplier = STAGE_MULTIPLIERS[blindLevel - 1] ?? 2 ** (blindLevel - 1);
  return { level: blindLevel, smallBlind: base.smallBlind * multiplier, bigBlind: base.bigBlind * multiplier };
}

export const blindStructureFor = getBlindStructure;
export const getBlindsForLevel = getBlindStructure;

export const BLIND_SCHEDULES: Readonly<Record<TableLevelId, readonly BlindStructureLevel[]>> = {
  1: STAGE_MULTIPLIERS.map((_, index) => getBlindStructure(1, index + 1)),
  2: STAGE_MULTIPLIERS.map((_, index) => getBlindStructure(2, index + 1)),
  3: STAGE_MULTIPLIERS.map((_, index) => getBlindStructure(3, index + 1)),
  4: STAGE_MULTIPLIERS.map((_, index) => getBlindStructure(4, index + 1)),
  5: STAGE_MULTIPLIERS.map((_, index) => getBlindStructure(5, index + 1)),
};
export const TOURNAMENT_BLIND_SCHEDULES = BLIND_SCHEDULES;
