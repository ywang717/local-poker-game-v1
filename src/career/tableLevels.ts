export type TableLevelId = 1 | 2 | 3 | 4 | 5;

export type TableLevel = {
  id: TableLevelId;
  nameZh: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  unlockAt: number;
  aiDifficulty: TableLevelId;
};

export const TABLE_LEVELS: readonly TableLevel[] = [
  { id: 1, nameZh: '新手桌', smallBlind: 25, bigBlind: 50, buyIn: 5_000, unlockAt: 0, aiDifficulty: 1 },
  { id: 2, nameZh: '普通桌', smallBlind: 50, bigBlind: 100, buyIn: 10_000, unlockAt: 15_000, aiDifficulty: 2 },
  { id: 3, nameZh: '进阶桌', smallBlind: 100, bigBlind: 200, buyIn: 20_000, unlockAt: 40_000, aiDifficulty: 3 },
  { id: 4, nameZh: '高手桌', smallBlind: 250, bigBlind: 500, buyIn: 50_000, unlockAt: 100_000, aiDifficulty: 4 },
  { id: 5, nameZh: '高额桌', smallBlind: 500, bigBlind: 1_000, buyIn: 100_000, unlockAt: 250_000, aiDifficulty: 5 },
];

export function getTableLevel(level: TableLevelId | number): TableLevel {
  const result = TABLE_LEVELS.find((entry) => entry.id === level);
  if (!result) throw new Error(`Unknown table level ${level}`);
  return result;
}
