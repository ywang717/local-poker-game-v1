# 锦标赛生涯与起手牌实战胜率验收

日期：2026-10-09。开发基线：49dd53ea8ded18f04b73ba3fed0e7fd660522a10。

## 实现

- 生涯数据分为现金桌与锦标赛；生涯主页可直接打开锦标赛生涯。
- 锦标赛统计保留既有累计指标，新增前三次数及统计起点，最近 500 场结果含模式、等级、日期、名次、费用、奖励、净收益、完成/退出状态及已知冠军。
- 两种生涯分别统计标准德州与短牌起手牌的手数、单独获胜、平分、未获胜。胜率为单独获胜 / 发到该组合次数；弃牌计入未获胜。
- 真人参与的锦标赛手牌以 Hand ID 去重；比赛结果以 Tournament ID 去重。观战不计入手牌统计，锦标赛筹码不计入现金盈利。
- 旧存档加载权威本地手牌历史后才补算明确标记的锦标赛样本，一次性保存标记和统计；保留原累计数据。旧比赛不补造记录，前三及逐场记录从统计起点开始。
- 保留原子生涯/下一手保存流程及 durable-first 顺序。迁移写入失败时仍返回可读生涯并显示警告，下次保存或重载重试。
- 最后一手已结算且只剩一人时，离桌路径先正常结束比赛，避免漏发真人冠军奖励或错误记录为退出。

## 变更文件

README.md；src/App.tsx；src/career/careerService.ts；src/career/careerState.ts；src/career/statistics.ts；src/career/tournamentStatistics.ts；src/pages/Career/CareerPage.tsx；src/pages/Statistics/StatisticsPage.tsx；src/storage/migrations.ts；src/storage/saveSystem.ts；src/styles/theme.css。

测试：tests/career/tournamentCareer.test.ts；tests/career/tournamentStatistics.test.ts；tests/helpers/tournamentSummary.ts；tests/storage/tournamentCareerMigration.test.ts；tests/ui/tournamentCareer.test.tsx。

## 自动验收

- 原基线：63 个测试文件、351 项测试 PASS。
- 默认测试：66 个测试文件、374 项测试 PASS。
- 新增 23 项回归：12 项领域统计/模式/牌型组合/截断/去重，5 项旧存档/备份/刷新/失败重试，6 项页面切换/比赛结果/最后一手离桌/快速模拟。
- AI：21 个文件、132 项 PASS。
- Cash buy-in：4 个文件、26 项 PASS。
- Tournament：6 个文件、21 项 PASS。
- 发布 Smoke：800 手 AI、600 手规则、20 场完整锦标赛，3 项 PASS；引擎错误计数均为 0。未运行无关大型模拟。
- Typecheck：PASS。
- GitHub Pages 子路径构建：PASS，manifest 与 Service Worker 正常生成。

## 浏览器验收

使用真实 Chromium 点击创建生涯、报名标准德州锦标赛、完成一手、离桌、查看结果和锦标赛生涯，再刷新检查手牌/比赛没有重复累计。验证现金桌和规则模式切换。

1280×720、390×844、320×568、844×390：页面宽度未超出视口；页签按钮均至少 44px；窄屏胜率表显示为卡片，比赛记录为单列。控制台错误 0、失败资源请求 0。未在实体 iPhone/Android 或 Safari 上运行本次验收。

## 限制及发布

旧历史最多只能恢复设备现存的样本，不能还原已删除记录；前三次数和逐场比赛记录不会被伪造为完整历史。沿用 saveVersion 2，新增字段通过兼容标记初始化。

测试仍有既有 React act 警告，不影响通过；未修改依赖或扩大本次范围。npm ci 仍报告既有 3 项开发工具链漏洞（1 moderate、2 critical），本次依赖保持不变。发布由 main 推送触发 GitHub Actions，并在最终回复提供部署证据。
