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
| VPIP | 47,342 | 59,977 |
| PFR | 34,049 | 59,977 |
| 3-Bet | 9,015 | 16,814 |
| 4-Bet | 8,457 | 17,057 |
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

VPIP and PFR denominators count one pre-flop decision opportunity per player
per hand. 3-Bet and 4-Bet denominators count decisions facing the prior full
raise level; the action is classified before it is appended to the history.

All-in calls and short all-in raises remain VPIP events but are excluded from
PFR/3-Bet/4-Bet numerators unless the resulting contribution reaches the full
raise threshold. The zero C-Bet and Check-Raise denominators are intentional in this minimal
baseline harness; Task 8 adds board-texture and post-flop event accounting.
