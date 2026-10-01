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

## Review fixes (2026-10-01)

- Added `zeroStackChoice` and `chooseZeroStack` to the game store. A zero-stack settlement no longer exits or invokes bankruptcy when continue is selected; only explicit leave cashes out. Pending rebuy enables the continue action while the choice remains available to the next UI task.
- Expanded validation and street/all-in pending tests, shortage/over-cap/duplicate/zero-stack cases, and IndexedDB recovery for pending, applied, refunded, and repeated operations.
- Kept current hand immutable and synchronized `activeTableStack` at settlement and after next-hand rebuy application.

Verification: `npm run test:cash-buyin` (12 passed), `npm run typecheck`, and full `npm test` (227 passed).

## Test-boundary fixes (2026-10-01)

- Replaced label-only street cases with real GameState fixtures across Preflop, Flop, Turn, River and All-in/settlement. Each test snapshots the current hand and verifies pot/contribution/stack immutability, then applies chips only to a constructed next hand.
- Added career-store leave-boundary coverage proving reservation refund and duplicate cancellation idempotency.
- Added game-store zero-stack choice coverage for confirmed rebuy continuation and explicit leave.

Verification: `npm run test:cash-buyin` (14 passed), `npm run typecheck`, and full `npm test` (229 passed).

## Integration-boundary fixes (2026-10-01)

- Added public store integration fixtures for every street/all-in state. Tests call `requestCashBuyIn`, `applyPendingCashBuyIn`, `syncActiveTableStack`, and `createNextHand`, asserting the stored current hand remains unchanged and only the next hand receives chips.
- Added public `requestLeave` plus career-store cancellation coverage with exactly-once refund semantics.
- Added zero-stack store choice coverage that confirms a pending rebuy produces a positive next-hand stack without bankruptcy, while explicit LEAVE marks the leave path.

Verification: `npm run test:cash-buyin` (20 passed) and `npm run typecheck` passed.

## Production transition boundary fixes (2026-10-01)

- Exported `finishTableExitTransition`, the same cancel-pending -> cash-out ordering used by App, for integration verification.
- Added tests using public store request/leave actions, the real `createNextHand` transition, and the exported production cash-out transition. Zero-stack tests now cover a real rebuy next-hand stack and explicit leave followed by bankruptcy protection.

Verification: `npm run test:cash-buyin` (21 passed) and `npm run typecheck` passed.
