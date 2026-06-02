const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa");

// ---------- palette (matches the product) ----------
const NAVY = "102C3A", INK = "17313F", TEAL = "1BA39C", TEAL2 = "37B7AD";
const MUTED = "71838F", LINE = "DCE8EE", PANEL = "F4FAFB", WHITE = "FFFFFF";
const RED = "D84B4B", AMBER = "C9861A", GREEN = "22875A", SLATE = "5D8AA8";
const FONT = "Microsoft YaHei", FONT_L = "Microsoft YaHei Light";

const pres = new pptxgen();
pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pres.layout = "W";
pres.author = "AML Risk System";
pres.title = "AML 付款风险识别系统";
const W = 13.333, H = 7.5;

// ---------- icon helper ----------
async function icon(IconComp, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(IconComp, { color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
const sh = () => ({ type: "outer", color: "0B1F2A", blur: 9, offset: 3, angle: 135, opacity: 0.16 });

// reusable building blocks
function pageNum(slide, n) {
  slide.addText(String(n).padStart(2, "0"), { x: W - 0.9, y: H - 0.5, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: "right" });
  slide.addText("AML 付款风险识别系统", { x: 0.6, y: H - 0.5, w: 5, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED });
}
function kicker(slide, text, color = TEAL) {
  slide.addText(text, { x: 0.6, y: 0.5, w: 8, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color, charSpacing: 3 });
}
function title(slide, text, opts = {}) {
  slide.addText(text, { x: 0.6, y: 0.82, w: 12.1, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: opts.color || INK, ...opts });
}

(async () => {
  const ic = {};
  const need = {
    bolt: Fa.FaBolt, layer: Fa.FaLayerGroup, search: Fa.FaSearchengin || Fa.FaSearch, robot: Fa.FaRobot,
    seed: Fa.FaSeedling, chart: Fa.FaChartLine, shield: Fa.FaShieldAlt, sync: Fa.FaSyncAlt,
    users: Fa.FaUsers, gavel: Fa.FaGavel, flag: Fa.FaFlag, brain: Fa.FaBrain,
    list: Fa.FaListUl, scale: Fa.FaBalanceScale, lock: Fa.FaLock, check: Fa.FaCheckCircle,
    arrow: Fa.FaArrowRight, clock: Fa.FaClock, db: Fa.FaDatabase, eye: Fa.FaEye, route: Fa.FaProjectDiagram
  };
  for (const k in need) ic[k] = await icon(need[k], "#FFFFFF");
  const icTeal = {};
  for (const k of ["bolt","layer","search","robot","seed","chart","shield","sync","gavel","brain","scale","route"]) icTeal[k] = await icon(need[k], "#1BA39C");

  // ============ SLIDE 1 — 封面 ============
  let s = pres.addSlide();
  s.background = { color: NAVY };
  // motif: teal arc band
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: TEAL } });
  s.addShape(pres.shapes.OVAL, { x: W - 4.2, y: -2.4, w: 6.5, h: 6.5, fill: { color: TEAL2, transparency: 82 }, line: { type: "none" } });
  s.addShape(pres.shapes.OVAL, { x: W - 2.6, y: 2.6, w: 5, h: 5, fill: { color: TEAL, transparency: 88 }, line: { type: "none" } });
  s.addText("AML", { x: 0.9, y: 1.5, w: 2.4, h: 1.1, fontFace: FONT, fontSize: 40, bold: true, color: NAVY, align: "center", valign: "middle", fill: { color: TEAL }, rectRadius: 0.2 });
  s.addText("付款风险识别系统", { x: 0.9, y: 2.85, w: 11, h: 1.0, fontFace: FONT, fontSize: 46, bold: true, color: WHITE });
  s.addText("从「整体评分」到「分级告警 + 自我进化」的产品演进", { x: 0.92, y: 3.95, w: 11, h: 0.6, fontFace: FONT, fontSize: 20, color: "AECDD6" });
  s.addText([
    { text: "面向法务团队的系统讲解", options: { breakLine: true } },
    { text: "识别风险 · 解释依据 · 收集反馈 · 持续进化", options: {} }
  ], { x: 0.92, y: 5.5, w: 11, h: 1, fontFace: FONT, fontSize: 14, color: "8FB2BD", lineSpacingMultiple: 1.3 });

  // ============ SLIDE 2 — 我们面对的现实 ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "我们面对的现实");
  title(s, "海量付款里，找极少数的洗钱");
  const stats = [
    { v: "≈ 1 万", l: "笔付款 / 每天", sub: "全年约 365 万笔", c: TEAL },
    { v: "< 10", l: "起真实洗钱 / 每年", sub: "阳性率约 1/40 万", c: RED },
    { v: "30%", l: "高精度规则命中后\n确实是洗钱 (PPV)", sub: "行业稀缺优势", c: GREEN },
  ];
  stats.forEach((st, i) => {
    const x = 0.6 + i * 4.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.0, w: 3.8, h: 2.15, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
    s.addText(st.v, { x: x + 0.2, y: 2.2, w: 3.4, h: 0.95, fontFace: FONT, fontSize: 44, bold: true, color: st.c });
    s.addText(st.l, { x: x + 0.22, y: 3.18, w: 3.4, h: 0.6, fontFace: FONT, fontSize: 14, bold: true, color: INK, lineSpacingMultiple: 1.0 });
    s.addText(st.sub, { x: x + 0.22, y: 3.74, w: 3.4, h: 0.3, fontFace: FONT, fontSize: 11, color: MUTED });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 4.55, w: 12.13, h: 1.55, fill: { color: NAVY }, rectRadius: 0.12 });
  s.addText("由此推导出的结论", { x: 0.9, y: 4.72, w: 11, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 2 });
  s.addText([
    { text: "传统机器学习不可行", options: { bold: true, color: WHITE } },
    { text: "（一年凑不出 10 个样本）    ", options: { color: "AECDD6" } },
    { text: "不能用准确率衡量", options: { bold: true, color: WHITE } },
    { text: "（不知道漏了多少）    ", options: { color: "AECDD6" } },
    { text: "目标改为：让法务每天能审的那几十笔，含金量最高", options: { bold: true, color: TEAL2 } },
  ], { x: 0.9, y: 5.15, w: 11.5, h: 0.8, fontFace: FONT, fontSize: 14.5, lineSpacingMultiple: 1.2 });
  pageNum(s, 2);

  // ============ SLIDE 3 — 核心转变 before/after ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "产品形态的核心转变");
  title(s, "从「算一个总分」到「分级告警」");
  // BEFORE card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.0, w: 5.55, h: 4.4, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
  s.addText("原有逻辑", { x: 0.95, y: 2.2, w: 4.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: MUTED, charSpacing: 2 });
  s.addText("整体加权评分", { x: 0.95, y: 2.6, w: 4.9, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: INK });
  s.addText([
    { text: "供应商分 × 40% + 付款分 × 35% + 合理性 × 25%", options: { breakLine: true, color: INK, bold: true } },
    { text: "→ 算出 0–100 的总分，按高/中/低排序", options: { breakLine: true, color: MUTED } },
  ], { x: 0.95, y: 3.2, w: 4.9, h: 0.9, fontFace: FONT, fontSize: 12.5, lineSpacingMultiple: 1.25 });
  s.addText("痛点", { x: 0.95, y: 4.25, w: 4.5, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: RED });
  s.addText([
    { text: "强信号被「平均」稀释", options: { bullet: true, breakLine: true, bold: true } },
    { text: "一笔命中 2 条 30% 命中率硬规则的付款，被其它正常维度一平均就沉底了", options: { bullet: { indent: 12 }, breakLine: true, color: MUTED } },
    { text: "高/中/低 难以对应「该多急去看」", options: { bullet: true } },
  ], { x: 1.0, y: 4.6, w: 4.95, h: 1.7, fontFace: FONT, fontSize: 12, color: INK, lineSpacingMultiple: 1.15, paraSpaceAfter: 4 });
  // arrow
  s.addImage({ data: ic.arrow, x: 6.35, y: 3.95, w: 0.62, h: 0.62 });
  // AFTER card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.18, y: 2.0, w: 5.55, h: 4.4, fill: { color: NAVY }, rectRadius: 0.12, shadow: sh() });
  s.addText("新形态", { x: 7.53, y: 2.2, w: 4.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 2 });
  s.addText("分级告警 (Tier)", { x: 7.53, y: 2.6, w: 4.9, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: WHITE });
  const tiers = [["T1", "紧急 · 24 小时内复核", RED], ["T2", "告警 · 3 天内复核", AMBER], ["T3", "评分 · 批量排序", SLATE]];
  tiers.forEach((t, i) => {
    const y = 3.25 + i * 0.72;
    s.addText(t[0], { x: 7.53, y, w: 0.95, h: 0.55, fontFace: FONT, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle", fill: { color: t[2] }, rectRadius: 0.08 });
    s.addText(t[1], { x: 8.62, y, w: 4.0, h: 0.55, fontFace: FONT, fontSize: 14, color: "DDEBEF", valign: "middle" });
  });
  s.addText("强信号「跳出」平均池，命中即定级、直接置顶", { x: 7.53, y: 5.65, w: 5.0, h: 0.6, fontFace: FONT, fontSize: 12.5, italic: true, color: TEAL2, lineSpacingMultiple: 1.15 });
  pageNum(s, 3);

  // ============ SLIDE 4 — 为什么要变（稀释示例）============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "为什么必须转变");
  title(s, "加权平均会「淹没」最关键的信号");
  s.addText("同一笔可疑付款，两种算法的结局", { x: 0.6, y: 1.75, w: 11, h: 0.4, fontFace: FONT, fontSize: 15, color: MUTED });
  // example payment chips
  const dims = [["命中 2 条硬规则", "高度可疑", RED], ["供应商基础分", "偏低", GREEN], ["其它维度", "正常", GREEN]];
  dims.forEach((d, i) => {
    const x = 0.6 + i * 2.4;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.35, w: 2.2, h: 1.0, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
    s.addText(d[0], { x: x + 0.12, y: 2.5, w: 1.96, h: 0.4, fontFace: FONT, fontSize: 11.5, bold: true, color: INK, align: "center" });
    s.addText(d[1], { x: x + 0.12, y: 2.9, w: 1.96, h: 0.35, fontFace: FONT, fontSize: 11, color: d[2], align: "center" });
  });
  // outcome rows
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 3.85, w: 12.13, h: 1.1, fill: { color: "FBEEEE" }, line: { color: "F0C9C9", width: 1 }, rectRadius: 0.1 });
  s.addText("✕", { x: 0.85, y: 4.05, w: 0.6, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: RED, align: "center", valign: "middle" });
  s.addText([{ text: "加权平均：", options: { bold: true, color: RED } }, { text: "强信号被正常维度平均掉 → 总分中等 → 排在队伍后面 → 可能没人看", options: { color: INK } }], { x: 1.6, y: 3.95, w: 10.9, h: 0.9, fontFace: FONT, fontSize: 15, valign: "middle", lineSpacingMultiple: 1.1 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.1, w: 12.13, h: 1.1, fill: { color: "E9F6EF" }, line: { color: "BFE3CE", width: 1 }, rectRadius: 0.1 });
  s.addText("✓", { x: 0.85, y: 5.3, w: 0.6, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: GREEN, align: "center", valign: "middle" });
  s.addText([{ text: "分级告警：", options: { bold: true, color: GREEN } }, { text: "命中 2 条硬规则 → 直接判定 T1 紧急 → 置顶 → 24 小时内必看", options: { color: INK } }], { x: 1.6, y: 5.2, w: 10.9, h: 0.9, fontFace: FONT, fontSize: 15, valign: "middle", lineSpacingMultiple: 1.1 });
  pageNum(s, 4);

  // ============ SLIDE 5 — 双入口 ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "怎么发现风险");
  title(s, "两个入口，一份统一告警清单");
  const cardA = { x: 0.6, y: 2.0, w: 5.95, h: 3.0 };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { ...cardA, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
  s.addShape(pres.shapes.OVAL, { x: 0.85, y: 2.25, w: 0.6, h: 0.6, fill: { color: TEAL } });
  s.addImage({ data: ic.bolt, x: 0.97, y: 2.37, w: 0.36, h: 0.36 });
  s.addText("入口 A · 付款级", { x: 1.6, y: 2.25, w: 4.7, h: 0.6, fontFace: FONT, fontSize: 17, bold: true, color: INK, valign: "middle" });
  s.addText([
    { text: "单笔交易命中「高精度硬规则」", options: { breakLine: true, color: MUTED, italic: true } },
    { text: "银行 / 营业地国家不一致", options: { bullet: true, breakLine: true } },
    { text: "付款方 / 发票来源国不一致", options: { bullet: true, breakLine: true } },
    { text: "主营业务 ≠ 采购品类", options: { bullet: true, breakLine: true } },
    { text: "虚假发票特征", options: { bullet: true } },
  ], { x: 1.0, y: 2.95, w: 5.3, h: 1.95, fontFace: FONT, fontSize: 12.5, color: INK, lineSpacingMultiple: 1.18, paraSpaceAfter: 3 });

  const cardB = { x: 6.78, y: 2.0, w: 5.95, h: 3.0 };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { ...cardB, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
  s.addShape(pres.shapes.OVAL, { x: 7.03, y: 2.25, w: 0.6, h: 0.6, fill: { color: AMBER } });
  s.addImage({ data: ic.layer, x: 7.15, y: 2.37, w: 0.36, h: 0.36 });
  s.addText("入口 B · 供应商级", { x: 7.78, y: 2.25, w: 4.7, h: 0.6, fontFace: FONT, fontSize: 17, bold: true, color: INK, valign: "middle" });
  s.addText([
    { text: "聚合一个供应商的多笔付款才看得出", options: { breakLine: true, color: MUTED, italic: true } },
    { text: "拆分付款（化整为零，多笔小额）", options: { bullet: true, breakLine: true } },
    { text: "付款突增（对新供应商频率激增）", options: { bullet: true, breakLine: true } },
    { text: "高精度规则多次命中（汇总）", options: { bullet: true } },
  ], { x: 7.18, y: 2.95, w: 5.3, h: 1.95, fontFace: FONT, fontSize: 12.5, color: INK, lineSpacingMultiple: 1.18, paraSpaceAfter: 3 });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.25, w: 12.13, h: 1.0, fill: { color: NAVY }, rectRadius: 0.12 });
  s.addText([
    { text: "关键价值：", options: { bold: true, color: TEAL2 } },
    { text: "入口 A 抓单笔异常，入口 B 抓「拆分 / 突增」这类只有跨笔才看得见的洗钱手法 —— 两者合并成法务的一份工作清单。", options: { color: "DDEBEF" } },
  ], { x: 0.9, y: 5.4, w: 11.5, h: 0.7, fontFace: FONT, fontSize: 13.5, valign: "middle", lineSpacingMultiple: 1.15 });
  pageNum(s, 5);

  // ============ SLIDE 6 — 完整闭环 ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "系统怎么运转");
  title(s, "一个会「越用越准」的闭环");
  const loop = [
    ["检测 + 定级", "双入口 → Tier 分级", icTeal.bolt],
    ["AI 调查", "自动多源取证 + 综合建议", icTeal.search],
    ["法务裁决", "看证据、定结论", icTeal.gavel],
    ["持续学习", "测真实命中率、发现新信号", icTeal.chart],
  ];
  loop.forEach((b, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.35, w: 2.7, h: 2.25, fill: { color: WHITE }, line: { color: LINE, width: 1.2 }, rectRadius: 0.12, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: x + 1.0, y: 2.6, w: 0.7, h: 0.7, fill: { color: PANEL }, line: { color: TEAL, width: 1.5 } });
    s.addImage({ data: b[2], x: x + 1.14, y: 2.74, w: 0.42, h: 0.42 });
    s.addText("0" + (i + 1), { x: x + 0.15, y: 2.5, w: 0.6, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: TEAL });
    s.addText(b[0], { x: x + 0.1, y: 3.45, w: 2.5, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: INK, align: "center" });
    s.addText(b[1], { x: x + 0.12, y: 3.9, w: 2.46, h: 0.6, fontFace: FONT, fontSize: 11.5, color: MUTED, align: "center", lineSpacingMultiple: 1.1 });
    if (i < 3) s.addImage({ data: ic.arrow, x: x + 2.74, y: 3.25, w: 0.32, h: 0.32 });
  });
  // feedback arrow
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.05, w: 12.13, h: 1.15, fill: { color: PANEL }, line: { color: TEAL, width: 1.2, dashType: "dash" }, rectRadius: 0.12 });
  s.addImage({ data: icTeal.sync, x: 0.9, y: 5.35, w: 0.5, h: 0.5 });
  s.addText([
    { text: "回流校准：", options: { bold: true, color: TEAL } },
    { text: "法务的每一次复核都被结构化沉淀，反过来校准「该看谁、多急」—— 这就是系统越用越准的燃料。", options: { color: INK } },
  ], { x: 1.6, y: 5.15, w: 10.9, h: 0.95, fontFace: FONT, fontSize: 13.5, valign: "middle", lineSpacingMultiple: 1.15 });
  pageNum(s, 6);

  // ============ SLIDE 7 — 创新点导览 ============
  s = pres.addSlide(); s.background = { color: NAVY };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.14, fill: { color: TEAL } });
  s.addText("三个核心创新", { x: 0.6, y: 0.55, w: 8, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 3 });
  s.addText("让系统从「静态规则」走向「会进化的助手」", { x: 0.6, y: 1.0, w: 12, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: WHITE });
  const innov = [
    ["01", "AI 调查 Agent", "自动多源取证，把每件调查\n从 1 小时压缩到几分钟", icTeal.robot],
    ["02", "自我进化", "Agent 从经验中发现\n规则集里还没有的新信号", icTeal.brain],
    ["03", "信号台账 + 校准", "每个信号靠真实命中率\n自动升级 / 降级", icTeal.scale],
  ];
  innov.forEach((b, i) => {
    const x = 0.6 + i * 4.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.4, w: 3.8, h: 3.6, fill: { color: "16384A" }, line: { color: "29516A", width: 1 }, rectRadius: 0.14 });
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 2.75, w: 0.95, h: 0.95, fill: { color: TEAL } });
    s.addImage({ data: ic[["robot","brain","scale"][i]], x: x + 0.57, y: 2.97, w: 0.51, h: 0.51 });
    s.addText(b[0], { x: x + 2.5, y: 2.7, w: 1.1, h: 0.7, fontFace: FONT, fontSize: 34, bold: true, color: "29516A", align: "right" });
    s.addText(b[1], { x: x + 0.35, y: 3.95, w: 3.2, h: 0.5, fontFace: FONT, fontSize: 18, bold: true, color: WHITE });
    s.addText(b[2], { x: x + 0.37, y: 4.5, w: 3.25, h: 1.2, fontFace: FONT, fontSize: 13, color: "AECDD6", lineSpacingMultiple: 1.2 });
  });
  pageNum(s, 7);

  // ============ SLIDE 8 — 创新1：调查 Agent ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "创新 ① · AI 调查 Agent");
  title(s, "AI 取证，法务定论");
  // left flow
  const steps = [
    ["自动路由数据源", "中国主体 → 企查查 / 天眼查；境外 → Dow Jones"],
    ["多源取证", "股东背景、制裁名单、PEP、不利媒体、资金路径"],
    ["AI 综合", "交叉比对证据，生成一份「调查结论包」"],
    ["给出建议 + 预填", "升级 / 补证 / 放行，并预填复核表单"],
  ];
  steps.forEach((st, i) => {
    const y = 2.05 + i * 1.0;
    s.addShape(pres.shapes.OVAL, { x: 0.65, y, w: 0.62, h: 0.62, fill: { color: TEAL } });
    s.addText(String(i + 1), { x: 0.65, y, w: 0.62, h: 0.62, fontFace: FONT, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle" });
    if (i < 3) s.addShape(pres.shapes.LINE, { x: 0.96, y: y + 0.62, w: 0, h: 0.38, line: { color: TEAL, width: 1.5, dashType: "dash" } });
    s.addText(st[0], { x: 1.5, y: y - 0.02, w: 6.4, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: INK });
    s.addText(st[1], { x: 1.5, y: y + 0.36, w: 6.4, h: 0.5, fontFace: FONT, fontSize: 12, color: MUTED, lineSpacingMultiple: 1.05 });
  });
  // right value card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.4, y: 2.05, w: 4.33, h: 3.95, fill: { color: NAVY }, rectRadius: 0.14, shadow: sh() });
  s.addImage({ data: ic.robot, x: 8.75, y: 2.4, w: 0.6, h: 0.6 });
  s.addText("为什么有用", { x: 9.5, y: 2.45, w: 3, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: WHITE, valign: "middle" });
  s.addText([
    { text: "效率", options: { bold: true, color: TEAL2, breakLine: true } },
    { text: "每件调查从 1 小时 → 几分钟，法务能审的量级大幅提升", options: { color: "DDEBEF", breakLine: true } },
    { text: "", options: { breakLine: true, fontSize: 6 } },
    { text: "质量", options: { bold: true, color: TEAL2, breakLine: true } },
    { text: "每次调查都产出标准化、带证据链的记录，反哺系统学习", options: { color: "DDEBEF" } },
  ], { x: 8.75, y: 3.2, w: 3.7, h: 2.6, fontFace: FONT, fontSize: 13, lineSpacingMultiple: 1.2 });
  s.addText("注：人始终做最终判断，AI 只负责取证与建议。", { x: 0.65, y: 6.2, w: 12, h: 0.35, fontFace: FONT, fontSize: 11.5, italic: true, color: MUTED });
  pageNum(s, 8);

  // ============ SLIDE 9 — 创新2：自我进化 ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "创新 ② · 自我进化（Hermes Agent）");
  title(s, "系统会自己「发现」新风险信号");
  s.addText("过去：风险信号全靠法务凭经验预先定义。现在：Agent 从积累的案例中主动提出新假设。", { x: 0.6, y: 1.75, w: 12, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED, lineSpacingMultiple: 1.1 });
  // pipeline: discover -> candidate -> calibrate -> approve -> affect tier
  const pipe = [
    ["Agent 发现", "从已确认欺诈案例\n学出反复出现的新模式", TEAL, "brain"],
    ["进入候选", "标记「待验证」\n先观察、不直接告警", AMBER, "eye"],
    ["统计校准", "用真实命中率验证\n（足够样本 + 达标）", SLATE, "scale"],
    ["人工审批", "委员会签字\n才正式生效", GREEN, "gavel"],
  ];
  pipe.forEach((b, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.5, w: 2.7, h: 2.0, fill: { color: PANEL }, line: { color: b[2], width: 1.5 }, rectRadius: 0.12 });
    s.addShape(pres.shapes.OVAL, { x: x + 1.0, y: 2.72, w: 0.7, h: 0.7, fill: { color: b[2] } });
    s.addImage({ data: ic[b[3]], x: x + 1.14, y: 2.86, w: 0.42, h: 0.42 });
    s.addText(b[0], { x: x + 0.1, y: 3.5, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 14.5, bold: true, color: INK, align: "center" });
    s.addText(b[1], { x: x + 0.12, y: 3.9, w: 2.46, h: 0.55, fontFace: FONT, fontSize: 10.8, color: MUTED, align: "center", lineSpacingMultiple: 1.05 });
    if (i < 3) s.addImage({ data: ic.arrow, x: x + 2.74, y: 3.35, w: 0.32, h: 0.32 });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 4.95, w: 12.13, h: 1.3, fill: { color: "FFF6E8" }, line: { color: "F0D8A8", width: 1.2 }, rectRadius: 0.12 });
  s.addImage({ data: await icon(Fa.FaLock, "#C9861A"), x: 0.95, y: 5.32, w: 0.5, h: 0.5 });
  s.addText([
    { text: "合规底线：", options: { bold: true, color: AMBER } },
    { text: "自我进化只能「发现假设」，绝不能黑盒改告警等级。任何影响分级的变更，都必须经过可审计的统计校准 + 人工审批。", options: { color: INK } },
  ], { x: 1.65, y: 5.05, w: 10.8, h: 1.1, fontFace: FONT, fontSize: 13.5, valign: "middle", lineSpacingMultiple: 1.2 });
  pageNum(s, 9);

  // ============ SLIDE 10 — 创新3：信号台账 + 校准 ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "创新 ③ · 信号台账与每月校准");
  title(s, "每个信号都要用「真实战绩」说话");
  s.addText("不靠拍脑袋决定一个规则好不好用，而是看它命中后到底有多少真的是洗钱。", { x: 0.6, y: 1.75, w: 12, h: 0.45, fontFace: FONT, fontSize: 14, color: MUTED });
  // three states
  const states = [
    ["已验证", "样本足够 + 命中率达标", "正式告警触发器", GREEN],
    ["待验证", "样本还不够", "先观察，暂不下结论", SLATE],
    ["已降级", "样本足够但命中率太低", "退为参考因子，不再单独告警", RED],
  ];
  states.forEach((st, i) => {
    const y = 2.35 + i * 1.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 7.5, h: 0.9, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
    s.addText(st[0], { x: 0.8, y: y + 0.16, w: 1.6, h: 0.58, fontFace: FONT, fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle", fill: { color: st[3] }, rectRadius: 0.08 });
    s.addText([{ text: st[1] + "  →  ", options: { color: INK, bold: true } }, { text: st[2], options: { color: MUTED } }], { x: 2.55, y, w: 5.45, h: 0.9, fontFace: FONT, fontSize: 12.5, valign: "middle", lineSpacingMultiple: 1.1 });
  });
  // right insight
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.35, y: 2.35, w: 4.38, h: 3.15, fill: { color: NAVY }, rectRadius: 0.14, shadow: sh() });
  s.addText("稳健的判断", { x: 8.7, y: 2.6, w: 3.7, h: 0.45, fontFace: FONT, fontSize: 16, bold: true, color: TEAL2 });
  s.addText([
    { text: "看「保守估计」而非表面数字", options: { bold: true, color: WHITE, breakLine: true } },
    { text: "样本少时不轻易下结论 —— 命中 1/4（25%）可能只是运气，真实可低至 5%。", options: { color: "DDEBEF", breakLine: true } },
    { text: "", options: { breakLine: true, fontSize: 6 } },
    { text: "降级 ≠ 删除，且可逆", options: { bold: true, color: WHITE, breakLine: true } },
    { text: "信号继续积累战绩，达标后可重新升级。", options: { color: "DDEBEF" } },
  ], { x: 8.7, y: 3.15, w: 3.75, h: 2.2, fontFace: FONT, fontSize: 12.5, lineSpacingMultiple: 1.2 });
  s.addText("每月校准一次，所有变更附数据与置信区间，供委员会审批。", { x: 0.6, y: 5.7, w: 12, h: 0.4, fontFace: FONT, fontSize: 12.5, italic: true, color: MUTED });
  pageNum(s, 10);

  // ============ SLIDE 11 — 法务获得什么 ============
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "对法务团队意味着什么");
  title(s, "更少的噪声，更强的底气");
  const vals = [
    ["list", "一份排好序的清单", "每天打开就知道先看哪几笔、多急 —— 不再大海捞针"],
    ["search", "每笔都附「为什么」", "命中了哪条规则、AI 取到什么证据，一目了然，便于解释"],
    ["shield", "可解释 · 可审计", "分级依据明确、所有变更留痕，经得起监管追问"],
    ["chart", "越用越准", "你的每次复核都在训练系统，把更可疑的顶到前面"],
  ];
  vals.forEach((b, i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 2.05 + Math.floor(i / 2) * 2.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 5.95, h: 1.85, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.35, w: 0.85, h: 0.85, fill: { color: TEAL } });
    s.addImage({ data: ic[b[0]], x: x + 0.5, y: y + 0.55, w: 0.45, h: 0.45 });
    s.addText(b[1], { x: x + 1.35, y: y + 0.32, w: 4.4, h: 0.5, fontFace: FONT, fontSize: 16.5, bold: true, color: INK });
    s.addText(b[2], { x: x + 1.37, y: y + 0.85, w: 4.45, h: 0.85, fontFace: FONT, fontSize: 12.5, color: MUTED, lineSpacingMultiple: 1.15 });
  });
  pageNum(s, 11);

  // ============ SLIDE 12 — 结语 / 路线图 ============
  s = pres.addSlide(); s.background = { color: NAVY };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.14, fill: { color: TEAL } });
  s.addShape(pres.shapes.OVAL, { x: -2, y: 4.5, w: 6, h: 6, fill: { color: TEAL, transparency: 88 }, line: { type: "none" } });
  s.addText("一句话总结", { x: 0.6, y: 0.7, w: 8, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 3 });
  s.addText("把高价值告警顶上来，让系统越用越准", { x: 0.6, y: 1.15, w: 12, h: 1.4, fontFace: FONT, fontSize: 30, bold: true, color: WHITE, lineSpacingMultiple: 1.1 });
  s.addText("用分级告警替代整体评分（强信号不再被稀释），双入口覆盖单笔与跨笔手法，AI 调查提效，自我进化发现新风险 —— 而所有分级变更都在「统计校准 + 人工审批」的可审计闸门内。", { x: 0.62, y: 2.75, w: 9.2, h: 1.5, fontFace: FONT, fontSize: 15, color: "DDEBEF", lineSpacingMultiple: 1.35 });
  // roadmap
  s.addText("后续对接（与生产数据打通）", { x: 0.6, y: 4.55, w: 8, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: TEAL2 });
  const road = [
    "接入真实数据源：企查查 / 天眼查 / Dow Jones",
    "部署 Hermes Agent 框架，开启真实自学习",
    "对接付款系统（实时数据 + 暂停付款）",
    "把检测规则接到真实校验与时序数据",
  ];
  road.forEach((r, i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 5.05 + Math.floor(i / 2) * 0.72;
    s.addImage({ data: ic.check, x, y: y + 0.02, w: 0.32, h: 0.32 });
    s.addText(r, { x: x + 0.45, y: y - 0.05, w: 5.6, h: 0.5, fontFace: FONT, fontSize: 12.5, color: "DDEBEF", valign: "middle" });
  });
  s.addText("原型演示 · 公司付款数据为合成数据，外部数据源 / Hermes 框架 / 付款冻结为待对接项", { x: 0.6, y: 6.95, w: 12, h: 0.35, fontFace: FONT, fontSize: 10, italic: true, color: "6E92A0" });

  await pres.writeFile({ fileName: "AML系统讲解-法务版.pptx" });
  console.log("WROTE AML系统讲解-法务版.pptx");
})();
