# Local Poker Game V2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持现有离线扑克规则正确性的前提下，交付范围驱动的 AI V2、现金桌中途买入和六人 Mini 锦标赛，并用可复现的基线、专项测试和发布门禁证明行为与资金安全。

**Architecture:** 以 `MatchType` 和版本化会话元数据区分现金桌与锦标赛；现金买入和锦标赛状态先通过纯函数服务完成，再接入 Zustand、IndexedDB 和 React 页面。AI 保留 `chooseAction` 入口，新增局面分类、范围策略、下注尺度、All-in 门控、postflop 与对手模型层；模拟器用独立随机流输出前后可比较的 JSON 报告。

**Tech Stack:** React 19、TypeScript 5.9、Vite、Zustand、IndexedDB、Vitest、现有扑克引擎和 PWA 构建流程。

**Spec:** `docs/superpowers/specs/2026-10-01-ai-v2-tournament-cash-buyin-design.md`

## Global Constraints

- 保持完全离线、无账号、无服务器、无真人联机和无真钱。
- 不复制外部仓库代码、范围表或训练数据；只参考公开架构思路。
- 现金桌买入上限为 100BB；当前手牌期间申请只在下一手生效。
- Mini 锦标赛固定 6 人、报名等级固定 AI 难度、禁止买入和 AI Rebuy。
- 所有交易必须使用唯一 ID 并且幂等；重复确认、恢复和离桌不能重复扣款或退款。
- AI 上下文不得包含真人底牌、其他未公开底牌、牌堆顺序、未来公共牌或最终结果。
- 继续使用白色极简中文 UI 和现有移动端单页牌桌布局。
- 规则正确性、资金守恒和信息边界优先于 AI 复杂度和动画。
- GitHub Pages 只有在 typecheck、全量测试、AI 测试、现金买入测试、锦标赛测试、模拟测试和 build 全部成功后才部署。

## Review Focus

- **短码/动态座位行动顺序：** 锦标赛从 6 人缩到 2 人后，Dealer/SB/BB 和行动顺序必须正确；由 Task 6 的 Heads-Up 与淘汰测试覆盖。
- **资金交易边界：** 待生效买入、结算盈利、上限截断和离桌退款必须只执行一次；由 Task 4 的纯函数不变量和 Task 5 的恢复测试覆盖。
- **AI 局面识别：** 盲注、短码不完整加注和真实 3-Bet/4-Bet 不得混淆；由 Task 2 的分类表和 Task 3 的定点决策测试覆盖。
- **公开信息边界：** 锦标赛观战和模拟仍不能向 AI 暴露隐藏牌或结果；由 Task 6/8 的上下文快照测试覆盖。
- **旧存档迁移：** V1 生涯和牌局快照必须可读，且不会重复发放交易；由 Task 1 的 v1→v2 migration 和 Task 7 的恢复测试覆盖。

---

### Task 1: V2 会话、资金和存档基础

**Files:**
- Create: `src/match/matchTypes.ts`, `src/match/session.ts`
- Create: `src/career/transactions.ts`, `src/career/cashBuyIn.ts`, `src/career/tournamentStatistics.ts`
- Modify: `src/game/gameState.ts`, `src/career/careerState.ts`, `src/types/persistence.ts`, `src/storage/migrations.ts`, `src/storage/saveSystem.ts`, `src/game/gameEngine.ts`
- Test: `tests/storage/v2Migrations.test.ts`, `tests/career/transactions.test.ts`, `tests/game/sessionMetadata.test.ts`

**Interfaces:**
- `MatchType = 'CASH' | 'MINI_TOURNAMENT'`.
- `MatchSession = { sessionId: string; matchType: MatchType; tableLevel: TableLevelId; mode: GameMode }`.
- `PendingCashBuyIn = { transactionId: string; sessionId: string; requestedAmount: number; reservedAmount: number; status: 'PENDING' | 'APPLIED' | 'REFUNDED' }`.
- `FinancialTransaction = { transactionId: string; sessionId: string; kind: 'INITIAL_BUY_IN' | 'TOP_UP' | 'BUY_IN_REFUND' | 'TABLE_CASH_OUT' | 'TOURNAMENT_ENTRY' | 'TOURNAMENT_CHAMPION_REWARD'; amount: number; status: 'APPLIED' | 'REFUNDED'; createdAt: string }`.
- `reserveFunds(career, request): TransactionResult` and `refundPendingCashBuyIn(career, transactionId): CareerState` are pure and idempotent.
- `CURRENT_SAVE_VERSION` becomes 2; v1 data receives empty V2 fields and cash defaults.

- [ ] **Step 1: Write failing migration and transaction tests.** Assert v1 career/snapshot defaults, safe-integer validation, insufficient funds, duplicate transaction ID, and idempotent refund.
- [ ] **Step 2: Run `npm test -- tests/storage/v2Migrations.test.ts tests/career/transactions.test.ts` and confirm the new tests fail.**
- [ ] **Step 3: Implement V2 types, pure transaction functions, session metadata defaults, and migration.** Keep old `activeTableStack` behavior compatible until Task 4 replaces the cash flow.
- [ ] **Step 4: Add session metadata to table creation/start-hand snapshots without changing betting rules.** Old snapshots must default to `CASH`.
- [ ] **Step 5: Run targeted tests and `npm run typecheck`; commit `feat: add v2 session and transaction contracts`.**

### Task 2: AI V2 context, position and preflop situation classifier

**Files:**
- Create: `src/ai/positionStrategy.ts`, `src/ai/preflopStrategy.ts`, `src/ai/opponentModel.ts`
- Create: `src/simulation/aiExperienceSimulation.ts` (baseline harness only; extended in Task 8)
- Modify: `src/ai/publicContext.ts`, `src/ai/preflopRanges.ts`, `src/ai/playerModel.ts`, `src/game/gameState.ts`
- Test: `tests/ai/preflopStrategy.test.ts`, `tests/ai/positionStrategy.test.ts`, `tests/ai/opponentModel.test.ts`, `tests/ai/informationBoundary.test.ts`
- Test: `tests/ai/experienceSimulation.test.ts`

**Interfaces:**
- `DetailedPosition = 'UTG' | 'UTG1' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB' | 'HEADS_UP'`.
- `PreflopSituation = 'UNOPENED' | 'LIMPED' | 'FACING_OPEN' | 'FACING_3BET' | 'FACING_4BET_PLUS' | 'FACING_ALL_IN'`.
- `classifyPreflopSituation(context): { situation; openerId?; lastAggressorId?; raiseCount; callerCount; effectiveStack }`.
- `positionForDetailed(state, playerId): DetailedPosition` uses initial occupied seats and does not filter folded players.
- `HandClass` and `WeightedRange` represent standard 169 and short-deck 81 classes without importing external range data.
- `updateOpponentModel(model, observation)` records VPIP/PFR/3-Bet/4-Bet/fold-to-3-Bet and sizing observations with sample counts.

- [ ] **Step 1: Add failing table-driven tests for 6-player UTG open/BTN, CO open/BTN, BTN open/BB, 4-Bet, blind-only and short-all-in cases.** Assert folded seats do not change positions and hidden fields remain absent.
- [ ] **Step 2: Run the targeted AI tests and verify failure.**
- [ ] **Step 3: Implement detailed position mapping and action-history classifier.** Count only full raises as new aggression events; keep short all-ins out of 3-Bet/4-Bet counts.
- [ ] **Step 4: Implement mode-specific hand-class normalization and weighted range tables.** Make LV2 conservative and LV5 wider only where the situation and position justify it.
- [ ] **Step 5: Implement opponent-model updates with minimum-sample defaults.** Never infer 3-Bet from an arbitrary raise or final pot size.
- [ ] **Step 6: Add a minimal complete-hand experience harness around the existing AI and run the pre-change 10,000-hand baseline before replacing AI decision branches.** Preserve seeds, configuration, and numerator/denominator counters in `docs/ai-balance/BASELINE.md`.
- [ ] **Step 7: Run targeted tests, typecheck, and commit `feat: add ai v2 context and range primitives`.**

### Task 3: AI V2 decision, sizing, All-in and experience metrics

**Files:**
- Create: `src/ai/raiseStrategy.ts`, `src/ai/jamStrategy.ts`, `src/ai/postflopStrategyV2.ts`, `src/ai/experienceMetrics.ts`
- Modify: `src/ai/aiEngine.ts`, `src/ai/turn.ts`, `src/ai/difficulty.ts`, `src/ai/personalities.ts`, `src/ai/decisionFeatures.ts`
- Test: `tests/ai/raiseStrategy.test.ts`, `tests/ai/jamStrategy.test.ts`, `tests/ai/postflopStrategyV2.test.ts`, `tests/ai/experienceMetrics.test.ts`, `tests/ai/aiV2Cases.test.ts`

**Interfaces:**
- `chooseAction(context, difficulty, personality, rng, options?: DecisionOptions): PlayerAction` keeps the existing call shape valid.
- `DecisionOptions = { matchType?: MatchType; tournament?: TournamentDecisionContext; forcedPersonality?: PersonalityId }`.
- `chooseRaiseTarget(input): number` distinguishes Raise To from Raise By and targets Open 2.2–3BB, IP 3-Bet about 3x, OOP 3.5–4x, and 4-Bet 2.1–2.7x before legal clamping.
- `decideJam(input): 'JAM' | 'RAISE' | 'CALL' | 'FOLD'` gates Open Jam, 3-Bet Jam, 4-Bet Jam, Reshove, Call Jam and Postflop Jam by effective stack and range.
- `ExperienceReport` stores numerator/denominator pairs for VPIP, PFR, 3-Bet, 4-Bet, Fold to 3-Bet, C-Bet, Check-Raise, active/call/preflop/postflop All-in, pot, sizing, showdown and action counts.

- [ ] **Step 1: Write failing deterministic decision tests for AA/KK/QQ/JJ/AKs/AQs/A5s/87o/72o facing UTG open at 100BB, plus CO/BTN/BB and 4-Bet scenarios.** Assert 72o is not a routine BTN-vs-UTG 3-Bet and deep-stack All-in is gated.
- [ ] **Step 2: Run the targeted tests and verify failure.**
- [ ] **Step 3: Implement situation-specific preflop branches.** Handle value, bluff, call and fold ranges independently for Open, 3-Bet, 4-Bet and All-in; do not reuse open logic for 4-Bet.
- [ ] **Step 4: Implement deterministic raise sizing and jam gates.** Always clamp the final action through `getLegalActions`; preserve short-all-in reopen rules.
- [ ] **Step 5: Replace postflop strength-only branching with board texture, draw, pot odds, SPR, prior aggressor, opponent count and pot-control decisions.** Add bounded Monte Carlo only behind LV4/LV5 and a fixed simulation budget.
- [ ] **Step 6: Wire personality as a bounded adjustment and tournament context as an explicit option.** Do not derive tournament difficulty from current blinds.
- [ ] **Step 7: Add AI behavior counters and run 10,000 complete-hand decisions per main mode/level scenario; compare against the baseline without changing the preserved baseline file.**
- [ ] **Step 8: Run `npm run test:ai` and `npm run test:ai:experience`; commit `feat: rework ai strategy for v2`.**

### Task 4: Cash-table mid-hand buy-in service and career synchronization

**Files:**
- Create: `src/career/cashBuyInService.ts`
- Modify: `src/career/careerService.ts`, `src/store/careerStore.ts`, `src/store/gameStore.ts`, `src/App.tsx`, `src/game/gameState.ts`
- Test: `tests/career/cashBuyIn.test.ts`, `tests/career/cashBuyInConservation.test.ts`, `tests/storage/cashBuyInRecovery.test.ts`

**Interfaces:**
- `getCashBuyInOptions(tableLevel, tableStack, currentFunds): CashBuyInOption[]` supports targets 25BB/50BB/100BB and custom positive safe integers.
- `requestCashBuyIn(career, session, targetStack): { career; pending }` reserves only the permitted amount and creates one transaction ID.
- `applyPendingCashBuyIn(career, pending, settledStack): { career; appliedAmount; refundedAmount }` applies only `min(requested, max(0, 100BB-settledStack))`.
- `cancelPendingCashBuyIn(career, transactionId): CareerState` refunds once.
- `syncActiveTableStack(career, stack): CareerState` updates the actual stack after settlement without double counting.

- [ ] **Step 1: Write failing tests for all 10 buy-in validation cases, pending application during Preflop/Flop/Turn/River/All-in, account shortage, >100BB winnings, duplicate confirmation, zero-stack rebuy, and cancel-on-leave.**
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Implement pure option/validation/reservation/application/cancellation services and financial ledger records.**
- [ ] **Step 4: Update career/game stores so current hand state is never mutated by a pending request.** Apply pending funds only while constructing the next hand; use actual settled stack to refund excess.
- [ ] **Step 5: Change zero-stack cash settlement from forced exit to a choice state; preserve bankruptcy protection only after the player chooses to leave or cannot buy in.**
- [ ] **Step 6: Add IndexedDB persistence/recovery tests for pending, applied and refunded transactions.**
- [ ] **Step 7: Run `npm run test:cash-buyin`, typecheck, and commit `feat: add idempotent cash table buy-ins`.**

### Task 5: Cash buy-in UI and responsive integration

**Files:**
- Create: `src/components/CashBuyInModal/CashBuyInModal.tsx`, `src/components/CashBuyInModal/CashBuyInModal.css`
- Modify: `src/pages/Game/GamePage.tsx`, `src/pages/TableSelect/TableSelectPage.tsx`, `src/App.tsx`, `src/styles.css`, `tests/ui/settingsAndResume.test.tsx`
- Test: `tests/ui/cashBuyIn.test.tsx`, `tests/ui/responsiveCashBuyIn.test.tsx`

**Interfaces:**
- `CashBuyInModalProps = { level; tableStack; currentFunds; pending; onConfirm(target); onCancel() }`.
- `GamePage` receives `matchType`, `tableLevel`, pending status and buy-in callbacks; it renders the button only for `CASH`.

- [ ] **Step 1: Write failing desktop/mobile UI tests for toolbar order 暂停 → 买入 → 离开牌桌, disabled states after leave request, modal options, pending message and zero-stack choices.**
- [ ] **Step 2: Run the targeted UI tests and verify failure.**
- [ ] **Step 3: Implement the modal and wire pure cash-buy-in service calls.** Ensure buttons are at least 44px and no horizontal overflow.
- [ ] **Step 4: Add settlement behavior for immediate next-hand application and cancel-on-leave.** Verify the current hand pot, contribution and all-in amount remain unchanged after requesting a buy-in.
- [ ] **Step 5: Run UI tests, typecheck and commit `feat: expose cash buy-in flow in the table UI`.**

### Task 6: Mini tournament pure engine

**Files:**
- Create: `src/tournament/types.ts`, `src/tournament/blindStructure.ts`, `src/tournament/tournamentEngine.ts`, `src/tournament/tournamentSettlement.ts`, `src/ai/tournamentStrategy.ts`
- Modify: `src/game/dealer.ts`, `src/game/gameEngine.ts`, `src/ai/turn.ts`
- Test: `tests/tournament/blindStructure.test.ts`, `tests/tournament/tournamentEngine.test.ts`, `tests/tournament/tournamentSettlement.test.ts`, `tests/game/dealerDynamicSeats.test.ts`

**Interfaces:**
- `TournamentState = { tournamentId; mode; tableLevel; entryFee; startingStack; smallBlind; bigBlind; blindLevel; handsAtLevel; handNumber; players; eliminations; rankings; championId?: string; rewardPaid: boolean; spectator: boolean }`.
- `startTournament(input): TournamentState` always creates 1 human + 5 AI with 100BB stacks.
- `startTournamentHand(state, rng): GameState` uses the current blind stage and fixed entry `tableLevel` difficulty.
- `settleTournamentHand(state, settledGame): TournamentState` removes zero-stack players only after all pots/refunds are settled and records deterministic rankings.
- `advanceBlindLevel(state): TournamentState` increments every 8 completed hands using level-scaled blind schedules.
- `finishTournament(state): { state; championId; rewardTransaction? }` returns exactly one champion and one optional reward transaction.
- `getActionOrderForPlayers(players, dealerSeat, street)` and `blindSeatsForPlayers(players, dealerSeat)` handle dynamic 6→2 seats.

- [ ] **Step 1: Write failing tests for blind schedules, 6-player start, 8-hand upgrade, chip conservation, one/two-player eliminations, dynamic Heads-Up blinds/action order, and fixed AI difficulty after blind growth.**
- [ ] **Step 2: Run tournament tests and verify failure.**
- [ ] **Step 3: Implement dynamic-seat dealer/blind helpers without changing existing cash-table API behavior.**
- [ ] **Step 4: Implement tournament state transitions, elimination ranking, and champion guard.** No Rebuy path exists in the type or engine.
- [ ] **Step 5: Implement tournament-specific AI context and short-stack strategy using the AI V2 primitives from Task 3.**
- [ ] **Step 6: Run targeted tests and commit `feat: add mini tournament engine`.**

### Task 7: Tournament entry, UI, persistence and career rewards

**Files:**
- Create: `src/components/TournamentInfo/TournamentInfo.tsx`, `src/pages/TournamentSelect/TournamentSelectPage.tsx`, `src/pages/TournamentResult/TournamentResultPage.tsx`
- Modify: `src/App.tsx`, `src/pages/Home/HomePage.tsx`, `src/pages/Career/CareerPage.tsx`, `src/pages/Game/GamePage.tsx`, `src/career/careerService.ts`, `src/store/careerStore.ts`, `src/store/gameStore.ts`, `src/storage/saveSystem.ts`, `src/storage/migrations.ts`
- Test: `tests/ui/tournamentFlow.test.tsx`, `tests/storage/tournamentRecovery.test.ts`, `tests/career/tournamentStatistics.test.ts`

**Interfaces:**
- `enterTournament(mode, level): TournamentState` deducts the entry transaction once and creates the session.
- `recordTournamentFinish(state): CareerState` records entry fee, rank, champion reward and net result exactly once.
- `GamePage` displays tournament info and never renders the cash buy-in control for `MINI_TOURNAMENT`.

- [ ] **Step 1: Write failing UI/career/storage tests for entry affordability/unlock, six seats, no buy-in button, blinds/rank/eliminations, AI champion, human champion reward, spectator, reload, and duplicate reward prevention.**
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Add tournament entry and result navigation, fixed 6-player setup, and tournament info panel.**
- [ ] **Step 4: Persist tournament state and migration defaults; restore the exact current hand, blind level, eliminations and reward guard.**
- [ ] **Step 5: Add separate tournament career statistics and screens without mixing cash profits.**
- [ ] **Step 6: Run UI/storage/career tests and commit `feat: integrate mini tournament career flow`.**

### Task 8: Baselines, AI experience simulator and tournament simulator

**Files:**
- Create: `src/simulation/aiExperienceSimulation.ts`, `src/simulation/tournamentSimulation.ts`, `src/simulation/reporting.ts`
- Create: `tests/ai/experienceSimulation.test.ts`, `tests/tournament/tournamentSimulation.test.ts`, `tests/simulation/reproducibleReports.test.ts`
- Create: `docs/ai-balance/BASELINE.md`, `docs/ai-balance/AI-V2-REPORT.md`, `docs/ai-balance/AI-V2-RESULTS.json`, `docs/ai-balance/AI-V2-CASES.csv`
- Create: `docs/cash-buyin/BUYIN-TEST-REPORT.md`, `docs/tournament/TOURNAMENT-TEST-REPORT.md`, `docs/release/V2-ACCEPTANCE.md`
- Modify: `src/simulation/runSimulation.ts`, `package.json`

**Interfaces:**
- `runAIExperienceSimulation(options): ExperienceReport` runs complete hands, not isolated actions, and accepts difficulty, mode, table size, seed and hand count.
- `runTournamentSimulation(options): TournamentReport` runs until one champion for every tournament; it never stops at a hand-count shortcut.
- `runRulesRegressionMatrix()` preserves the existing 14,000-hand table/mode matrix.
- `writeReport(report): string` emits stable JSON and CSV-compatible numerator/denominator data.

- [ ] **Step 1: Write failing tests for baseline/post-change matrix dimensions, deterministic digests, actual full-hand completion, and report numerator/denominator fields.**
- [ ] **Step 2: Run simulator tests and verify failure.**
- [ ] **Step 3: Add LV2–LV5 complete-hand experience simulation with independent deal/decision RNGs and the requested behavior counters.**
- [ ] **Step 4: Extend the harness after the AI refactor with the post-change counters and stable report serialization; the pre-change baseline must already exist from Task 2 Step 6.**
- [ ] **Step 5: Add 1,000 complete tournament simulations: 500 STANDARD and 500 SHORT_DECK, LV2–LV5 evenly distributed, plus LV1 smoke; assert one champion, no Rebuy, no deadlock and tournament chip conservation.**
- [ ] **Step 6: Add named npm scripts: `test:ai`, `test:ai:experience`, `test:cash-buyin`, `test:tournament`, and retain `test:simulation` for the 14,000-hand gate.**
- [ ] **Step 7: Run all simulations and generate before/after comparison reports; commit `test: add v2 balance and tournament reports`.**

### Task 9: CI gate, final acceptance and release

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`, `README.md`
- Test: `tests/release/v2Acceptance.test.ts`, `tests/pwa/pwaAssets.test.ts`

- [ ] **Step 1: Write failing release tests for all required scripts, V2 save version, no cash buy-in in tournament rendering, and report artifacts.**
- [ ] **Step 2: Update the workflow to run `npm ci`, typecheck, unit tests, all AI/cash/tournament/simulation gates and build before upload/deploy.**
- [ ] **Step 3: Document V2 recovery, cash buy-in, tournament entry and mobile usage in README.**
- [ ] **Step 4: Run the complete release sequence locally.**

  - `npm ci`
  - `npm run typecheck`
  - `npm test`
  - `npm run test:ai`
  - `npm run test:ai:experience`
  - `npm run test:cash-buyin`
  - `npm run test:tournament`
  - `npm run test:simulation`
  - `npm run build`
- [ ] **Step 5: Run `git diff --check`, inspect all generated reports, and verify no test was removed or bypassed.**
- [ ] **Step 6: Commit `ci: add v2 release gates`, push the feature branch, merge only after CI passes, and verify the deployed public URL.**

## Spec Coverage Self-Review

- AI levels, positions, Open/3-Bet/4-Bet, sizing, All-in, postflop, personalities and opponent models: Tasks 2–3 and 8.
- Cash buy-in, 100BB cap, pending application, zero-stack rebuy, cancellation, ledger, persistence and UI: Tasks 1, 4–5, 7–9.
- Tournament entry, six players, blind growth, elimination, Heads-Up, ranking, champion reward, spectator, persistence and UI: Tasks 1, 6–8.
- Baseline and post-change 10,000-hand comparison, 1,000 tournaments and 14,000 rules matrix: Task 8.
- V2 migration and GitHub Pages release blocking: Tasks 1 and 9.
