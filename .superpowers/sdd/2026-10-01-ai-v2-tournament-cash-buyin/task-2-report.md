# Task 2 report — AI V2 context, position, and pre-flop primitives

## Status

Implemented and verified. The existing `chooseAction` decision branches were
left unchanged for Task 3.

## Files changed

- Added `src/ai/positionStrategy.ts` with fixed occupied-seat mapping,
  `DetailedPosition`, and `positionForDetailed`.
- Added `src/ai/preflopStrategy.ts` with `PreflopSituation`, public-history
  classification, standard 169 / short-deck 81 hand-class normalization, and
  deterministic weighted ranges.
- Added `src/ai/opponentModel.ts` with explicit 3-Bet/4-Bet/fold-to-3-Bet and
  sizing observations plus minimum-sample defaults.
- Added `src/simulation/aiExperienceSimulation.ts` and
  `scripts/aiBaseline.ts` for the minimal complete-hand baseline harness.
- Modified `src/ai/publicContext.ts` to expose the detailed fixed position while
  retaining the coarse `position` field used by the current engine.
- Modified `src/ai/preflopRanges.ts` with detailed-position adjustments while
  retaining legacy labels.
- Modified `src/ai/playerModel.ts` with 4-Bet, fold-to-3-Bet, sizing, and
  explicit-observation counters. Saved hand history no longer infers 3-Bet from
  an arbitrary raise.
- Modified `src/game/gameState.ts` and `src/game/gameEngine.ts` with additive
  initial occupied-seat and optional action metadata fields.
- Added table-driven tests in `tests/ai/positionStrategy.test.ts`,
  `tests/ai/preflopStrategy.test.ts`, `tests/ai/opponentModel.test.ts`, and
  `tests/ai/experienceSimulation.test.ts`; extended
  `tests/ai/informationBoundary.test.ts`.
- Added `docs/ai-balance/BASELINE.md` with the pre-change run.

## Commands and output

- Targeted red run before implementation:
  `npm test -- --run tests/ai/preflopStrategy.test.ts tests/ai/positionStrategy.test.ts tests/ai/opponentModel.test.ts tests/ai/experienceSimulation.test.ts`
  — failed in four suites because the new modules did not exist.
- Targeted green run:
  same command — 4 files passed, 12 tests passed.
- AI/full regression:
  `npm test -- --run` — 35 files passed, 176 tests passed.
- Typecheck: `npm run typecheck` — passed.
- Production build: `npm run build` — passed; Vite generated the PWA bundle.

## Pre-change baseline

Command: `./node_modules/.bin/vite-node scripts/aiBaseline.ts`

- Configuration: STANDARD, 6 seats, difficulty 3, 10,000 hands, seed
  `0x20261001` (`539365377`), 1,000 starting stacks, 5/10 blinds.
- Completion: 10,000 / 10,000 hands, 192,551 actions, 10,000 showdowns.
- Safety: deadlocks 0, illegal actions 0, negative chip states 0, unclaimed
  pots 0, refund errors 0, chip-conservation failures 0.
- Action counters: folds 16,565; calls 70,264; raises/bets 77,065; all-ins
  17,081; maximum side pots 5; maximum hand actions 35; rebuys 22,723.
- Deterministic digest: `58c9c800`.
- Full numerator/denominator counters are preserved in
  `docs/ai-balance/BASELINE.md`.

## Concerns

- The baseline harness intentionally reports C-Bet and Check-Raise as 0/0;
  Task 8 owns board-texture and post-flop event accounting.
- The coarse `PublicTableContext.position` remains for Task 3 compatibility;
  V2 consumers should use `detailedPosition` or `positionForDetailed`.
- The optional initial-seat field is additive for old snapshots. If a future
  table implementation removes players from `state.players`, it must preserve
  `initialOccupiedSeats` when constructing the next hand.

## Commit

Commit: `b28c8a5` — `feat: add ai v2 context and range primitives`
