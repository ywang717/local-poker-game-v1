# Task 6 review fixes

## Status

Implemented in the review-fix commit recorded in git history.

## Fixes

- Champion rewards now equal exactly `entryFee * 10`, with a regression test.
- Omitted tournament IDs use a unique UUID or monotonic fallback; explicit IDs
  remain unchanged for deterministic simulations and seeded runs.
- Human IDs reserved by the five AI participants (`ai-1` through `ai-5`) are
  rejected before state creation, preventing duplicate participant and reward
  identities.

## Verification

- `npm run test:tournament` — passed.
- `npm run typecheck` — passed.
- `npm test -- --run` — passed.

