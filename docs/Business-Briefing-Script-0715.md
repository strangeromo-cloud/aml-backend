# AML Payment Monitoring — Business Alignment & Demo Briefing Script (2026-07-15)

> Flow: rule clarifications first (Legal's home turf) → DJ dependency (decision while everyone's in the room) → demo last (product add/remove decisions, flexible timing).

---

## English Version

### Opening (1 min)

Good morning/afternoon everyone. Today I'd like to do three things in about 40 minutes:
First, walk through the open points on the rule sheet — these are your rules, and we need your call on a handful of field-level details before we can build them. Second, one important data-source decision that affects what we can deliver within this project — I want to settle it while everyone is in the room. And third, as a reward for the hard work, a live demo of the system — there I'll need your "keep / add / remove" calls on the product itself.

Whenever I pause on a question, a simple "need it / don't need it / decide later" is all I need — we record everything and it becomes the frozen baseline for development.

### Part 1 — Rule clarifications from the updated sheet (12 min)

We updated the rule workbook (version 07-15). Seven points, each with our written proposal — please confirm or correct:

1. **CPI threshold.** We attached the full Corruption Perceptions Index table. Our proposal: **score below 31 counts as high-risk**. Please confirm the cut-off.
2. **Offshore / tax-haven routing.** Our systems only capture the shipment's start and end points (ship-from / ship-to), not the full transit route. Proposal: check the **endpoints, ship-to in particular**, against the offshore list. Please confirm endpoints-only is acceptable, and confirm the offshore list source.
3. **Invoice origin (one of the 100%-accuracy rules).** "Origin" needs to be pinned to a specific field: issuer address country, tax-ID country, or remit-to country. Also note: Ariba invoices are structured data; LGAP invoices are attachments that may need OCR — please confirm OCR-based checking is acceptable there.
4. **Weekend / holiday payments.** Two decisions: (a) which date — we propose the **actual payment execution date** from the finance system, not request or invoice dates; (b) **whose calendar** — the vendor's registration country, place of business, invoice country, or bank country?
5. **Fake invoice.** We need a working definition of "fake" at our stage, split by region. Good news: for China, invoice verification is already integrated in the AP process; overseas coverage is partially done or in progress. Proposal: consume the AP verification result where it exists, and add duplicate-number / sequential-number / template-anomaly checks on top. Please confirm whether the soft checks still qualify for T1.
6. **Third-party receiving account.** On hold pending DT's confirmation of whether LGAP already blocks this at the source. If it's controlled there, we drop the check.
7. **Cross-rule conventions.** Amounts converted to USD at payment-date FX; the 24-hour T1 window in calendar days — please confirm both.

### Part 2 — The Dow Jones dependency (5 min — the key decision of the day)

Before we move to the demo, this is the most important message today, and I'd like to settle it now while everyone is here.

Six of the checks on the sheet depend on **Dow Jones data** for overseas counterparties: criminal/civil proceedings, PEP screening, principal place of business, registered capital and company background, business-scope verification, and account-affiliation checks.

**If Dow Jones access is not in place before this project ends, those checks cannot be delivered. What we can deliver is the public-list checks only** — CPI, sanctions lists, FATF black/grey lists, the offshore list — plus everything that runs purely on our in-house data.

So two asks:
1. **Please confirm the timeline for Dow Jones licensing/access.** If it lands in time, we build the full scope.
2. **If it will not land in time, we need your sign-off on the reduced Phase-1 scope** — public lists + in-house rules now, DJ-dependent checks as Phase 2 when access arrives. We'd rather agree on this openly today than discover it at delivery.

### Part 3 — Demo & product decisions (15 min)

Now the demo. Everything you just confirmed is what runs underneath these screens — here I need your "keep / add / remove" calls on the product.

**[Show dashboard]** This is the daily view. Every payment flows in from our procurement and payment systems and is checked against the rules we just discussed.

**[Show alert queue]** The core design is a three-tier model:

- **T1** — a payment hits any single one of the four high-precision rules — bank/business country mismatch, payer/invoice origin mismatch, business scope vs PO category, fake invoice. One hit is enough. These come with a **24-hour review countdown**.
- **T2** — no hard hit, but the vendor shows a behavioral pattern: structuring, payment surge, or repeated hits. These get a **3-day window**.
- **T3** — everything else, ranked by a weighted risk score. No deadline — reviewed as capacity allows.

**First question: does this triage model match how you want to work?** (a) is "any single high-precision hit = T1" the right bar? (b) are 24 hours and 3 days realistic given your team size? (c) anything you'd move between tiers?

Then five product decisions — I'll pause on each screen:

1. **Notification email.** Immediate email per T1 alert, a daily digest for everything, both, or none — work inside the system only. Which do you want, and who should be on the distribution list?
2. **System access & permissions.** Our proposal: Legal reviewers get "view + investigate + submit verdict"; a Legal admin role additionally sees calibration and can adjust thresholds; optionally a read-only role for management. Who needs access, and are these role levels right?
3. **List filters.** Currently: time range, risk level, rule type, vendor, keyword. Which do you actually use day-to-day? Anything missing — amount range, country, specific rule hit?
4. **Export.** Do you need to export the alert list and review records to Excel — for audit or reporting? If yes: which columns, and should export be restricted to certain roles?
5. **Dashboard.** Currently: totals, tier distribution, top-risk list, trends. What would you actually check daily or weekly? Equally important — what would you never look at, so we can remove it?

### Closing (2 min)

To summarize, the decisions we'd like to leave with today:
- Seven rule clarifications, CPI cut-off first
- The Dow Jones decision: confirm the timeline, or approve the phased scope
- Tier model confirmation (T1/T2/T3, thresholds, time windows)
- Five product decisions: email, permissions, filters, export, dashboard

Everything we agree today goes into the workbook as the frozen baseline for development. Thank you — over to your questions.

---

## 中文版本

### 开场（1 分钟）

各位好。今天大约用 40 分钟做三件事：
第一，过一遍规则表上的待澄清点 —— 规则是各位定的，有几处字段级细节需要各位拍板，我们才能动手开发；第二，一个影响项目交付范围的数据源决定，趁大家都在，现场把它定下来；第三，作为对前面辛苦的犒劳，现场演示系统 —— 在那个环节需要各位对产品本身给出"保留 / 增加 / 去掉"的判断。

每到提问点，只需要给我"要 / 不要 / 回头定"三选一，全程记录，会后作为开发的冻结基线。

### 第一部分 —— 规则表（07-15 版）待澄清点（12 分钟）

规则工作簿已更新到 07-15 版。七个点，每个都写好了我们的建议 —— 请确认或纠正：

1. **CPI 阈值。** 表里附了完整的清廉指数表。建议：**分数低于 31 算高风险**。请确认这个切线。
2. **离岸/避税天堂中转。** 系统只能拿到运输的起点和终点（ship-from / ship-to），拿不到完整路径。建议：用**终点（ship-to）为主的两端**去撞离岸名单。请确认"只查两端"可接受，并确认离岸名单来源。
3. **发票开具地**（100% 准确率规则之一）。"开具地"必须钉到具体字段：开票方地址国、税号归属国、还是汇款地址国？另外：Ariba 发票是结构化数据，LGAP 发票是附件、可能需要 OCR —— 请确认 LGAP 部分接受 OCR 判读。
4. **周末/节假日付款。** 两个决定：(a) 以哪个日期为准 —— 我们建议用财务系统里的**实际付款执行日**，不用申请日/发票日；(b) 按**谁的日历** —— 供应商注册国、实际经营国、发票国、还是收款银行国？
5. **虚假发票。** 需要一个现阶段可执行的"虚假"定义，中外分开。好消息：**中国区发票验证已在 AP 流程打通**，海外部分国家已完成或进行中。建议：有 AP 验证结果的直接取用，另加发票号重复/连号/模板异常三项检查。请确认软判据是否仍算 T1。
6. **第三方收款账户。** 等 DT 确认 LGAP 是否已在源头管控 —— 若已管控，此条移除。
7. **通用口径。** 金额按付款日汇率折算 USD；T1 的 24 小时按自然日 —— 请确认。

### 第二部分 —— Dow Jones 依赖（5 分钟 —— 今天最关键的决定）

在进入演示之前，这是今天最重要的一条，趁各位都在场，现在把它定下来。

规则表里有**六项检查依赖 Dow Jones 数据**（针对海外交易对手）：刑事/民事诉讼、PEP 筛查、主要经营地、注册资本与公司背景、经营范围核验、账户关联关系。

**如果项目结束之前 Dow Jones 无法使用，这些检查全部无法交付。届时我们能交付的只有公开名单类检查** —— CPI、制裁名单、FATF 黑/灰名单、离岸名单 —— 加上纯内部数据就能跑的规则。

所以两个请求：
1. **请确认 Dow Jones 采购/开通的时间线。** 赶得上，我们按完整范围建设。
2. **如果确定赶不上，请今天认可分期方案** —— 一期：公开名单 + 内部数据规则；二期：DJ 到位后补齐相关检查。我们宁愿今天把这个边界摆在桌面上，也不要到交付时才发现。

### 第三部分 —— Demo 与产品决策（15 分钟）

现在进入演示。刚才各位确认的所有规则，就是这些界面底下真正在跑的东西 —— 这个环节需要各位对产品给出"保留 / 增加 / 去掉"。

**【展示首页】** 这是日常视图。每笔付款从采购和付款系统流入，按刚才讨论的规则自动检查。

**【展示告警队列】** 核心设计是三级分层：

- **T1** —— 命中四条高精度规则中**任意一条**：银行/营业地国别不一致、付款方/发票开具地不一致、主营业务与采购品类不符、虚假发票。一条即进 T1，带 **24 小时复核倒计时**。
- **T2** —— 没有硬命中，但供应商出现行为模式：拆分付款、付款突增、多次命中。**3 天窗口**。
- **T3** —— 其余全部按加权风险分排序，无硬性时限，余力复核。

**第一个问题：这个分诊模型符合各位的工作方式吗？** (a) "命中任意一条即 T1"这个标准对吗？(b) 按团队人力，24 小时和 3 天现实吗？(c) 有没有想在层级之间挪动的？

然后五个产品决策，每个界面停一下当场收答案：

1. **通知邮件。** T1 即时单发、全量每日摘要、两者都要、或都不要（只在系统内处理）。要哪种？收件人名单是谁？
2. **系统权限。** 建议：法务复核员 = 查看+调查+提交结论；法务管理员额外可见校准页、可调阈值；可选给管理层只读角色。哪些人需要账号？角色划分这样行吗？
3. **列表筛选。** 目前支持：时间范围、风险等级、规则类型、供应商、关键词。日常真正用得上的是哪些？缺什么 —— 金额区间、国家、按具体规则筛？
4. **导出。** 需要把告警列表和复核记录导出 Excel 吗（审计、汇报用）？如果要：导哪些列？是否限制角色？
5. **Dashboard。** 目前展示总量、分层分布、高风险榜、趋势。各位每天/每周实际会看什么？同样重要 —— 哪些永远不会看，我们好删掉？

### 收尾（2 分钟）

总结一下今天希望带走的决定：
- 七个规则澄清点，CPI 切线优先
- Dow Jones 决定：确认时间线，或批准分期范围
- 分层模型确认（T1/T2/T3、标准、时限）
- 五个产品决策：邮件、权限、筛选、导出、Dashboard

今天确认的所有内容会回写进工作簿，作为开发的冻结基线。谢谢大家，下面进入提问。
