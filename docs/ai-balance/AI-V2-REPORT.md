# AI V2 experience and tournament report

Generated 2026-10-02 from deterministic complete-hand simulations. The pre-change reference remains [BASELINE.md](./BASELINE.md).

## AI experience matrix

- STANDARD and SHORT_DECK, six seats, LV2 through LV5.
- 10,000 complete hands per scenario (80,000 total).
- Deal and decision streams use independent seeded generators.
- [AI-V2-CASES.csv](./AI-V2-CASES.csv) records numerator and denominator for every metric.

## Rules matrix

The preserved release matrix contains 14 mode/table-size cells and 14,000 complete hands. It recorded 53,998 folds, 14,774 calls, 32,295 raises and 525 all-ins. Per-cell digests are in [AI-V2-RESULTS.json](./AI-V2-RESULTS.json).

## Tournament matrix

The report contains 1,000 complete tournaments: 500 STANDARD and 500 SHORT_DECK, with LV2-LV5 evenly distributed (125 each per mode), plus one LV1 smoke tournament per mode. Every run reached exactly one champion with zero deadlocks, illegal actions, negative chips, unclaimed pots, refund errors, chip-conservation failures and rebuys.

## Reproduction

Run npm run test:ai:experience, npm run test:tournament and npm run test:simulation. The checked-in JSON and CSV use stable key and row ordering.
