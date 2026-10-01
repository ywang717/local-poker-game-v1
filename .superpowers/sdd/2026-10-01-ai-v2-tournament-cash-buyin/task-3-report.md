# Task 3 report — AI V2 decisions, sizing, All-in gates, and experience checks

## Status

Implemented and verified. The existing four argument `chooseAction` call remains
valid; the fifth argument is optional `DecisionOptions`.

## Files changed

- Added `src/ai/raiseStrategy.ts`: deterministic Raise To targets for opens,
  3-Bets, 4-Bets and post-flop value/bluff actions, with legal clamp helper.
- Added `src/ai/jamStrategy.ts`: explicit Open Jam, 3-Bet Jam, 4-Bet Jam,
  reshove/call-jam and post-flop All-in gates. Deep stacks cannot fall through
  to an All-in.
- Added `src/ai/postflopStrategyV2.ts`: board texture, draw potential, pot
  odds, SPR, prior aggressor and opponent count decisions. Levels 4 and 5 use
  a deterministic bounded 32/64-sample equity probe; lower levels use zero
  simulation samples.
- Added `src/ai/experienceMetrics.ts`: explicit numerator/denominator pairs
  for VPIP, PFR, 3-Bet, 4-Bet, Fold to 3-Bet, C-Bet, Check-Raise, All-in
  counters, pot, sizing, showdown and action counters.
- Modified `src/ai/aiEngine.ts`: situation-specific Open/Facing Open/Facing
  3-Bet/Facing 4-Bet branches, independent value/bluff/call/fold handling,
  deterministic sizing, legal-action clamping, short-all-in call handling,
  bounded personality adjustment, and optional tournament context.
- Modified `src/ai/turn.ts`: uses explicit session/table level difficulty when
  present; blind size is only a legacy snapshot fallback. Tournament context is
  passed explicitly.
- Modified `src/ai/difficulty.ts`, `personalities.ts`, and
  `decisionFeatures.ts` for bounded adjustments and fixed LV4/LV5 budgets.
- Added `test:ai` and `test:ai:experience` npm scripts.
- Modified `src/game/settlement.ts` to award a folded contribution layer to a
  sole short-all-in survivor instead of producing an unclaimable side pot.
  Added a focused regression test in `tests/game/settlement.test.ts`.
- Added deterministic tests under `tests/ai/` for raise targets, jam gates,
  post-flop decisions, experience pairs, and the BTN-versus-UTG 72o case.

## Commands and output

- Initial requested Task 3 test run before implementation:
  `npm test -- --run tests/ai/raiseStrategy.test.ts tests/ai/jamStrategy.test.ts tests/ai/postflopStrategyV2.test.ts tests/ai/experienceMetrics.test.ts tests/ai/aiV2Cases.test.ts`
  — failed because all five requested test files/modules were absent; the
  existing engine also raised 72o as the regression case.
- `npm run test:ai` — 15 files passed, 59 tests passed.
- `npm run test:ai:experience` — 2 files passed, 8 tests passed.
- `npm run typecheck` — passed.
- `npm test -- --run` — 40 files passed, 194 tests passed.
- `npm test -- --run tests/game/settlement.test.ts` — 12 tests passed,
  including the short-all-in settlement regression.

## Complete-hand experience checks

Each scenario ran 10,000 complete hands with a deterministic seed. No deadlock,
illegal action, chip-conservation, unclaimed-pot, refund, or negative-chip
counter occurred. The preserved pre-change baseline file was not modified.

| Mode | Level | Actions | Folds | Calls | Raises | All-ins | Digest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| STANDARD | 2 | 63,845 | 49,130 | 2,349 | 11,012 | 60 | `1ac6dc45` |
| STANDARD | 3 | 64,591 | 49,065 | 2,586 | 11,442 | 72 | `5ab5a52a` |
| STANDARD | 4 | 64,566 | 49,088 | 2,432 | 11,572 | 63 | `45eff198` |
| STANDARD | 5 | 65,232 | 49,004 | 2,626 | 11,967 | 76 | `e5db28ac` |
| SHORT_DECK | 2 | 82,609 | 46,369 | 9,756 | 22,334 | 429 | `f6725d55` |
| SHORT_DECK | 3 | 82,246 | 46,476 | 9,507 | 22,248 | 415 | `fa80c886` |
| SHORT_DECK | 4 | 82,774 | 46,436 | 9,715 | 22,707 | 431 | `a38abf95` |
| SHORT_DECK | 5 | 82,983 | 46,437 | 9,723 | 22,778 | 405 | `9a28d1fb` |

The corrected preserved LV3 STANDARD baseline remains in
`docs/ai-balance/BASELINE.md` (59,977 VPIP/PFR opportunities, PFR
34,049/59,977, 3-Bet 9,015/16,814, 4-Bet 8,457/17,057, digest `58c9c800`).
The new strategy has materially fewer total actions and folds more often in
STANDARD because weak facing-open hands now fold rather than entering legacy
strength-only aggression. SHORT_DECK remains wider and more active because its
range/hand evaluator intentionally rewards connected hands and flushes.

## Deterministic decision behavior

- AA/KK/QQ/JJ and AKs/AQs value 3-Bet facing an open when legal.
- A5s is a bounded late-position bluff candidate; it is not forced into every
  3-Bet opportunity.
- 87o and 72o fold against a UTG open, including the BTN-versus-UTG case;
  72o is not a routine 3-Bet.
- Facing a 3-Bet uses an independent 4-Bet branch; it does not reuse open
  logic. Facing 4-Bet-plus and short all-ins preserve legal call behavior.
- All-in requires an explicit jam decision and stack/range gate. Final Raise To
  amounts are clamped to the supplied legal action range.

## Concerns

- The existing minimal experience harness still reports C-Bet and Check-Raise
  as 0/0 because it does not yet pass complete post-flop event metadata; the
  new `experienceMetrics.ts` recorder supports those event boundaries for the
  later expanded harness.
- The short-all-in settlement fallback is a narrowly scoped rules correction
  discovered by the requested 10,000-hand SHORT_DECK checks. It applies only
  when a contribution layer has no eligible contributor and exactly one live
  player remains.
- The scenario table is an experience comparison, not a gameplay quality
  claim. Further balancing can tune ranges while keeping the explicit gates
  and baseline artifacts intact.

## Review fixes

The first review identified six behavior gaps. They were corrected in the
follow-up commit:

- Free pre-flop actions now prefer `check` before `fold`; a BB 72o regression
  test covers this path.
- `matchType`, tournament pressure, effective stack, blind stage and remaining
  players are consumed through `DecisionOptions`. Session-only tournament
  metadata resolves before the legacy blind fallback; tournaments without a
  stored level use the explicit neutral level 3 fallback.
- Pre-flop branches now read Task 2 weighted ranges, opener position and
  situation. LV2-LV5 therefore produce distinct range widths. A5s-style
  bounded 3-Bet and 4-Bet bluff branches are covered by the matrix tests.
- LV4/LV5 post-flop analysis now samples actual public runouts and a sampled
  opponent holding from the selected deck (maximum 32/64 samples). Estimated
  equity and board texture affect the action; no hidden opponent cards are read.
- Experience counters now use player-hand VPIP/PFR event keys, distinguish
  called All-ins from aggressive All-ins, count C-Bet only on the first
  post-flop action after the AI's pre-flop aggression, and count Check-Raise
  only after the AI check and a later opponent bet. Showdown recording is
  explicit via `recordExperienceShowdown`; the older Task 8 harness remains
  intentionally separate.
- `aiV2Cases.test.ts` now covers AA/KK/QQ/JJ/AKs/AQs/A5s/87o/72o, CO/BTN/BB,
  4-Bet, effective-stack and deep-stack gates, free BB checks, tournament
  pressure, and legal action behavior.

### Review-fix verification

- `npm test -- --run tests/ai/aiV2Cases.test.ts tests/ai/postflopStrategyV2.test.ts tests/ai/experienceMetrics.test.ts` — 3 files, 25 tests passed.
- `npm run typecheck` — passed.
- `npm test -- --run` — 40 files, 210 tests passed.
- Representative real-runout simulations: STANDARD LV2/LV4/LV5 and SHORT_DECK
  LV2/LV4/LV5, 1,000 complete hands each; all six runs completed with zero
  deadlocks, illegal actions, negative chips, unclaimed pots, refund errors,
  or chip-conservation failures. Digests: `9b17cdba`, `8feb2320`, `0dd3f7e5`,
  `60493447`, `be3b795d`, `5a751404`.
