# V2.2 AI response, personality, and persistence optimization

> **For the implementer:** Execute this plan task by task. Keep each change small, write a regression first, run it red, then implement and rerun the focused test before moving on.

**Goal:** Make Facing Open/3-Bet/Jam decisions produce natural Fold/Call/Raise structures with stable positions and personalities, while making cash buy-in transitions atomic and keeping full simulations out of default CI.

**Architecture:** Reuse `PublicTableContext`, `positionForDetailed`, existing preflop/postflop strategy modules, `saveCareerAndHandSnapshot`, and the existing game/career stores. Add only public fields and coordinator methods required for deterministic tests and persistence ordering.

**Global constraints:** No hidden cards, future board, deck order, engine rewrite, side-pot rewrite, settlement rewrite, or large default CI simulation. Use deterministic tests and the existing 800 AI / 600 rules / 20 tournament smoke.

**Review focus:** Position source of truth, current aggressor and relevant effective stack, short-jam classification, intent-to-legal-action mapping, personality boundaries, transaction idempotency, queue ordering, and test command separation.

## Task 1: Baseline and test partition

**Files:** `package.json`, `tests/release/*`, `tests/simulation/continuousSimulation.test.ts`, `docs/release/V2.2-ACCEPTANCE.md`

- Record the pre-change typecheck, unit test, and build baseline.
- Add explicit default-test excludes for full simulation and release smoke.
- Add `test:simulation:full`; keep `test:simulation:smoke` as the only release smoke entry point.
- Add a command-level regression proving the default test set excludes full/release files.

## Task 2: Canonical positions and classification

**Files:** `src/ai/positionStrategy.ts`, `src/ai/publicContext.ts`, `src/ai/preflopStrategy.ts`, `src/ai/aiEngine.ts`, `tests/ai/v22PositionAndClassification.test.ts`

- Add fixed-seat heads-up role flags and expose canonical detailed positions in public context.
- Remove duplicate AI seat-to-position mapping.
- Track opener/current aggressor, full raise count, jam type, caller count, and current price.
- Calculate effective stack against the relevant aggressor; do not use unrelated short stacks.
- Add deterministic tests for 2/3/4/5/6/8/9 players, folds, opener matchups, short all-ins, and effective stack cases.

## Task 3: Preflop response tree

**Files:** `src/ai/aiEngine.ts`, `src/ai/preflopStrategy.ts`, `src/ai/raiseStrategy.ts`, `src/ai/jamStrategy.ts`, `tests/ai/v22PreflopResponse.test.ts`, `tests/ai/v22JamResponse.test.ts`

- Remove the fixed `toCall <= pot * 0.5` call gate.
- Add position/open-size/caller-count aware Fold/Call/3-Bet and squeeze decisions.
- Split medium hands between call and 3-bet; preserve premium value raises and trash folds.
- Add explicit facing-3-bet Fold/Call/4-bet responses.
- Classify jam type and stack bucket; tighten deep-stack calls and preserve short-stack defense.
- Map strategy intent through legal actions without silently turning illegal raises into calls.
- Add fixed hand matrices and multi-seed tests for HJ/CO/BTN, blinds, multiway, and jam depths.

## Task 4: Personality and notation

**Files:** `src/ai/aiEngine.ts`, `src/ai/postflopStrategyV2.ts`, `src/ai/preflopRanges.ts`, `src/ai/turn.ts`, `tests/ai/v22Personality.test.ts`, `tests/ai/v22Notation.test.ts`

- Apply personality only to marginal call/raise/bluff/check-raise thresholds and frequencies.
- Pass personality through postflop decisions without modifying equity/pot odds/SPR.
- Ensure strong value remains stable and air does not call large bets merely because of CALLING.
- Standardize rank notation to `T` while preserving numeric ranks.
- Add multi-seed directional tests and hidden-information checks.

## Task 5: Cash buy-in atomic persistence

**Files:** `src/store/gameStore.ts`, `src/store/careerStore.ts`, `src/career/cashBuyInTransition.ts`, `src/storage/saveSystem.ts`, `src/App.tsx`, `tests/storage/v22CashTransition.test.ts`, `tests/career/v22CashBuyInPersistence.test.ts`

- Expose a persistence-queue flush and an in-memory game update that does not enqueue an independent snapshot.
- Route settlement → prepare → flush → atomic career/game save → in-memory update through one coordinator.
- Preserve settlement state on save failure for retry.
- Make Apply/Cancel transaction-ID idempotent and verify reload does not reapply.
- Add queue-race, retry, pending, applied, refunded, and duplicate-call regressions.

## Task 6: Targeted release smoke and documentation

**Files:** `tests/ai/*`, `tests/career/*`, `tests/tournament/*`, `tests/simulation/*`, `tests/release/*`, `.github/workflows/deploy-pages.yml`, `docs/release/V2.2-ACCEPTANCE.md`

- Add position-size, preflop response, personality, jam, legal-action, notation, and persistence regressions.
- Keep the existing 800 AI, 600 rules, and 20 tournament smoke counts; ensure each runs once.
- Update CI to run typecheck, default tests, targeted suites, smoke once, and build; never full simulation.
- Run focused suites, smoke, typecheck, build, and deploy; report every unrun check as `NOT RUN`.
