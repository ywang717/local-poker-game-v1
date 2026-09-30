# AI V2 pre-change baseline

This baseline was captured before any Task 3 decision-branch changes. It uses
the existing `chooseAction` engine through the new complete-hand harness.

## Configuration

- Command: `./node_modules/.bin/vite-node scripts/aiBaseline.ts`
- Mode: `STANDARD`
- Table: 6 occupied seats
- Hands: 10,000 complete hands
- Difficulty: 3
- Seed: `0x20261001` (`539365377`)
- Starting stack: 1,000; blinds: 5/10
- Deal and decision randomness: the existing seeded stream

## Completion and safety counters

| Counter | Value |
| --- | ---: |
| Hands completed / requested | 10,000 / 10,000 |
| Actions | 192,551 |
| Folds | 16,565 |
| Calls | 70,264 |
| Raises or bets | 77,065 |
| All-ins | 17,081 |
| Showdowns | 10,000 |
| Deadlocks | 0 |
| Illegal actions | 0 |
| Negative chip states | 0 |
| Unclaimed pots | 0 |
| Refund errors | 0 |
| Chip conservation failures | 0 |
| Rebuys | 22,723 |
| Maximum side pots | 5 |
| Maximum actions in one hand | 35 |
| Deterministic digest | `58c9c800` |

## Numerator / denominator metrics

| Metric | Numerator | Denominator |
| --- | ---: | ---: |
| VPIP | 127,645 | 141,825 |
| PFR | 71,328 | 141,825 |
| 3-Bet | 8,489 | 17,057 |
| 4-Bet | 32,822 | 60,162 |
| Fold to 3-Bet | 1,141 | 17,057 |
| C-Bet | 0 | 0 |
| Check-Raise | 0 | 0 |
| Active all-in | 17,081 | 192,551 |
| Call all-in | 10,623 | 70,264 |
| Pre-flop all-in | 12,213 | 141,825 |
| Post-flop all-in | 4,868 | 50,726 |
| Average pot sum / action samples | 1,553,215,704 | 192,551 |
| Raise sizing sum / raise samples | 471,823,415 | 77,065 |
| Showdown | 10,000 | 10,000 |
| Actions | 192,551 | 192,551 |

The zero C-Bet and Check-Raise denominators are intentional in this minimal
baseline harness; Task 8 adds board-texture and post-flop event accounting.
