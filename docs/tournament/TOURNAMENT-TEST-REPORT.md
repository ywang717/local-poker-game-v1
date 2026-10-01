# Tournament simulation report

Generated 2026-10-02 from `runTournamentSimulation`.

- Complete tournaments: 1,000 (500 STANDARD and 500 SHORT_DECK).
- Distribution: table levels 2, 3, 4 and 5 at 125 tournaments per mode/level.
- LV1 smoke: one STANDARD and one SHORT_DECK tournament; both reached a champion.
- Complete hands: 43,876 across the 1,000 reported tournaments.
- Champions: 1,000/1,000; every run ended with exactly one player.
- Rebuys: 0.
- Deadlocks, illegal actions, negative chips, unclaimed pots, refund errors and chip-conservation failures: 0.

The checked-in per-scenario digests and action counters are in [AI-V2-RESULTS.json](../ai-balance/AI-V2-RESULTS.json). Deal and decision random streams are independent and seeded; the simulator throws on a safety limit instead of treating an unfinished tournament as complete.
