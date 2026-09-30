import type { GameState } from '../game/gameState';
import type { CareerState } from '../career/careerState';

export const CURRENT_SAVE_VERSION = 2 as const;

export type VersionedSave = {
  saveVersion: typeof CURRENT_SAVE_VERSION;
  career: CareerState;
};

export type HandSnapshot = {
  saveVersion: number;
  savedAt: string;
  state: GameState;
};

export type CareerLoadStatus = 'empty' | 'loaded' | 'recovered' | 'corrupt';

export type LoadResult = {
  status: CareerLoadStatus;
  career: CareerState | null;
  restoredFromBackup: boolean;
  error?: string;
};
