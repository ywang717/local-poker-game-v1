
# Final whole-branch review fix wave

## Scope

Applied the two Important findings from `final-review.md` on 2026-10-02 in the
`local-poker-game-v2` checkout. No push, merge, publish, or deployment action
was performed.

## Cash financial ledger (I1)

- `careerService.buyIn` now creates a stable cash session identity, stores it
  on the career while seated, and appends one idempotent
  `INITIAL_BUY_IN` transaction (`<sessionId>:initial-buy-in`) for the exact
  buy-in amount. The App passes that identity into the created cash table.
- `careerService.leaveTable` now appends one idempotent `TABLE_CASH_OUT`
  transaction (`<sessionId>:table-cash-out`) for the settled table stack before
  clearing the active seat. It accepts the table session identity at the
  production exit boundary and avoids crediting funds twice if the same
  transaction is retried.
- `cashBuyInService.applyPendingCashBuyIn` and
  `cancelPendingCashBuyIn` now append a stable `BUY_IN_REFUND` transaction
  (`<pendingTransactionId>:refund`) for every positive excess or cancellation
  refund. Existing `TOP_UP` status transitions and balance arithmetic remain
  compatible and repeated apply/cancel calls remain idempotent.
- The lower-level `transactions.refundPendingCashBuyIn` path records the same
  refund ledger entry, so no supported refund boundary mutates funds silently.
- V2 career migration defaults the new active session marker to `null`, while
  existing balances and legacy snapshots remain readable.

## Tournament champion guard (I2)

- `finishTournament` now requires exactly one live player and only accepts a
  persisted `championId` when it matches that sole player. A stale champion ID
  or a multi-player snapshot is rejected before champion state or reward
  mutation.

## Regression coverage

- Career service tests verify initial buy-in and table cash-out ledger records,
  stable session IDs, and retry-safe cash-out balance behavior.
- Cash buy-in tests verify excess and cancellation refund transaction records.
- The mounted table-exit recovery test verifies production exit writes both
  initial buy-in and table cash-out transactions.
- Tournament settlement tests verify a preset champion cannot finalize while
  multiple players remain.

## Verification

- `npm run typecheck` — PASS
- `npm test -- --run` — PASS (55 files, 279 tests)
- `npm run test:ai` — PASS (15 files, 80 tests)
- `npm run test:ai:experience` — PASS (13 tests)
- `npm run test:cash-buyin` — PASS (21 tests)
- `npm run test:tournament` — PASS (19 tests)
- `npm run test:simulation` — PASS (14 tests, including the 14,000-hand matrix)
- `npm run build` — PASS
- `git diff --check` — PASS
