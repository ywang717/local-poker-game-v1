export type TournamentStatistics = {
  tournamentsPlayed: number;
  tournamentsWon: number;
  totalEntryFees: number;
  totalRewards: number;
  totalNet: number;
  bestFinish: number | null;
};
export function createEmptyTournamentStatistics(): TournamentStatistics {
  return { tournamentsPlayed: 0, tournamentsWon: 0, totalEntryFees: 0, totalRewards: 0, totalNet: 0, bestFinish: null };
}
