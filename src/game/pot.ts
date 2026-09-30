export type Pot = {
  amount: number;
  fromContribution: number;
  toContribution: number;
  contributorPlayerIds: string[];
  eligiblePlayerIds: string[];
};

export type PotAward = {
  playerId: string;
  amount: number;
};

export type SettledPot = Pot & {
  winnerPlayerIds: string[];
  awards: PotAward[];
};
