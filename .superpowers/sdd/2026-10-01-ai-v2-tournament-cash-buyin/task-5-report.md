# Task 5 report — cash buy-in UI and responsive integration

## Implemented

- Added `CashBuyInModal` with 25BB/50BB/100BB targets, custom positive-safe-integer validation, affordability/cap checks, pending messaging, and mobile-safe controls.
- Exposed the cash toolbar in the order 暂停 → 买入 → 离开牌桌. Buy-in is omitted for `MINI_TOURNAMENT` and disabled after a leave request or pending reservation.
- Wired the modal to the existing reservation service. The active hand remains unchanged while a request is pending; funds are applied when the next hand is created and pending reservations are cancelled before table cash-out.
- Added the zero-stack settlement choice for cash tables: 重新买入 or 离开牌桌. A confirmed rebuy enables 继续下一手 so the reservation is applied at the next-hand boundary.
- Prevented an initial-game prop from being rehydrated after an intentional leave transition.
- Added desktop/mobile UI tests and updated the prior zero-stack resume assertion.

## Verification

- `npm run typecheck` — passed.
- `npm test -- --run tests/ui/cashBuyIn.test.tsx tests/ui/responsiveCashBuyIn.test.tsx tests/ui/settingsAndResume.test.tsx` — 20 passed.
- `npm test` — 45 files, 244 tests passed.

## Concerns

- The repository uses `src/styles/theme.css` as the active global stylesheet; the modal also has a component stylesheet. There is no existing `src/styles.css` entrypoint.
