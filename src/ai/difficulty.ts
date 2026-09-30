export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
export type AIDifficulty = (typeof DIFFICULTY_LEVELS)[number];

export type DifficultyProfile = {
  level: AIDifficulty;
  quality: number;
  looseness: number;
  aggression: number;
  bluffFrequency: number;
  positionWeight: number;
  modelWeight: number;
  valueThreshold: number;
  callThreshold: number;
  foldThreshold: number;
};

const profiles: Readonly<Record<AIDifficulty, DifficultyProfile>> = {
  1: { level: 1, quality: 0.2, looseness: 0.02, aggression: 0.18, bluffFrequency: 0.02, positionWeight: 0.04, modelWeight: 0, valueThreshold: 0.78, callThreshold: 0.45, foldThreshold: 0.24 },
  2: { level: 2, quality: 0.4, looseness: 0.05, aggression: 0.3, bluffFrequency: 0.06, positionWeight: 0.1, modelWeight: 0.04, valueThreshold: 0.72, callThreshold: 0.4, foldThreshold: 0.22 },
  3: { level: 3, quality: 0.6, looseness: 0.08, aggression: 0.42, bluffFrequency: 0.1, positionWeight: 0.16, modelWeight: 0.1, valueThreshold: 0.67, callThreshold: 0.36, foldThreshold: 0.2 },
  4: { level: 4, quality: 0.8, looseness: 0.1, aggression: 0.53, bluffFrequency: 0.14, positionWeight: 0.2, modelWeight: 0.18, valueThreshold: 0.62, callThreshold: 0.33, foldThreshold: 0.18 },
  5: { level: 5, quality: 1, looseness: 0.12, aggression: 0.64, bluffFrequency: 0.18, positionWeight: 0.24, modelWeight: 0.24, valueThreshold: 0.58, callThreshold: 0.3, foldThreshold: 0.16 },
};

export function getDifficultyProfile(level: AIDifficulty): DifficultyProfile {
  return { ...profiles[level] };
}
