import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyRiverHand } from '../src/ai/riverHandQuality';
import { runContinuousTableSimulation } from '../src/simulation/runSimulation';
import type { AIDifficulty } from '../src/ai/difficulty';
import type { GameMode } from '../src/game/rules';

const seedBase = 0x20261008;
const modes: readonly GameMode[] = ['STANDARD', 'SHORT_DECK'];
const difficulties: readonly AIDifficulty[] = [1, 2, 3, 4, 5];
const categories = ['AIR', 'BOARD_ONLY_PAIR', 'BOARD_ONLY_HAND', 'WEAK_PAIR', 'MIDDLE_PAIR', 'TOP_PAIR_WEAK_KICKER', 'TOP_PAIR_GOOD_KICKER', 'OVERPAIR', 'TWO_PAIR_PLUS'] as const;
const rows: Array<Record<string, unknown>> = [];
let cell = 0;

for (const mode of modes) {
  for (const difficulty of difficulties) {
    const river: Record<string, { fold: number; call: number; allInCall: number; raise: number; allInRaise: number; other: number }> = Object.fromEntries(
      categories.map((category) => [category, { fold: 0, call: 0, allInCall: 0, raise: 0, allInRaise: 0, other: 0 }]),
    );
    let opportunities = 0;
    const seed = seedBase + cell * 0x10001;
    const report = runContinuousTableSimulation({
      mode, tableSize: 6, hands: 10_000, seed, difficulty,
      dealSeed: (seed ^ 0x9e3779b9) >>> 0,
      decisionSeed: (seed ^ 0x243f6a88) >>> 0,
      onAction(context, action) {
        if (context.street !== 'RIVER' || context.toCall <= 0) return;
        opportunities += 1;
        const quality = classifyRiverHand(context.self.holeCards, context.communityCards, mode);
        const counts = river[quality];
        if (action.kind === 'fold') counts.fold += 1;
        else if (action.kind === 'call' && context.self.stack <= context.toCall) counts.allInCall += 1;
        else if (action.kind === 'call') counts.call += 1;
        else if (action.kind === 'raise-to' || action.kind === 'bet-to') counts.raise += 1;
        else if (action.kind === 'all-in' && context.self.stack <= context.toCall) counts.allInCall += 1;
        else if (action.kind === 'all-in') counts.allInRaise += 1;
        else counts.other += 1;
      },
    });
    const errors = {
      deadlocks: report.deadlocks,
      illegalActions: report.illegalActions,
      negativeChipStates: report.negativeChipStates,
      unclaimedPots: report.unclaimedPots,
      refundErrors: report.refundErrors,
      chipConservationFailures: report.chipConservationFailures,
    };
    if (report.handsCompleted !== 10_000 || Object.values(errors).some((value) => value !== 0)) {
      throw new Error(`${mode} LV${difficulty} failed: ${JSON.stringify({ handsCompleted: report.handsCompleted, errors })}`);
    }
    const row = { mode, difficulty, tableSize: 6, hands: report.handsCompleted, seed, riverOpportunities: opportunities, river, errors, digest: report.digest };
    rows.push(row);
    console.log(JSON.stringify(row));
    cell += 1;
  }
}

const output = {
  seedBase,
  seedScheme: 'cellSeed = seedBase + cellIndex * 0x10001; dealSeed = cellSeed XOR 0x9e3779b9; decisionSeed = cellSeed XOR 0x243f6a88',
  totalHands: rows.reduce((sum, row) => sum + Number(row.hands), 0),
  totalRiverOpportunities: rows.reduce((sum, row) => sum + Number(row.riverOpportunities), 0),
  rows,
};
const reportPath = fileURLToPath(new URL('../docs/ai-balance/RIVER-CALLING-REPORT.json', import.meta.url));
writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`WROTE ${reportPath}`);
