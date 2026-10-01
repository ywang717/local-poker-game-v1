# V2 acceptance evidence

Generated 2026-10-02 on the feature branch after Task 8.

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS (54 files, 274 tests) |
| `npm run test:ai:experience` | PASS (13 tests) |
| `npm run test:cash-buyin` | PASS (21 tests) |
| `npm run test:tournament` | PASS (18 tests) |
| `npm run test:simulation` | PASS (10 tests; includes 14,000-hand matrix) |
| `npm run build` | pending final release gate |

Task 8 artifacts include the pre-change baseline, deterministic AI V2 numerator/denominator reports, 14-cell rules matrix evidence, 1,000 complete tournaments and the cash buy-in test report. The final release workflow remains responsible for running the full build gate.
