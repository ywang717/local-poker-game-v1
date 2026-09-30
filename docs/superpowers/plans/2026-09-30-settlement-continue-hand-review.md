# 结算继续与上一手回顾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在每手结算后等待玩家选择继续或离桌，并在牌桌内提供可展开的上一手牌局回顾。

**Architecture:** 保留现有 `SETTLEMENT` 状态作为等待点，移除自动开始下一手的计时器；`App` 提供显式继续/离桌回调，`GamePage` 展示结算控制和回顾展开状态。回顾复用持久化的 `HandSummary`，历史页和牌桌页共享 `HandReview` 组件。

**Tech Stack:** React, TypeScript, Zustand, IndexedDB, Vitest, Vite。

**Spec:** `docs/superpowers/specs/2026-09-30-settlement-continue-hand-review-design.md`

## Global Constraints

- 完全离线；不增加网络、账号、服务器或真钱功能。
- 规则正确性、资金结算和现有 AI 信息边界保持不变。
- 结算快照必须可恢复；结算状态不自动推进。
- 弃牌 AI 的未公开底牌不得出现在上一手回顾中。
- 中文 UI，沿用白色极简样式；真人无行动倒计时。

## Review Focus

- 结算快照重启后仍能选择继续或离桌：Task 2 的存档恢复测试。
- 真人筹码为 0 时不能继续并能完成破产保护：Task 2 的资金流程测试。
- AI 先行动后才轮到真人且已请求离桌：Task 2 的离桌回归测试。
- 多底池获胜者和派奖在回顾中不丢失：Task 1/3 的数据与渲染测试。
- 离桌重进后的 Hand ID 不重复：Task 1 的唯一编号测试。

### Task 1: Extend hand summaries and unique IDs

**Files:**
- Modify: `src/career/handHistory.ts`
- Modify: `src/App.tsx`
- Modify: `src/career/careerService.ts` only if cloning/migration needs the new field
- Modify: `src/storage/migrations.ts`
- Test: `tests/career/statistics.test.ts`, `tests/storage/migrations.test.ts`

**Interfaces:**
- Produce `HandSummary.potResults: { amount: number; winnerPlayerIds: string[]; awards: { playerId: string; amount: number }[] }[]`.
- `handSummary(state)` must copy every settled pot result and preserve it through `recordHand` and migration.
- Produce a unique hand ID based on a stable timestamp/unique suffix while retaining existing `handNumber` for display.

- [ ] Write failing tests for pot result persistence, migration defaults, and two separately started tables producing different hand IDs.
- [ ] Run the focused tests and verify they fail for the missing field/duplicate ID behavior.
- [ ] Implement the summary field, clone/migration defaults, and unique ID generation without changing settlement math.
- [ ] Run focused tests and verify they pass.
- [ ] Commit `feat: preserve review data and unique hand ids`.

### Task 2: Make settlement wait for explicit continue or leave

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Game/GamePage.tsx`
- Modify: `src/store/gameStore.ts` only if an explicit settlement transition helper is required
- Test: `tests/ui/settingsAndResume.test.tsx`, `tests/release/acceptance.test.ts`

**Interfaces:**
- `GamePage` accepts `onContinue: () => void`, `onLeave: () => void`, `canContinue: boolean`, and `previousHand: HandSummary | null`.
- `App` exposes `continueHand()` that starts the next hand only from `SETTLEMENT`.

- [ ] Write failing tests proving a settlement state does not auto-create another hand, renders both choices, and continue creates the next hand.
- [ ] Write a failing test proving zero human chips disables continue and leave still returns to career with bankruptcy protection.
- [ ] Remove the settlement timer effect and implement explicit continue/leave callbacks; preserve pending leave behavior and snapshot persistence.
- [ ] Run focused tests and verify they pass.
- [ ] Commit `feat: wait for explicit next-hand choice`.

### Task 3: Add reusable in-table hand review

**Files:**
- Create: `src/components/HandReview/HandReview.tsx`
- Modify: `src/pages/History/HistoryPage.tsx`
- Modify: `src/pages/Game/GamePage.tsx`
- Modify: `src/styles/theme.css`
- Test: `tests/ui/renderSmoke.test.tsx`, `tests/ui/settingsAndResume.test.tsx`

**Interfaces:**
- `HandReview({ hand, defaultExpanded, collapsible })` renders cards, result, pot results, and action timeline.
- Only cards already present in `HandSummary.playerHoleCards` and `communityCards` are rendered; no hidden AI cards are added.

- [ ] Write failing render tests for settlement controls, default-expanded review, collapse/expand label, pot winner text, and action timeline.
- [ ] Implement the shared component and use it from both history and game pages.
- [ ] Add compact in-table styling that does not cover the fixed action area.
- [ ] Run UI tests and verify they pass.
- [ ] Commit `feat: add in-table previous hand review`.

### Task 4: Documentation and release verification

**Files:**
- Modify: `README.md`
- Test: full project suite and simulation suite

- [ ] Document settlement choices, previous-hand review, and recovery behavior.
- [ ] Run `npm test`, `npm run test:simulation`, `npm run typecheck`, and `npm run build` sequentially.
- [ ] Check `git diff --check`, verify the standalone worktree is clean, and commit `docs: explain settlement review flow`.
- [ ] Push `main` after all checks pass.
