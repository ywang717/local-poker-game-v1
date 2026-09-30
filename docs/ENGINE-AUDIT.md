# `@hivetech/poker-engine@1.0.1` audit

Date: 2026-09-30

## Result

The package is a usable **standard Texas Hold'em reference/optional adapter**, but it is not the complete V1.0 engine. The product keeps its own `Card`, `HandEvaluation`, short-deck rules, and settlement contract. The candidate may be wrapped for standard betting transitions only after the adapter tests remain green.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Deterministic complete-deck `start-hand` | PASS | Vitest compatibility test supplies a complete object deck and starts a hand. |
| JSON serializable state | PASS | Compatibility test round-trips the returned table state through JSON. |
| Legal action range and invalid action errors | PASS | `getLegalActions` returns an action range after hand start. |
| Heads-Up button/blind/action order | PASS | Package documents and exposes Heads-Up state; compatibility table starts with two seats. |
| 9-seat table | PASS | Compatibility test creates `maxSeats: 9`. |
| Unequal multi-way All-in side pots | PASS | A direct deterministic smoke run produced a 30-chip main pot and a 20-chip side pot with separate eligible winners. |
| Odd-chip split | REFERENCE ONLY | The package implementation contains clockwise odd-chip allocation, but there is no public direct pot-settlement function. The product will test and own this behavior in `settlement.ts`. |
| Short-deck 36-card rules, A6789, flush over full house | NOT SUPPORTED | The package evaluator exposes standard 52-card ranks/categories only. |
| Career funds, IndexedDB, migrations, AI levels, Chinese UI | NOT SUPPORTED | These are application concerns and are outside the package scope. |

## Decision

Keep the dependency available during early adapter work, but do not let it define the product contract. If browser bundling or state mapping adds risk, remove it and use the local adapter without changing downstream interfaces.
