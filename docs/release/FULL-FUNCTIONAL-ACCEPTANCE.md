# 全量功能验收与缺陷修复

## 基准与范围

- 基准：远端 main `1a999ec28ff60592d3593384e12747550b0abcbe`。独立工作区 `fix/full-functional-audit`；此前十万手审计提交保留在原工作区。
- 使用确定性回归、真实浏览器点击与现有 Release Smoke。固定存档由真实引擎生成，针对极端状态的注入明确属于测试数据；线上操作均使用独立浏览器存档。
- 未对 AI 范围和诈唬频率整体调参；本轮不再运行大型压力测试。

## 修复与失败证据

| 缺陷 | 修复 | 回归证据 |
|---|---|---|
| 私人 A 被判为短牌低端顺子听牌 | AI 使用公共牌 A 来源限制，结算规则不变 | shortDeckDrawConsistency；私人 A 场景失败→通过，公共牌 A 保持有效 |
| 部分获胜显示未获胜 | 显示独立“部分获胜”结果 | fullFunctionalRegression |
| 行动金额混淆 Raise To/本次投入 | 显示“加注到…（本次投入…）” | fullFunctionalRegression |
| 旧记录姓名缺失露出内部 ID | 使用结算姓名映射；无法恢复时明确“历史姓名未保存” | fullFunctionalRegression |
| 回顾不显示未跟注退款 | HandSummary 增加可选 refunds，单独显示 | fullFunctionalRegression；不改变 saveVersion/IndexedDB 版本 |
| 仅能查看最近20条历史 | 每页20手翻页，可访问实际保留的10,000手 | fullFunctionalRegression；浏览器 history-and-statistics |
| 锦标赛结果缺冠军名、手数 | 显示真实冠军姓名及比赛手数；退出不声称已产生冠军 | fullFunctionalRegression；真实浏览器标准/短牌冠军、淘汰与观战 |
| 小数下注按钮未禁用 | 金额必须为安全整数 | fullFunctionalRegression；浏览器 action-validation-and-allin |
| 旧记录 PFR 标记漏计 | 尊重明确保存的 PFR、Fold 等字段 | fullFunctionalStatistics 五手独立预期 |
| 未重开加注权仍计3-Bet机会 | 采用明确机会标记/合法加注元数据；4-Bet为正确层级 | fullFunctionalStatistics |
| 已缓存旧统计不随修复更新 | 可选 handStatsVersion；从保留的公开历史一次性修复有证据的指标，保留更早事实 | handStatsPersistence；重复加载无重复累计 |
| 音效开关无效果、首次交互恢复前丢失声音 | 原生 Web Audio 轻量音效，遵守静音/浏览器交互限制 | audioEffects；浏览器真实AudioContext音源启停检查 |
| 街道阶段露出英文枚举 | 对局阶段使用中文标签 | 浏览器下注阶段恢复 |
| favicon未缓存导致离线加载错误 | 加入PWA预缓存 | 浏览器失败请求定位favicon.svg→Chromium离线刷新通过 |
| 离桌先切页、后保存资金 | 职业资金与清除牌局快照同一事务，成功后发布UI；失败保留牌局并可重试 | leaveTableRecovery延迟写入及失败重试 |
| SHOWDOWN计时器可能复活已离桌牌局 | 离桌先切为内存结算态，阻止旧摊牌计时器越过原子边界写回 | 独立复核P1；延迟提交+计时器穿越测试失败→通过 |
| 跟注耗尽筹码漏计All-in | 同时记录All-in参与与All-in Call元数据 | allInSummary、callAllInMetadata |
| 结算底池包含退款 | 显示实际竞争底池之和 | fullFunctionalRegression，75投入/25退款显示50底池 |

所有生产修复均有失败后通过的回归证据；配置及轻量文案通过对应构建/浏览器检查验证。

## 统计独立预期

同一AA五手：WIN / SPLIT / LOSS / FOLD / PARTIAL_WIN，净收益 +200、0、-100、-50、+40，大盲50。

- 手数5、单独获胜1、平分1、部分获胜1、输牌/弃牌2；单独胜率20%。
- 净收益+90；+1.8BB；BB/100 +36；VPIP 3/5=60%；PFR 2/5=40%。
- 标准/短牌均核对；重复记录和保存恢复不增加样本；现金桌和锦标赛隔离。
- 报名5,000，真人冠军奖金50,000，净收益45,000；AI冠军和真人淘汰不发真人冠军奖金；重复恢复不重复派奖。

## 自动验证

- 基线：71文件，390测试；Typecheck与Build通过。
- 当前默认测试：77文件，485测试 PASS。
- 70组标准/短牌 × 7人数 × 5等级配置及姓名/盲注检查，额外1条锁定/禁止7人检查，包含在默认测试中。
- AI专项：22文件，134测试 PASS。
- Cash Buy-in：4文件，26测试 PASS；Tournament：6文件，21测试 PASS。
- Release Smoke：1文件，3测试 PASS；800手AI、600手规则、20场完整锦标赛。大型模拟未加入默认测试或CI。
- Typecheck：PASS；GitHub Pages子路径生产构建：PASS。
- 已有部分React测试仍打印act提示，测试没有失败。

## 功能结果索引

表中PASS已由本地生产构建回归及发布后真实线上操作核对。固定状态边界仍明确属于引擎生成测试存档，不等同自然打牌碰到该情形；实体设备与未逐一覆盖的组合另列。

| 检查 | 数据/组件回归 | 真实浏览器 | 证据 |
|---|---|---|---|
| 创建昵称、默认资金、导航、设置保存、取消新生涯 | PASS | PASS | home-create-settings |
| 2/3/4/5/6/8/9人、两模式、五级买入门槛 | PASS（70组配置） | PASS（全部人数入桌、两模式等级选择） | selectionMatrix；names-*；tournament-entry-* |
| AI姓名、刷新、下一手、冠军、回顾时间线 | PASS | PASS | names-*；play-*；tournament-*；history-and-statistics |
| 连续行动、全下确认、非法金额、暂停及速度 | PASS | PASS（过牌/跟注/弃牌/全下与快捷金额） | action-validation-and-allin；pause-resume-*；play-* |
| 现金补码、取消、退款、离桌与重载 | PASS | PASS | cashBuyIn；leaveTableRecovery；buyin-cancel-leave；pending-buyin-reload |
| 冠军、淘汰观战、快速模拟、奖金幂等 | PASS | PASS（引擎固定状态边界） | tournament-*；spectator-* |
| 历史分页、部分获胜、行动金额及退款 | PASS | PASS（分页与详情）；金额/退款由回归核对 | fullFunctionalRegression；history-and-statistics |
| 五手独立统计、模式/比赛隔离、重复去重 | PASS | PASS（BB/100、VPIP、PFR、胜率及矩阵） | fullFunctionalStatistics；handStatsPersistence；history-and-statistics |
| 牌型提示、全下确认与音效/静音 | PASS | PASS | names-*；audio-*；action-validation-and-allin |
| 四下注阶段恢复、Pending恢复、损坏存档备份 | PASS | PASS | restore-*；pending-buyin-reload；corrupt-save-backup |
| 全下/边池/Applied/淘汰状态恢复 | PASS（相关存档、资金、锦标赛回归） | 部分PASS（锦标赛结果及Pending）；每一种组合逐一浏览器刷新NOT RUN | tests/storage；tests/tournament |
| PWA离线启动 | PASS（缓存构建） | Chromium PASS；WebKit NOT RUN | offline-and-reload |
| 版本更新后保留存档 | PASS | PASS（同一隔离Chrome配置、真实旧缓存更新） | update-result.json；online-update-preserved.png |

补充真实浏览器检查：两种模式普通Bet/Raise、所有设置保存恢复、关闭短牌提示及自动亮牌、牌型顺序与关闭按钮/遮罩，共14项全部PASS。没有逐一覆盖每种设置值下的所有操作组合；三档动画实际时间差、实体扬声器听感仍为NOT RUN，不能由保存或组件测试替代。

## 浏览器检查

- Chromium使用本机Chrome；WebKit使用独立自动化引擎。桌面1440×900、1280×720，移动390×844、360×800、844×390。
- 完整覆盖：全部7种人数姓名/布局、标准/短牌2/6/9人真实入桌和连续牌局、四下注阶段恢复、补码取消与恢复、金额/全下确认、锦标赛报名/冠军/淘汰/快速模拟、分页/统计详情、备份恢复、音效及暂停。
- 每个可通过用例均检查Console与HTTP错误并保存截图。暂停NORMAL/2X时核对行动历史停止，恢复后继续；INSTANT贯穿实际对局用例。
- 本地浏览器102项：101 PASS、0 FAIL、1 NOT RUN（WebKit离线导航平台限制）。
- 本地最新结果与截图：`functional-evidence/local-results.json`（发布前保存）。
- 线上发布前已确认历史分页缺陷；修复后网站已完成分页与详情同步验收，结果见发布章节。

## 发布与线上结果

- 修复源提交：`4186c96e0aab5f577e16581e9adb309abf1f8101`。
- 已发布 main 提交：`225f80f0d04f08a1e280179a1665842f9b44d3a5`；远端树与本地完全一致：`12d02d51f1e030a8329e154c611287b3a8cb5348`。
- [GitHub Actions 40280584537](https://github.com/ywang717/local-poker-game-v1/actions/runs/40280584537)：**SUCCESS**。依赖安装、Typecheck、485默认测试、134 AI测试、26补码测试、21锦标赛测试、发布Smoke、Build、Pages部署均成功。
- CI Smoke只出现一个执行步骤，800手AI + 600手规则 + 20场锦标赛；默认测试继续排除大型矩阵与release目录。没有增加十万手或14K矩阵。
- [正式网站](https://ywang717.github.io/local-poker-game-v1/) 已发布并复测。
- 发布后主浏览器验收102项：**101 PASS、0 FAIL、1 NOT RUN**（WebKit离线导航自动化限制）；补充浏览器14项：**14 PASS、0 FAIL**。合计116项：**115 PASS、0 FAIL、1 NOT RUN**。
- 每个通过用例Console错误及HTTP失败均为0；截图在隔离配置中收集，未操作用户原生涯。
- 真实更新保留：同一个Chrome配置从旧脚本 `index-1cIBA81U.js` 更新到 `index-ByNAT7k5.js` 后，昵称“更新存档保留测试”、资金10,000、静音设置全部保留，**PASS**。
- JS、CSS、Service Worker线上文件与本地生产构建逐字节匹配，SHA-256记录见 `functional-evidence/live-assets.json`。
- 首次线上脚本有三处时序失败：快速结算使操作区在定位时消失、AI先弃牌后座位已按设计隐藏；修正验收脚本以检查当前有效状态后，同用例复测通过，没有通过吞掉真实错误来跳过验收。补充设置脚本的标签/首页导航定位也在独立复测后通过。
- 最终后续提交仅更新报告、截图、浏览器验收工具，使用 `[skip ci]` 避免再次部署完全相同的游戏资源；已部署游戏源仍是上述225f80f，生产源与构建配置没有后续改动。

证据：

- `functional-evidence/online-results.json`、`online-extra-results.json`：逐用例PASS/NOT RUN、视口、耗时及错误数组。
- `functional-evidence/actions-result.json`：实际运行编号、提交、步骤与部署结果。
- `functional-evidence/update-result.json`、`live-assets.json`：缓存更新存档保留与资源校验。
- 截图：`online-chromium-mobile.png`、`online-chromium-history-statistics.png`、`online-update-preserved.png`。

## 限制与未执行项

- WebKit自动化离线导航：NOT RUN。缓存和Service Worker均成功创建，但模拟断网reload在WebKit自动化层报internal error；普通/持久配置、禁网路由复现相同平台问题。未当作通过。Chromium离线刷新已通过。
- 实体iPhone/Android、Windows/Edge及实体扬声器听感：NOT RUN；移动视口与WebKit结果不冒充实体设备验收。
- 超出保留历史、没有公开行动或明确标记的旧事实无法完整追溯修正；迁移只修复可证明的指标，不丢弃更早样本。
- 原有极简短牌提示尚未进一步解释“公共牌A”的限制，AI与结算已采用已确认规则；完整说明可作为后续文案改进。

## 复现工具

`functionalFixtures.ts`生成引擎固定样本；`functionalBrowser.mjs`执行隔离浏览器验收；`functionalExtraFixtures.ts`和`functionalBrowserExtras.mjs`补测普通下注、设置和提示；`functionalUpdateProbe.mjs`验证同一浏览器配置在部署更新前后保留生涯和设置。工具通过PLAYWRIGHT_MODULE使用已提供Playwright，未新增游戏运行时依赖或生产调试接口。

## 修改文件

- `.gitignore`
- `docs/release/FULL-FUNCTIONAL-ACCEPTANCE.md`
- `docs/release/functional-evidence/actions-result.json`
- `docs/release/functional-evidence/live-assets.json`
- `docs/release/functional-evidence/local-chromium-history-and-statistics.png`
- `docs/release/functional-evidence/local-chromium-tournament-STANDARD-human.png`
- `docs/release/functional-evidence/local-results.json`
- `docs/release/functional-evidence/local-webkit-layout-390x844.png`
- `docs/release/functional-evidence/online-chromium-history-statistics.png`
- `docs/release/functional-evidence/online-chromium-mobile.png`
- `docs/release/functional-evidence/online-extra-results.json`
- `docs/release/functional-evidence/online-results.json`
- `docs/release/functional-evidence/online-update-preserved.png`
- `docs/release/functional-evidence/update-result.json`
- `scripts/functionalBrowser.mjs`
- `scripts/functionalBrowserExtras.mjs`
- `scripts/functionalExtraFixtures.ts`
- `scripts/functionalFixtures.ts`
- `scripts/functionalUpdateProbe.mjs`
- `src/App.tsx`
- `src/ai/postflop.ts`
- `src/audio/gameAudio.ts`
- `src/career/careerService.ts`
- `src/career/careerState.ts`
- `src/career/handHistory.ts`
- `src/career/handStats.ts`
- `src/components/ActionPanel/ActionPanel.tsx`
- `src/components/HandReview/HandReview.tsx`
- `src/components/PokerTable/PokerTable.tsx`
- `src/components/PotDisplay/PotDisplay.tsx`
- `src/game/betting.ts`
- `src/pages/History/HistoryPage.tsx`
- `src/pages/TournamentResult/TournamentResultPage.tsx`
- `src/storage/migrations.ts`
- `src/storage/saveSystem.ts`
- `src/store/gameStore.ts`
- `src/styles/theme.css`
- `tests/ai/postflop.test.ts`
- `tests/ai/shortDeckDrawConsistency.test.ts`
- `tests/career/allInSummary.test.ts`
- `tests/career/fullFunctionalStatistics.test.ts`
- `tests/game/callAllInMetadata.test.ts`
- `tests/pwa/pwaAssets.test.ts`
- `tests/storage/handStatsPersistence.test.ts`
- `tests/ui/audioEffects.test.ts`
- `tests/ui/cashBuyIn.test.tsx`
- `tests/ui/fullFunctionalRegression.test.tsx`
- `tests/ui/leaveTableRecovery.test.tsx`
- `tests/ui/selectionMatrix.test.tsx`
- `vite.config.ts`

## 复现命令

先运行 `./node_modules/.bin/vite-node scripts/functionalFixtures.ts`；补充样本使用 `./node_modules/.bin/vite-node scripts/functionalExtraFixtures.ts`。设置 `PLAYWRIGHT_MODULE` 为环境随附Playwright的绝对入口路径后，分别运行：

```bash
node scripts/functionalBrowser.mjs --tag online-check --url https://ywang717.github.io/local-poker-game-v1/
node scripts/functionalBrowserExtras.mjs --tag online-extra-check --url https://ywang717.github.io/local-poker-game-v1/
```

每次使用新的tag保留独立结果；`--resume`仅重试同一tag失败或尚未生成结果的项目；已标记NOT RUN的平台限制保留，不自动重试，也不把它计入PASS。WebKit已知平台离线错误显式记录NOT RUN。不要把新的before更新探针当作已部署旧版存档；本报告的真实旧版更新保留证据来自发布前创建的持久浏览器配置。
