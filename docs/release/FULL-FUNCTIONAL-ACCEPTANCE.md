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
- Cash Buy-in：4文件，26测试 PASS；Tournament：6文件，21测试 PASS。
- Release Smoke：1文件，3测试 PASS；800手AI、600手规则、20场完整锦标赛。大型模拟未加入默认测试或CI。
- Typecheck：PASS；GitHub Pages子路径生产构建：PASS。
- 已有部分React测试仍打印act提示，测试没有失败。

## 浏览器检查

- Chromium使用本机Chrome；WebKit使用独立自动化引擎。桌面1440×900、1280×720，移动390×844、360×800、844×390。
- 完整覆盖：全部7种人数姓名/布局、标准/短牌2/6/9人真实入桌和连续牌局、四下注阶段恢复、补码取消与恢复、金额/全下确认、锦标赛报名/冠军/淘汰/快速模拟、分页/统计详情、备份恢复、音效及暂停。
- 每个可通过用例均检查Console与HTTP错误并保存截图。暂停NORMAL/2X时核对行动历史停止，恢复后继续；INSTANT贯穿实际对局用例。
- 本地浏览器102项：101 PASS、0 FAIL、1 NOT RUN（WebKit离线导航平台限制）。
- 本地最新结果与截图：`functional-evidence/local-results.json`（发布前保存）。
- 线上发布前已确认历史分页缺陷；修复后结果将补入下面发布章节。

## 发布与线上结果

执行中：发布前功能门禁与独立复核完成。待安全推送main、GitHub Actions、Pages部署及线上复测完成后补齐Commit、Actions与版本更新存档验证。

## 限制与未执行项

- WebKit自动化离线导航：NOT RUN。缓存和Service Worker均成功创建，但模拟断网reload在WebKit自动化层报internal error；普通/持久配置、禁网路由复现相同平台问题。未当作通过。Chromium离线刷新已通过。
- 实体iPhone/Android、Windows/Edge及实体扬声器听感：NOT RUN；移动视口与WebKit结果不冒充实体设备验收。
- 超出保留历史、没有公开行动或明确标记的旧事实无法完整追溯修正；迁移只修复可证明的指标，不丢弃更早样本。
- 原有极简短牌提示尚未进一步解释“公共牌A”的限制，AI与结算已采用已确认规则；完整说明可作为后续文案改进。

## 复现工具

`functionalFixtures.ts`生成引擎固定样本；`functionalBrowser.mjs`执行隔离浏览器验收；`functionalUpdateProbe.mjs`验证同一浏览器配置在部署更新前后保留生涯和设置。工具通过PLAYWRIGHT_MODULE使用已提供Playwright，未新增游戏运行时依赖或生产调试接口。
