# Task 4 report

Implemented the cash-table buy-in service and career synchronization.

- Added validated 25BB/50BB/100BB and custom target options.
- Added idempotent reservation, next-hand application, cap/refund, cancellation and active-stack synchronization APIs.
- Persisted pending/applied/refunded ledger state through the existing career save/migration path.
- Wired settlement/next-hand flow to apply pending funds only after the current hand settles and to cancel pending reservations when leaving.
- Added focused career conservation and IndexedDB recovery tests.

Verification:

- `npm run test:cash-buyin` — 5 tests passed.
- `npm run typecheck` — passed.
- Existing transaction, career and session metadata tests — 9 tests passed.

Known integration boundary: the dedicated buy-in UI/zero-stack choice screen is owned by the follow-up UI task; the service and next-hand path support a zero-stack rebuy when the user confirms one.
