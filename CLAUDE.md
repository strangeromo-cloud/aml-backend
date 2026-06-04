# CLAUDE.md

本文件briefs 未来的 Claude session。改动前请先读完。

## 这是什么

**AML 付款风险识别系统** — 帮 Legal/合规团队从进行中的付款里识别有洗钱/欺诈风险的付款，形成"识别→调查→裁决→学习"闭环的演示系统。

**不是生产系统**。付款数据是合成的（25 笔）；外部数据源、Hermes 框架、付款冻结都是模拟/待对接。

## 仓库与文件分布（重要 — 分散在两处）

整个系统在**一个仓库**里：`~/Documents/aml-chat-server/` → `github.com/strangeromo-cloud/aml-backend`

| 部分 | 路径 | 性质 |
|---|---|---|
| **前端**（单文件 HTML，所有 UI + 逻辑）| `frontend/AML Identifier Flow Demo-v2.html` | **唯一真源，直接编辑这份**（文件名带 -v2）|
| **后端**（LLM 代理）| `main.py` 等（仓库根）| FastAPI |
| **说明文档** | `docs/AML系统说明文档.md` | 完整业务+技术说明，面向团队/Legal |
| **讲解 PPT** | `ppt/`（构建脚本 + 成品 pptx）| 面向 Legal 的中英文讲解材料，详见下方「PPT 讲解材料」|

- **前端工作流**：直接改 `frontend/AML Identifier Flow Demo-v2.html` 并提交。Downloads 里的同名文件只是双击预览副本 —— 改完仓库版后如需预览再 `cp` 过去。不要反过来以 Downloads 为准。
- 前端是**纯静态单 HTML**，双击即可打开；所有数据、逻辑、i18n 都内联在里面。
- 后端部署在 Zeabur：`https://aml-p.zeabur.app`，推送到 GitHub main 自动重建。
- 前端里硬编码 `const BACKEND_URL = 'https://aml-p.zeabur.app';`

## 核心业务约束（决定了所有设计，别违背）

- 付款量 ~1万/天；真洗钱 <10 起/年；阳性率 ~1/400,000。
- ICAC 不共享检测逻辑；评分因素/权重来自 Legal 经验。
- 已有"准确率 100%"的规则，识别后约 **30% 是真洗钱（PPV）**。
- 推论：① 监督式 ML 不可行（没正样本）② 不能用准确率/召回衡量 ③ 目标是 **Precision@K**（让 Legal 每天能审的 K 笔含金量最高）。

## 检测模型（前端 HTML 内实现）

**双入口 + 三层 Tier**：
- 入口 A（付款级）：4 条高精度规则（银行/营业地国家不一致、付款方/发票国不一致、主营业务≠品类、虚假发票），各 ~30% PPV。
- 入口 B（供应商级）：拆分、突增（原生）+ 高精度多次命中（汇总，是 A 的 roll-up，标"汇总"）。
- Tier：命中**任意 1 条**高精度规则→T1（24h）；否则其供应商有行为信号（拆分/突增/多次命中）→T2（3天）；都没有→T3（加权分排序）。统一队列 = 付款级 T1 + 供应商级 T2（T2 付款由其供应商条目代表，不重复列）。
- **高精度信号"跳出"加权平均，不被稀释** —— 这是核心，别改回纯加权。

**主从评分**：Tier 是主分类；加权分（供应商分40%+ML付款分35%+合理性25%）只在 T3 用。T1/T2 行不显示分数。

## 关键代码锚点（前端 HTML 里搜这些）

| 功能 | 搜索关键字 |
|---|---|
| 数据集 | `const payments =` / `const vendors =` |
| 高精度规则 + Tier | `HIGH_PRECISION_RULES` / `assignPrecisionHits` / `paymentTier` |
| 供应商画像/行为信号 | `computeVendorProfiles` |
| 统一告警队列 | `buildUnifiedQueue`（已排除 `isReviewed` 的付款）|
| 信号台账 PPV | `buildSignalLedger` / `signalHitMap` |
| 每月校准 | `buildCalibration` / `wilson` / `effectiveTier` / `renderCalibration` |
| Agent 自学习 | `AGENT_DISCOVERY` / `discoveryStats` / `addDiscovery` |
| 复核闭环（单一数据源）| `reviewedCases`（含 `conclusion` 字段，驱动 PPV）/ `SEED_REVIEWS` |
| 超时判定 | `isOverdue` / `demoNow`（取数据集最新日期当"今天"）|
| i18n | `const i18n = { en: {...}, zh: {...} }`，每个 key 必须双语 |

## 不变量（改动时务必维持）

1. **真实公司名不出现**（演示数据是虚构供应商名）；任何"确认欺诈"结论只作用于合成数据。
2. **`reviewedCases` 是复核的唯一数据源** —— 同时驱动：已复核列表、首页"已复核"计数、信号台账 PPV。三处必须一致（曾因 reviewRecords/reviewedCases 两套数组不一致导致 25 笔却显示 31 的 bug）。
3. **待复核队列必须排除已复核付款**（`!isReviewed(p)`），否则重复计数。
4. **校准门槛 = 显示门槛 = 4**（`VALIDATE_MIN_REVIEWS` 与 `CALIB_MIN_SAMPLES` 都是 4），否则出现"显示已验证→校准退回待验证"的假变更。
5. **自我进化不能直接改 Tier** —— Agent 发现的信号只能进"候选"，必须走校准（Wilson 下界）+ 人工审批才影响分级。这是合规底线（可解释/可审计）。
6. **每个 i18n key 必须 en + zh 都有**。
7. 改完前端务必跑语法校验（见下）。

## 校准判定逻辑（容易理解错）

按顺序：① 样本 < 4 → 待验证（不下结论）② 样本≥4 且 Wilson 95% 下界 ≥ 8% → 已验证 ③ 样本≥4 且下界 < 8% → 降级。
**先样本关、再 PPV 关**。"降级"是负面判决需足够证据；样本不足宁可观察不冤枉。

## 后端（本目录）

`main.py`（FastAPI）三个端点：
- `POST /api/aml/chat` 一次性问答
- `POST /api/aml/chat/stream` SSE 流式 + reasoning 摘要（OpenAI Responses API）
- `POST /api/aml/investigate/stream` 调查 Agent：`gather_evidence()`【模拟多源取证】+ GPT 综合【真实】

环境变量（Zeabur 上配，本地用 `.env`）：`LLM_API_KEY` `LLM_BASE_URL` `LLM_MODEL`(gpt-5.5) `CORS_ORIGINS=*` `PORT`。
**注意**：`temperature=1` 是硬编码的（gpt-5.x 只接受默认值，别加别的）。
模型凭证复用 `~/Documents/cct/server/.env` 里的（OpenAI 兼容）。

部署：Docker（`Dockerfile` + `zbpack.json`），CMD 用 `python main.py`（读 `PORT` env，别写死端口 — 曾因写死 8080 而 Zeabur 探针打 80 导致 502）。

## 验证前端改动（每次必做）

```bash
cd ~/Documents/aml-chat-server && node -e "
const fs=require('fs');const html=fs.readFileSync('frontend/AML Identifier Flow Demo-v2.html','utf8');
const s=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
try{new Function('async function _(){'+s+'}');console.log('JS OK');}catch(e){console.error('SYNTAX',e.message);process.exit(1);}
"
```
（inline JS 用 async 包裹后用 `new Function` 做语法校验；改完跑一次确认不报错。）

## 验证后端改动

```bash
cd ~/Documents/aml-chat-server && python3 -m py_compile main.py && echo OK
curl -s https://aml-p.zeabur.app/api/health   # 部署后健康检查
```

## PPT 讲解材料（`ppt/`）

面向 Legal 的系统讲解 deck，中英文各一版，用 pptxgenjs 脚本生成。

- 构建脚本：`build-en.js`（英文 9 页）、`build-cn.js`（中文 9 页）当前主用；`build-lite.js`（旧 7 页中文）、`build.js`（旧 12 页）保留参考。
- 脚本生成的成品：`AML-System-Walkthrough-Legal-{EN,CN}.pptx`。
- **用户手改版**：`AML-System-Walkthrough-Legal-{CN,EN}-0604-v2.pptx` 是用户在 PowerPoint 里直接改过的（改了封面标题/日期、删页、加注等）。**这些改动不在构建脚本里，不能用脚本重新生成覆盖**。要给手改版加/改内容，用 **python-pptx 直接编辑该文件**（参考 `add_goals.py`：插入一页、纯形状+文字避免图片关系链问题、再把新页移到目标位置）。
- 9 页结构：封面 / 现状 / 核心转变 / 分级逻辑（按 Tier 分栏）/ 双入口+闭环 / 端到端流程图（3 菱形）/ 自我进化 / 总结（注：用户手改版可能增删，如加了「目标与收益」页）。
- 分级口径须与 demo 一致：命中任意 1 条高精度规则→T1；仅供应商级信号→T2；都没有→T3。改了分级别忘了同步 deck 的 S4 与 demo 的告警队列规则卡（`entryARule`/`entryBRule`）。

依赖与渲染（已装）：`npm i -g pptxgenjs react-icons react react-dom sharp`，python `python-pptx`，渲染用 LibreOffice `soffice` + `pdftoppm`（brew 装）。生成/渲染示例：
```bash
cd ~/Documents/aml-chat-server/ppt && export NODE_PATH=$(npm root -g)
node build-en.js && /opt/homebrew/bin/soffice --headless --convert-to pdf "AML-System-Walkthrough-Legal-EN.pptx" >/dev/null 2>&1
/opt/homebrew/bin/pdftoppm -jpeg -r 130 "AML-System-Walkthrough-Legal-EN.pdf" en   # 转图做视觉 QA
```
脚本里改完文字务必渲染抽查（中文字体 LibreOffice 会回退渲染，不影响成品在 Windows/微软雅黑下的显示）。

## 待对接（生产化）

1. **Nous Hermes Agent**：部署 `NousResearch/hermes-agent`，把调查工具注册为 skills，后端改调自托管实例；其学习循环替换 `discoveryStats()` 模拟。
2. **真实数据源**：天眼查/企查查/Dow Jones API 替换 `gather_evidence()`（接口签名已留）；内部 HR 库 + 账户/受益人图谱。
3. **检测层接真信号**：三国一致性校验、发票校验、付款时序 + 节假日日历。
4. **付款系统**：Hold API（替换"已冻结"模拟标签）、Ariba/LGAP/S4 实时付款数据（替换 25 笔合成）。
5. **工程化**：复核/信号状态落库；万级/天用 function calling + 后端预过滤；校准改月度批处理 + 审批流。

## 千万别做

- 别给前端 HTML 引入构建步骤/框架 — 它是有意做成单文件零依赖的。
- 别把 LLM 当数据库做精确聚合（会错/幻觉）；能用代码算的让代码算。
- 别让任何"自我进化/AI 自动"的东西直接改告警 Tier — 必须过校准+人工闸门。
- 别在 i18n 只加一种语言。
- 别把后端 `temperature` 改成非 1 的值。
