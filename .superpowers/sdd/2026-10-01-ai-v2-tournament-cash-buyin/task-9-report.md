# Task 9 report — CI gate, final acceptance and release

## Status

Implemented and verified locally on 2026-10-02. The feature branch is ready
for review; nothing was pushed, merged, or published.

## Changes

- Added `tests/release/v2Acceptance.test.ts` covering every required npm gate,
  `CURRENT_SAVE_VERSION` 2, tournament rendering without the cash buy-in
  control, and the checked-in release reports.
- Expanded `tests/pwa/pwaAssets.test.ts` to require every release command in
  the Pages workflow.
- Updated `.github/workflows/deploy-pages.yml` so dependency installation,
  typecheck, full tests, AI, AI experience, cash buy-in, tournament,
  simulation, and build gates all finish before artifact upload and deploy.
- Documented V2 recovery, save migration, cash buy-in limits and pending
  behavior, tournament entry and forfeit behavior, and mobile use in
  `README.md`.
- Refreshed `docs/release/V2-ACCEPTANCE.md` with completed build evidence and
  the actual post-test counts (55 files, 278 tests; simulation 14 tests).

## Verification

The complete requested sequence passed:

- `npm ci` — passed (427 packages installed)
- `npm run typecheck` — passed
- `npm test` — 55 files, 278 tests passed
- `npm run test:ai` — 15 files, 80 tests passed
- `npm run test:ai:experience` — 2 files, 13 tests passed
- `npm run test:cash-buyin` — 3 files, 21 tests passed
- `npm run test:tournament` — 5 files, 18 tests passed
- `npm run test:simulation` — 4 files, 14 tests passed, including the
  14,000-hand matrix
- `npm run build` — passed; Vite generated the PWA bundle
- `git diff --check` — passed

No existing test file was deleted or weakened. The release test is additive,
and the PWA assertion now checks all named workflow gates.

## Concerns

`npm ci` reports three existing dependency audit findings (one moderate, one
high, and one critical). They do not affect the release gate exit status and
were not changed in this task.
