const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa");

const NAVY = "102C3A", INK = "17313F", TEAL = "1BA39C", TEAL2 = "37B7AD";
const MUTED = "71838F", LINE = "DCE8EE", PANEL = "F4FAFB", WHITE = "FFFFFF";
const RED = "D84B4B", AMBER = "C9861A", GREEN = "22875A", SLATE = "5D8AA8";
const FONT = "Microsoft YaHei", FONTH = "Microsoft YaHei";

const pres = new pptxgen();
pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pres.layout = "W";
pres.title = "AML 付款风险识别系统 · 法务版";
const W = 13.333, H = 7.5;

async function icon(IconComp, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(IconComp, { color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
const sh = () => ({ type: "outer", color: "0B1F2A", blur: 9, offset: 3, angle: 135, opacity: 0.16 });
function pageNum(slide, n) {
  slide.addText(String(n).padStart(2, "0"), { x: W - 0.9, y: H - 0.5, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: "right" });
  slide.addText("AML 付款风险识别系统", { x: 0.6, y: H - 0.5, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED });
}
function kicker(slide, text) { slide.addText(text, { x: 0.6, y: 0.5, w: 10, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: TEAL, charSpacing: 2 }); }
function title(slide, text) { slide.addText(text, { x: 0.6, y: 0.82, w: 12.1, h: 0.9, fontFace: FONTH, fontSize: 30, bold: true, color: INK }); }

(async () => {
  const ic = {};
  const need = { bolt: Fa.FaBolt, layer: Fa.FaLayerGroup, search: Fa.FaSearch, robot: Fa.FaRobot, chart: Fa.FaChartLine, sync: Fa.FaSyncAlt, gavel: Fa.FaGavel, brain: Fa.FaBrain, scale: Fa.FaBalanceScale, eye: Fa.FaEye, arrow: Fa.FaArrowRight, check: Fa.FaCheckCircle, db: Fa.FaFileInvoiceDollar };
  for (const k in need) ic[k] = await icon(need[k], "#FFFFFF");
  const icTeal = {};
  for (const k of ["bolt", "layer", "search", "chart", "gavel", "sync", "check"]) icTeal[k] = await icon(need[k], "#1BA39C");

  // ===== S1 封面（白底）=====
  let s = pres.addSlide(); s.background = { color: WHITE };
  s.addShape(pres.shapes.OVAL, { x: W - 4.0, y: -2.6, w: 6.5, h: 6.5, fill: { color: TEAL, transparency: 92 }, line: { type: "none" } });
  s.addShape(pres.shapes.OVAL, { x: W - 2.4, y: 2.8, w: 5, h: 5, fill: { color: TEAL, transparency: 95 }, line: { type: "none" } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.28, h: H, fill: { color: TEAL } });
  s.addText("AML", { x: 0.9, y: 1.5, w: 2.4, h: 1.1, fontFace: FONTH, fontSize: 40, bold: true, color: WHITE, align: "center", valign: "middle", fill: { color: TEAL }, rectRadius: 0.2 });
  s.addText("付款风险识别系统", { x: 0.9, y: 2.8, w: 11.5, h: 1.0, fontFace: FONTH, fontSize: 44, bold: true, color: INK });
  s.addText("从「整体评分」到「分级告警 + 自我进化」", { x: 0.92, y: 3.98, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 19, color: TEAL, bold: true });
  s.addText("面向法务团队的系统讲解", { x: 0.92, y: 5.5, w: 11, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });

  // ===== S2 现状 + 结论 =====
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
    s.addText(st.v, { x: x + 0.2, y: 2.2, w: 3.4, h: 0.95, fontFace: FONTH, fontSize: 44, bold: true, color: st.c });
    s.addText(st.l, { x: x + 0.22, y: 3.12, w: 3.45, h: 0.62, fontFace: FONT, fontSize: 13.5, bold: true, color: INK, lineSpacingMultiple: 1.0 });
    s.addText(st.sub, { x: x + 0.22, y: 3.76, w: 3.45, h: 0.3, fontFace: FONT, fontSize: 11, color: MUTED });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 4.55, w: 12.13, h: 1.6, fill: { color: NAVY }, rectRadius: 0.12 });
  s.addText("结论", { x: 0.9, y: 4.72, w: 11, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 2 });
  s.addText([
    { text: "做不到、也无法验证「识别所有洗钱」（一年凑不出 10 个样本，传统机器学习不可行）。", options: { color: "DDEBEF", breakLine: true } },
    { text: "目标改为：让法务每天能审的有限数量，做到含金量最高。", options: { color: TEAL2, bold: true } },
  ], { x: 0.9, y: 5.12, w: 11.5, h: 0.9, fontFace: FONT, fontSize: 14.5, lineSpacingMultiple: 1.25 });
  pageNum(s, 2);

  // ===== S3 核心转变 before/after =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "产品形态的核心转变");
  title(s, "从「算一个总分」到「分级告警」");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.0, w: 5.55, h: 4.4, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
  s.addText("原有逻辑", { x: 0.95, y: 2.2, w: 4.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: MUTED, charSpacing: 1 });
  s.addText("整体加权评分", { x: 0.95, y: 2.6, w: 4.9, h: 0.5, fontFace: FONTH, fontSize: 21, bold: true, color: INK });
  s.addText([
    { text: "供应商分 × 40% + 付款分 × 35% + 合理性 × 25%", options: { breakLine: true, color: INK, bold: true } },
    { text: "→ 算一个 0–100 总分，按高/中/低排序", options: { color: MUTED } },
  ], { x: 0.95, y: 3.2, w: 4.95, h: 0.9, fontFace: FONT, fontSize: 12.5, lineSpacingMultiple: 1.25 });
  s.addText("痛点", { x: 0.95, y: 4.3, w: 4.5, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: RED, charSpacing: 1 });
  s.addText("强信号被「平均」稀释：一笔命中 2 条 30% 命中率硬规则的付款，被其它正常维度一平均就沉底、可能没人看。", { x: 0.97, y: 4.62, w: 5.0, h: 1.65, fontFace: FONT, fontSize: 12.5, color: INK, lineSpacingMultiple: 1.3 });
  s.addImage({ data: ic.arrow, x: 6.35, y: 3.95, w: 0.62, h: 0.62 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.18, y: 2.0, w: 5.55, h: 4.4, fill: { color: NAVY }, rectRadius: 0.12, shadow: sh() });
  s.addText("新形态", { x: 7.53, y: 2.2, w: 4.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 1 });
  s.addText("分级告警 (Tier)", { x: 7.53, y: 2.6, w: 4.9, h: 0.5, fontFace: FONTH, fontSize: 21, bold: true, color: WHITE });
  const tiers = [["T1", "紧急 · 24 小时内复核", RED], ["T2", "告警 · 3 天内复核", AMBER], ["T3", "评分 · 批量排序", SLATE]];
  tiers.forEach((t, i) => {
    const y = 3.2 + i * 0.7;
    s.addText(t[0], { x: 7.53, y, w: 0.95, h: 0.55, fontFace: FONTH, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle", fill: { color: t[2] }, rectRadius: 0.08 });
    s.addText(t[1], { x: 8.62, y, w: 4.05, h: 0.55, fontFace: FONT, fontSize: 13.5, color: "DDEBEF", valign: "middle" });
  });
  s.addText("T3 复用原有评分逻辑。", { x: 7.53, y: 5.35, w: 5.0, h: 0.35, fontFace: FONT, fontSize: 11.5, color: "8FB2BD" });
  s.addText("强信号「跳出」平均池，命中即定级、直接置顶。", { x: 7.53, y: 5.7, w: 5.05, h: 0.65, fontFace: FONT, fontSize: 12.5, italic: true, color: TEAL2, lineSpacingMultiple: 1.1 });
  pageNum(s, 3);

  // ===== S4 双入口 + 闭环 =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "怎么发现 · 怎么运转");
  title(s, "两个入口，一个越用越准的闭环");
  const entry = [
    { x: 0.6, c: TEAL, ic: ic.bolt, t: "入口 A · 付款级", d: "单笔命中硬规则：国家不一致、虚假发票、业务 ≠ 品类…" },
    { x: 6.78, c: AMBER, ic: ic.layer, t: "入口 B · 供应商级", d: "聚合多笔才看得出：拆分付款、付款突增、多次命中…" },
  ];
  entry.forEach(e => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: e.x, y: 1.95, w: 5.95, h: 1.6, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: e.x + 0.28, y: 2.2, w: 0.6, h: 0.6, fill: { color: e.c } });
    s.addImage({ data: e.ic, x: e.x + 0.4, y: 2.32, w: 0.36, h: 0.36 });
    s.addText(e.t, { x: e.x + 1.05, y: 2.18, w: 4.7, h: 0.6, fontFace: FONTH, fontSize: 16, bold: true, color: INK, valign: "middle" });
    s.addText(e.d, { x: e.x + 0.32, y: 2.82, w: 5.45, h: 0.65, fontFace: FONT, fontSize: 12.5, color: MUTED, lineSpacingMultiple: 1.1 });
  });
  s.addText("两入口合并成法务的一份统一告警清单", { x: 0.6, y: 3.62, w: 12, h: 0.35, fontFace: FONT, fontSize: 12.5, italic: true, color: TEAL, align: "center" });
  const loop = [["检测 + 定级", icTeal.bolt], ["AI 调查", icTeal.search], ["法务裁决", icTeal.gavel], ["持续学习", icTeal.chart]];
  loop.forEach((b, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.2, w: 2.7, h: 1.0, fill: { color: WHITE }, line: { color: LINE, width: 1.2 }, rectRadius: 0.12, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 4.45, w: 0.5, h: 0.5, fill: { color: PANEL }, line: { color: TEAL, width: 1.3 } });
    s.addImage({ data: b[1], x: x + 0.3, y: 4.55, w: 0.3, h: 0.3 });
    s.addText(b[0], { x: x + 0.8, y: 4.2, w: 1.85, h: 1.0, fontFace: FONT, fontSize: 13, bold: true, color: INK, valign: "middle", lineSpacingMultiple: 1.0 });
    if (i < 3) s.addImage({ data: ic.arrow, x: x + 2.76, y: 4.55, w: 0.26, h: 0.26 });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.45, w: 12.13, h: 0.95, fill: { color: PANEL }, line: { color: TEAL, width: 1.2, dashType: "dash" }, rectRadius: 0.12 });
  s.addImage({ data: icTeal.sync, x: 0.9, y: 5.7, w: 0.45, h: 0.45 });
  s.addText([
    { text: "回流校准：", options: { bold: true, color: TEAL } },
    { text: "法务每一次复核都被结构化沉淀，反过来校准「该看谁、多急」—— 系统越用越准。", options: { color: INK } },
  ], { x: 1.55, y: 5.5, w: 11, h: 0.85, fontFace: FONT, fontSize: 13.5, valign: "middle", lineSpacingMultiple: 1.1 });
  pageNum(s, 4);

  // ===== S5 端到端流程图（白底，菱形 + 箭头）=====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "端到端流程");
  title(s, "一笔付款在系统中的流转");
  const MID = 2.5;
  const conn = (x1, y1, x2, y2, end) => s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: "9FB6C0", width: 1.75, endArrowType: end === false ? "none" : "triangle" } });
  const proc = (x, y, w, h, t, sub) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1, shadow: sh() });
    s.addText([{ text: t, options: { bold: true, color: INK, breakLine: true, fontSize: 13 } }].concat(sub ? [{ text: sub, options: { color: MUTED, fontSize: 10.5 } }] : []),
      { x: x + 0.05, y, w: w - 0.1, h, fontFace: FONTH, align: "center", valign: "middle", lineSpacingMultiple: 1.05 });
  };
  const diamond = (cx, cy, t) => {
    const dw = 1.6, dh = 1.32;
    s.addShape(pres.shapes.DIAMOND, { x: cx - dw / 2, y: cy - dh / 2, w: dw, h: dh, fill: { color: "FFF6E8" }, line: { color: AMBER, width: 1.5 } });
    s.addText(t, { x: cx - dw / 2, y: cy - dh / 2, w: dw, h: dh, fontFace: FONTH, fontSize: 11, bold: true, color: "8A6115", align: "center", valign: "middle" });
  };
  const PH = 1.0;
  const py = MID - PH / 2;
  proc(0.5, py, 1.7, PH, "订单流入", "约 1 万 / 天");
  conn(2.20, MID, 2.50, MID);
  proc(2.50, py, 1.85, PH, "检测 + 分层", "双入口");
  conn(4.35, MID, 4.62, MID);
  diamond(5.45, MID, "分层\n等级？");
  conn(6.25, MID, 6.55, MID);
  s.addText("T1 / T2", { x: 5.95, y: 1.62, w: 0.9, h: 0.28, fontFace: FONT, fontSize: 9.5, bold: true, color: RED, align: "center" });
  proc(6.55, py, 1.85, PH, "AI 调查", "生成证据包");
  conn(8.40, MID, 8.67, MID);
  diamond(9.55, MID, "是否\n洗钱？");
  conn(10.35, MID, 10.62, MID);
  proc(10.62, py, 1.95, PH, "进化与学习", "校准 · 发现");

  const BY = 3.75, BH = 0.75;
  conn(5.45, MID + 0.66, 5.45, BY);
  s.addText("T3", { x: 5.55, y: 3.18, w: 0.6, h: 0.28, fontFace: FONT, fontSize: 9.5, bold: true, color: SLATE });
  proc(4.45, BY, 2.0, BH, "批量评分排序", "");
  conn(9.55, MID + 0.66, 9.55, BY);
  s.addText("是 / 否", { x: 9.62, y: 3.18, w: 1.0, h: 0.28, fontFace: FONT, fontSize: 9.5, bold: true, color: GREEN });
  proc(8.5, BY, 2.1, BH, "记录结论 → 学习", "");

  const D3y = 5.4;
  conn(11.595, MID + 0.5, 11.595, D3y - 0.66);
  diamond(11.595, D3y, "样本 ≥ N\n且 PPV 达标？");
  conn(11.595 - 0.8, D3y, 10.5, D3y);
  s.addText("否", { x: 10.5, y: D3y - 0.42, w: 0.5, h: 0.26, fontFace: FONT, fontSize: 9.5, bold: true, color: MUTED, align: "center" });
  proc(8.4, D3y - 0.35, 2.1, 0.7, "继续观察", "");
  const FYb = 6.55, fb = () => ({ color: TEAL, width: 1.7, dashType: "dash" });
  s.addText("是", { x: 11.7, y: D3y + 0.5, w: 0.7, h: 0.26, fontFace: FONT, fontSize: 9.5, bold: true, color: GREEN });
  s.addShape(pres.shapes.LINE, { x: 11.595, y: D3y + 0.66, w: 0, h: FYb - (D3y + 0.66), line: fb() });
  s.addShape(pres.shapes.LINE, { x: 3.425, y: FYb, w: 11.595 - 3.425, h: 0, line: fb() });
  s.addShape(pres.shapes.LINE, { x: 3.425, y: MID + 0.5, w: 0, h: FYb - (MID + 0.5), line: { color: TEAL, width: 1.7, dashType: "dash", beginArrowType: "triangle" } });
  s.addText([
    { text: "新信号转正 / 调整分层  ", options: { bold: true, color: TEAL } },
    { text: "—— 受统计校准 + 人工审批把关。", options: { color: INK } },
  ], { x: 3.7, y: 6.12, w: 8.8, h: 0.4, fontFace: FONT, fontSize: 11.5, valign: "middle" });
  pageNum(s, 5);

  // ===== S6 三大创新 =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "三个核心创新");
  title(s, "从「静态规则」走向「会进化的助手」");
  const innov = [
    ["robot", "01", "AI 调查 Agent", "自动多源取证（企查查 / 天眼查 / Dow Jones），把每件调查从 1 小时压到几分钟；人做最终判断。"],
    ["brain", "02", "自我进化", "Agent 从已确认案例中发现规则集里还没有的新信号 —— 但只能进「候选」，须校准 + 审批才生效。"],
    ["scale", "03", "信号台账 + 校准", "每个信号靠真实命中率自动升级 / 降级，不靠拍脑袋；所有变更可审计。"],
  ];
  innov.forEach((b, i) => {
    const x = 0.6 + i * 4.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.35, w: 3.8, h: 3.7, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.14, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 2.7, w: 0.95, h: 0.95, fill: { color: TEAL } });
    s.addImage({ data: ic[b[0]], x: x + 0.57, y: 2.92, w: 0.51, h: 0.51 });
    s.addText(b[1], { x: x + 2.5, y: 2.65, w: 1.1, h: 0.7, fontFace: FONTH, fontSize: 34, bold: true, color: "CFE0E6", align: "right" });
    s.addText(b[2], { x: x + 0.35, y: 3.85, w: 3.25, h: 0.55, fontFace: FONTH, fontSize: 18, bold: true, color: INK });
    s.addText(b[3], { x: x + 0.37, y: 4.45, w: 3.25, h: 1.5, fontFace: FONT, fontSize: 12.5, color: MUTED, lineSpacingMultiple: 1.25 });
  });
  pageNum(s, 6);

  // ===== S7 自我进化 + 合规闸门 =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "重点创新 · 自我进化（Hermes Agent）");
  title(s, "系统自己「发现」新风险，但分级仍需把关");
  s.addText("过去信号全靠法务凭经验预先定义；现在 Agent 从积累的案例中主动提出新假设。", { x: 0.6, y: 1.75, w: 12, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });
  const pipe = [
    ["Agent 发现", "学出反复出现的新模式", TEAL, "brain"],
    ["进入候选", "标记待验证、先观察", AMBER, "eye"],
    ["统计校准", "用真实命中率验证", SLATE, "scale"],
    ["人工审批", "委员会签字才生效", GREEN, "gavel"],
  ];
  pipe.forEach((b, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.5, w: 2.7, h: 2.0, fill: { color: PANEL }, line: { color: b[2], width: 1.5 }, rectRadius: 0.12 });
    s.addShape(pres.shapes.OVAL, { x: x + 1.0, y: 2.72, w: 0.7, h: 0.7, fill: { color: b[2] } });
    s.addImage({ data: ic[b[3]], x: x + 1.14, y: 2.86, w: 0.42, h: 0.42 });
    s.addText(b[0], { x: x + 0.1, y: 3.5, w: 2.5, h: 0.45, fontFace: FONTH, fontSize: 14.5, bold: true, color: INK, align: "center", lineSpacingMultiple: 1.0 });
    s.addText(b[1], { x: x + 0.12, y: 3.98, w: 2.46, h: 0.45, fontFace: FONT, fontSize: 11.5, color: MUTED, align: "center", lineSpacingMultiple: 1.0 });
    if (i < 3) s.addImage({ data: ic.arrow, x: x + 2.74, y: 3.35, w: 0.32, h: 0.32 });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 4.95, w: 12.13, h: 1.3, fill: { color: "FFF6E8" }, line: { color: "F0D8A8", width: 1.2 }, rectRadius: 0.12 });
  s.addImage({ data: await icon(Fa.FaLock, "#C9861A"), x: 0.95, y: 5.32, w: 0.5, h: 0.5 });
  s.addText([
    { text: "合规底线：", options: { bold: true, color: AMBER } },
    { text: "自我进化只能「发现假设」，绝不能黑盒改告警等级。任何影响分级的变更，都必须经过可审计的统计校准 + 人工审批。", options: { color: INK } },
  ], { x: 1.65, y: 5.05, w: 10.85, h: 1.1, fontFace: FONT, fontSize: 13.5, valign: "middle", lineSpacingMultiple: 1.2 });
  pageNum(s, 7);

  // ===== S8 总结 + 路线图 =====
  s = pres.addSlide(); s.background = { color: WHITE };
  s.addShape(pres.shapes.OVAL, { x: -2.2, y: 4.6, w: 6, h: 6, fill: { color: TEAL, transparency: 94 }, line: { type: "none" } });
  kicker(s, "一句话总结");
  s.addText("把高价值告警顶上来，让系统越用越准", { x: 0.6, y: 0.82, w: 12.2, h: 1.0, fontFace: FONTH, fontSize: 30, bold: true, color: INK });
  s.addText("分级告警替代整体评分（强信号不再被稀释），双入口覆盖单笔与跨笔手法，AI 调查提效，自我进化发现新风险 —— 所有分级变更都在「统计校准 + 人工审批」的可审计闸门内。", { x: 0.62, y: 2.2, w: 11.9, h: 1.4, fontFace: FONT, fontSize: 15, color: INK, lineSpacingMultiple: 1.32 });
  s.addText("对法务团队", { x: 0.6, y: 3.9, w: 9, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: TEAL, charSpacing: 1 });
  const vals = ["一份排好序的清单，不再大海捞针", "每笔都附「为什么」，便于解释", "可解释 · 可审计，经得起监管追问", "你的每次复核都在让系统更准"];
  vals.forEach((v, i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 4.35 + Math.floor(i / 2) * 0.66;
    s.addImage({ data: icTeal.check, x, y: y + 0.02, w: 0.3, h: 0.3 });
    s.addText(v, { x: x + 0.42, y: y - 0.05, w: 5.7, h: 0.45, fontFace: FONT, fontSize: 12.5, color: INK, valign: "middle" });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.95, w: 12.13, h: 0.62, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
  s.addText([{ text: "后续对接：", options: { bold: true, color: TEAL } }, { text: "真实数据源（企查查 / 天眼查 / Dow Jones）· 部署 Hermes Agent 框架 · 接入付款系统", options: { color: INK } }], { x: 0.85, y: 5.95, w: 11.7, h: 0.62, fontFace: FONT, fontSize: 12, valign: "middle" });
  s.addText("原型演示 · 公司付款数据为合成数据，外部数据源 / Hermes 框架 / 付款冻结为待对接项。", { x: 0.6, y: 6.85, w: 12, h: 0.35, fontFace: FONT, fontSize: 10, italic: true, color: MUTED });

  await pres.writeFile({ fileName: "AML-System-Walkthrough-Legal-CN.pptx" });
  console.log("WROTE CN deck (8 slides)");
})();
