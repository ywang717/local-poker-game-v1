# Task 7 report — Mini tournament career flow

## Status

Implemented. Tournament entry, six-player navigation, tournament information/result screens, snapshot recovery, spectator continuation, and idempotent career reward accounting are integrated with the existing cash flow.

## Changes

- Added `TournamentSelectPage`, `TournamentResultPage`, and `TournamentInfo`.
- Added `CareerState.recordedTournamentIds` and tournament entry/reward transaction handling.
- Added `enterTournament` and `recordTournamentFinish` service/store APIs; entry fees and champion rewards are ledgered exactly once and remain separate from cash hand statistics.
- Added `GameState.tournamentState` persistence, migration defaults for old career records, and tournament continuation in `App`.
- Tournament hand transitions use the pure engine's current blinds, eliminations, rankings, spectator state, and reward guard. `GamePage` displays tournament information and never renders cash buy-in controls for `MINI_TOURNAMENT`.

## Tests

- `tests/ui/tournamentFlow.test.tsx`
- `tests/storage/tournamentRecovery.test.ts`
- `tests/career/tournamentStatistics.test.ts`
- RED run confirmed the missing service and page APIs before implementation.

## Verification

- `npm run typecheck` — passed.
- `npm test -- --run` — 52 files, 266 tests passed.
- `npm run build` — passed.
- `git diff --check` — passed.

## Original concern resolved

- Paid tournament leaves now record a forfeit result before clearing the active snapshot.

## Review fixes

- Explicit tournament IDs now reject reuse at both the career service and
  Zustand store boundary before creating a second playable session.
- Leaving a paid tournament now creates a deterministic non-champion forfeit
  rank, records tournament statistics exactly once, shows the result screen,
  and clears the hand snapshot without issuing a champion reward. This applies
  both to settlement leaves and to an in-hand leave request after settlement.
- Added mounted App entry/leave/reload tests, duplicate-ID store coverage, and
  migration assertions for recorded IDs plus tournament reward/blind state.

## Review-fix verification

- `npm test -- --run` — 52 files, 270 tests passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.
