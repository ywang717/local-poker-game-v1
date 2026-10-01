# V2 acceptance evidence

Generated 2026-10-02 on the feature branch after the Task 9 release sequence.

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS (55 files, 278 tests) |
| `npm run test:ai` | PASS (15 files, 80 tests) |
| `npm run test:ai:experience` | PASS (13 tests) |
| `npm run test:cash-buyin` | PASS (21 tests) |
| `npm run test:tournament` | PASS (18 tests) |
| `npm run test:simulation` | PASS (4 files, 14 tests; includes 14,000-hand matrix) |
| `npm run build` | PASS |

Task 8 artifacts include the pre-change baseline, deterministic AI V2 numerator/denominator reports, 14-cell rules matrix evidence, 1,000 complete tournaments and the cash buy-in test report. Task 9 adds the release workflow gates, V2 recovery/buy-in/tournament/mobile documentation and release acceptance tests. All checks above completed locally before deployment artifact upload.
