const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa");

const NAVY = "102C3A", INK = "17313F", TEAL = "1BA39C", TEAL2 = "37B7AD";
const MUTED = "71838F", LINE = "DCE8EE", PANEL = "F4FAFB", WHITE = "FFFFFF";
const RED = "D84B4B", AMBER = "C9861A", GREEN = "22875A", SLATE = "5D8AA8";
const FONT = "Calibri", FONTH = "Calibri";

const pres = new pptxgen();
pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pres.layout = "W";
pres.title = "AML Payment Risk System · Legal Edition";
const W = 13.333, H = 7.5;

async function icon(IconComp, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(IconComp, { color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
const sh = () => ({ type: "outer", color: "0B1F2A", blur: 9, offset: 3, angle: 135, opacity: 0.16 });
function pageNum(slide, n) {
  slide.addText(String(n).padStart(2, "0"), { x: W - 0.9, y: H - 0.5, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: "right" });
  slide.addText("AML Payment Risk Identification System", { x: 0.6, y: H - 0.5, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED });
}
function kicker(slide, text) { slide.addText(text, { x: 0.6, y: 0.5, w: 10, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: TEAL, charSpacing: 2 }); }
function title(slide, text) { slide.addText(text, { x: 0.6, y: 0.82, w: 12.1, h: 0.9, fontFace: FONTH, fontSize: 30, bold: true, color: INK }); }

(async () => {
  const ic = {};
  const need = { bolt: Fa.FaBolt, layer: Fa.FaLayerGroup, search: Fa.FaSearch, robot: Fa.FaRobot, chart: Fa.FaChartLine, sync: Fa.FaSyncAlt, gavel: Fa.FaGavel, brain: Fa.FaBrain, scale: Fa.FaBalanceScale, eye: Fa.FaEye, arrow: Fa.FaArrowRight, check: Fa.FaCheckCircle, db: Fa.FaFileInvoiceDollar };
  for (const k in need) ic[k] = await icon(need[k], "#FFFFFF");
  const icTeal = {};
  for (const k of ["bolt", "layer", "search", "chart", "gavel", "sync", "check"]) icTeal[k] = await icon(need[k], "#1BA39C");

  // ===== S1 Cover (white) =====
  let s = pres.addSlide(); s.background = { color: WHITE };
  s.addShape(pres.shapes.OVAL, { x: W - 4.0, y: -2.6, w: 6.5, h: 6.5, fill: { color: TEAL, transparency: 92 }, line: { type: "none" } });
  s.addShape(pres.shapes.OVAL, { x: W - 2.4, y: 2.8, w: 5, h: 5, fill: { color: TEAL, transparency: 95 }, line: { type: "none" } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.28, h: H, fill: { color: TEAL } });
  s.addText("AML", { x: 0.9, y: 1.5, w: 2.4, h: 1.1, fontFace: FONTH, fontSize: 40, bold: true, color: WHITE, align: "center", valign: "middle", fill: { color: TEAL }, rectRadius: 0.2 });
  s.addText("Payment Risk Identification System", { x: 0.9, y: 2.8, w: 11.5, h: 1.0, fontFace: FONTH, fontSize: 40, bold: true, color: INK });
  s.addText("From a Single Score to Tiered Alerts + Self-Evolution", { x: 0.92, y: 3.95, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 19, color: TEAL, bold: true });
  s.addText("A System Walkthrough for the Legal Team", { x: 0.92, y: 5.5, w: 11, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });

  // ===== S2 Reality + conclusion =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "THE REALITY WE FACE");
  title(s, "Finding the rare few among massive payments");
  const stats = [
    { v: "≈ 10K", l: "payments / day", sub: "~3.65M per year", c: TEAL },
    { v: "< 10", l: "real laundering cases / year", sub: "positive rate ≈ 1 in 400,000", c: RED },
    { v: "30%", l: "of high-precision rule hits\nare real laundering (PPV)", sub: "a rare industry edge", c: GREEN },
  ];
  stats.forEach((st, i) => {
    const x = 0.6 + i * 4.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.0, w: 3.8, h: 2.15, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
    s.addText(st.v, { x: x + 0.2, y: 2.2, w: 3.4, h: 0.95, fontFace: FONTH, fontSize: 44, bold: true, color: st.c });
    s.addText(st.l, { x: x + 0.22, y: 3.12, w: 3.45, h: 0.62, fontFace: FONT, fontSize: 13.5, bold: true, color: INK, lineSpacingMultiple: 1.0 });
    s.addText(st.sub, { x: x + 0.22, y: 3.76, w: 3.45, h: 0.3, fontFace: FONT, fontSize: 11, color: MUTED });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 4.55, w: 12.13, h: 1.6, fill: { color: NAVY }, rectRadius: 0.12 });
  s.addText("CONCLUSION", { x: 0.9, y: 4.72, w: 11, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 2 });
  s.addText([
    { text: "Catching every laundering case is neither achievable nor verifiable (fewer than 10 samples a year makes traditional ML unworkable).", options: { color: "DDEBEF", breakLine: true } },
    { text: "New goal: make the limited number Legal can review each day as high-value as possible.", options: { color: TEAL2, bold: true } },
  ], { x: 0.9, y: 5.12, w: 11.5, h: 0.9, fontFace: FONT, fontSize: 14.5, lineSpacingMultiple: 1.25 });
  pageNum(s, 2);

  // ===== S3 Core shift before/after =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "THE CORE PRODUCT SHIFT");
  title(s, "From one overall score to tiered alerts");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.0, w: 5.55, h: 4.4, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
  s.addText("ORIGINAL LOGIC", { x: 0.95, y: 2.2, w: 4.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: MUTED, charSpacing: 1 });
  s.addText("Overall weighted score", { x: 0.95, y: 2.6, w: 4.9, h: 0.5, fontFace: FONTH, fontSize: 21, bold: true, color: INK });
  s.addText([
    { text: "Vendor 40% + Payment 35% + Reasonableness 25%", options: { breakLine: true, color: INK, bold: true } },
    { text: "→ one 0–100 score, ranked High / Medium / Low", options: { color: MUTED } },
  ], { x: 0.95, y: 3.2, w: 4.95, h: 0.9, fontFace: FONT, fontSize: 12.5, lineSpacingMultiple: 1.25 });
  s.addText("THE PROBLEM", { x: 0.95, y: 4.3, w: 4.5, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: RED, charSpacing: 1 });
  s.addText("Strong signals get diluted by averaging: a payment hitting 2 hard rules (30% PPV each) is averaged down by normal dimensions — it sinks in the queue and may never be seen.", { x: 0.97, y: 4.62, w: 5.0, h: 1.65, fontFace: FONT, fontSize: 12.5, color: INK, lineSpacingMultiple: 1.25 });
  s.addImage({ data: ic.arrow, x: 6.35, y: 3.95, w: 0.62, h: 0.62 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.18, y: 2.0, w: 5.55, h: 4.4, fill: { color: NAVY }, rectRadius: 0.12, shadow: sh() });
  s.addText("NEW FORM", { x: 7.53, y: 2.2, w: 4.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: TEAL2, charSpacing: 1 });
  s.addText("Tiered alerts (Tier)", { x: 7.53, y: 2.6, w: 4.9, h: 0.5, fontFace: FONTH, fontSize: 21, bold: true, color: WHITE });
  const tiers = [["T1", "Critical · review within 24h", RED], ["T2", "Alert · review within 3 days", AMBER], ["T3", "Scored · batch ranking", SLATE]];
  tiers.forEach((t, i) => {
    const y = 3.2 + i * 0.7;
    s.addText(t[0], { x: 7.53, y, w: 0.95, h: 0.55, fontFace: FONTH, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle", fill: { color: t[2] }, rectRadius: 0.08 });
    s.addText(t[1], { x: 8.62, y, w: 4.05, h: 0.55, fontFace: FONT, fontSize: 13.5, color: "DDEBEF", valign: "middle" });
  });
  s.addText("T3 reuses the existing scoring logic.", { x: 7.53, y: 5.35, w: 5.0, h: 0.35, fontFace: FONT, fontSize: 11.5, color: "8FB2BD" });
  s.addText("Strong signals jump out of the averaging pool — a hit sets the tier and goes straight to the top.", { x: 7.53, y: 5.7, w: 5.05, h: 0.65, fontFace: FONT, fontSize: 12.5, italic: true, color: TEAL2, lineSpacingMultiple: 1.1 });
  pageNum(s, 3);

  // ===== S4 Dual entry + loop =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "HOW IT DETECTS · HOW IT RUNS");
  title(s, "Two entry points, one loop that keeps improving");
  const entry = [
    { x: 0.6, c: TEAL, ic: ic.bolt, t: "Entry A · Payment-level", d: "Single payment hits a hard rule: country mismatch, fake invoice, business ≠ category…" },
    { x: 6.78, c: AMBER, ic: ic.layer, t: "Entry B · Vendor-level", d: "Visible only across payments: structuring, payment surges, repeated hits…" },
  ];
  entry.forEach(e => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: e.x, y: 1.95, w: 5.95, h: 1.6, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: e.x + 0.28, y: 2.2, w: 0.6, h: 0.6, fill: { color: e.c } });
    s.addImage({ data: e.ic, x: e.x + 0.4, y: 2.32, w: 0.36, h: 0.36 });
    s.addText(e.t, { x: e.x + 1.05, y: 2.18, w: 4.7, h: 0.6, fontFace: FONTH, fontSize: 16, bold: true, color: INK, valign: "middle" });
    s.addText(e.d, { x: e.x + 0.32, y: 2.82, w: 5.45, h: 0.65, fontFace: FONT, fontSize: 12.5, color: MUTED, lineSpacingMultiple: 1.1 });
  });
  s.addText("Both entries merge into one unified alert list for Legal", { x: 0.6, y: 3.62, w: 12, h: 0.35, fontFace: FONT, fontSize: 12.5, italic: true, color: TEAL, align: "center" });
  const loop = [["Detect + Tier", icTeal.bolt], ["AI Investigation", icTeal.search], ["Legal Decision", icTeal.gavel], ["Continuous Learning", icTeal.chart]];
  loop.forEach((b, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.2, w: 2.7, h: 1.0, fill: { color: WHITE }, line: { color: LINE, width: 1.2 }, rectRadius: 0.12, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 4.45, w: 0.5, h: 0.5, fill: { color: PANEL }, line: { color: TEAL, width: 1.3 } });
    s.addImage({ data: b[1], x: x + 0.3, y: 4.55, w: 0.3, h: 0.3 });
    s.addText(b[0], { x: x + 0.8, y: 4.2, w: 1.85, h: 1.0, fontFace: FONT, fontSize: 12.5, bold: true, color: INK, valign: "middle", lineSpacingMultiple: 1.0 });
    if (i < 3) s.addImage({ data: ic.arrow, x: x + 2.76, y: 4.55, w: 0.26, h: 0.26 });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.45, w: 12.13, h: 0.95, fill: { color: PANEL }, line: { color: TEAL, width: 1.2, dashType: "dash" }, rectRadius: 0.12 });
  s.addImage({ data: icTeal.sync, x: 0.9, y: 5.7, w: 0.45, h: 0.45 });
  s.addText([
    { text: "Feedback loop: ", options: { bold: true, color: TEAL } },
    { text: "every Legal review is captured to recalibrate who to look at and how urgently — the system keeps getting sharper.", options: { color: INK } },
  ], { x: 1.55, y: 5.5, w: 11, h: 0.85, fontFace: FONT, fontSize: 13.5, valign: "middle", lineSpacingMultiple: 1.1 });
  pageNum(s, 4);

  // ===== S5 End-to-end flowchart (white, diamonds + arrows) =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "END-TO-END FLOW");
  title(s, "How a payment flows through the system");
  const MID = 2.85;              // main-row vertical midline
  const conn = (x1, y1, x2, y2, end) => s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: "9FB6C0", width: 1.75, endArrowType: end === false ? "none" : "triangle" } });
  const proc = (x, w, t, sub, fill) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: MID - 0.5, w, h: 1.0, fill: { color: fill || PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1, shadow: sh() });
    s.addText([{ text: t, options: { bold: true, color: INK, breakLine: true, fontSize: 13.5 } }, { text: sub, options: { color: MUTED, fontSize: 10.5 } }],
      { x: x + 0.06, y: MID - 0.5, w: w - 0.12, h: 1.0, fontFace: FONTH, align: "center", valign: "middle", lineSpacingMultiple: 1.05 });
  };
  const diamond = (cx, t) => {
    const dw = 1.55, dh = 1.35;
    s.addShape(pres.shapes.DIAMOND, { x: cx - dw / 2, y: MID - dh / 2, w: dw, h: dh, fill: { color: "FFF6E8" }, line: { color: AMBER, width: 1.5 } });
    s.addText(t, { x: cx - dw / 2, y: MID - dh / 2, w: dw, h: dh, fontFace: FONTH, fontSize: 11.5, bold: true, color: "8A6115", align: "center", valign: "middle" });
  };
  // main spine
  proc(0.5, 1.7, "Payments In", "~10K / day");          // 0.5–2.20
  conn(2.20, MID, 2.50, MID);
  proc(2.50, 1.85, "Detect + Tier", "dual entry");       // 2.50–4.35
  conn(4.35, MID, 4.62, MID);
  diamond(5.45, "Tier\nlevel?");                          // 4.675–6.225
  conn(6.23, MID, 6.55, MID);
  s.addText("T1 / T2", { x: 5.95, y: 2.0, w: 0.9, h: 0.28, fontFace: FONT, fontSize: 9.5, bold: true, color: RED, align: "center" });
  proc(6.55, 1.85, "AI Investigation", "evidence pack"); // 6.55–8.40
  conn(8.40, MID, 8.67, MID);
  diamond(9.55, "Money\nlaundering?");                    // 8.775–10.325
  conn(10.33, MID, 10.62, MID);
  proc(10.62, 1.95, "Evolve & Learn", "calibrate · discover"); // 10.62–12.57

  // branch DOWN from Tier? (T3)
  const BY = 4.6;
  conn(5.45, MID + 0.68, 5.45, BY);
  s.addText("T3", { x: 5.55, y: 3.55, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9.5, bold: true, color: SLATE });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.4, y: BY, w: 2.1, h: 0.85, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
  s.addText("Batch score & rank", { x: 4.45, y: BY, w: 2.0, h: 0.85, fontFace: FONT, fontSize: 11, color: INK, align: "center", valign: "middle" });

  // branch DOWN from laundering? (Yes / No → recorded)
  conn(9.55, MID + 0.68, 9.55, BY);
  s.addText("Yes / No", { x: 9.65, y: 3.55, w: 1.0, h: 0.3, fontFace: FONT, fontSize: 9.5, bold: true, color: GREEN });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.5, y: BY, w: 2.1, h: 0.85, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
  s.addText("Decision recorded\n→ feeds learning", { x: 8.55, y: BY, w: 2.0, h: 0.85, fontFace: FONT, fontSize: 10.5, color: INK, align: "center", valign: "middle", lineSpacingMultiple: 1.0 });

  // feedback loop: Evolve → (down, left, up) → Detect+Tier  (dashed)
  const FYb = 6.6;
  const fbLine = () => ({ color: TEAL, width: 1.6, dashType: "dash" });
  s.addShape(pres.shapes.LINE, { x: 11.595, y: MID + 0.5, w: 0, h: FYb - (MID + 0.5), line: fbLine() });
  s.addShape(pres.shapes.LINE, { x: 3.425, y: FYb, w: 11.595 - 3.425, h: 0, line: fbLine() });
  s.addShape(pres.shapes.LINE, { x: 3.425, y: MID + 0.5, w: 0, h: FYb - (MID + 0.5), line: { color: TEAL, width: 1.6, dashType: "dash", beginArrowType: "triangle" } });
  s.addText([
    { text: "Feedback loop  ", options: { bold: true, color: TEAL } },
    { text: "— validated signals & recalibrated PPV adjust tiering, gated by calibration + human approval.", options: { color: INK } },
  ], { x: 3.7, y: 5.95, w: 8.4, h: 0.5, fontFace: FONT, fontSize: 11.5, valign: "middle", lineSpacingMultiple: 1.05 });
  pageNum(s, 5);

  // ===== S6 Three innovations (white) =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "THREE CORE INNOVATIONS");
  title(s, "From static rules to an evolving assistant");
  const innov = [
    ["robot", "01", "AI Investigation Agent", "Auto multi-source evidence (Qichacha / Tianyancha / Dow Jones) cuts each case from an hour to minutes; humans make the final call."],
    ["brain", "02", "Self-Evolution", "The agent discovers new signals not yet in the rule set — but they enter only as candidates, taking effect after calibration + approval."],
    ["scale", "03", "Signal Ledger + Calibration", "Each signal is promoted / demoted by its real hit rate, not gut feel; every change is auditable."],
  ];
  innov.forEach((b, i) => {
    const x = 0.6 + i * 4.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.35, w: 3.8, h: 3.7, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.14, shadow: sh() });
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 2.7, w: 0.95, h: 0.95, fill: { color: TEAL } });
    s.addImage({ data: ic[b[0]], x: x + 0.57, y: 2.92, w: 0.51, h: 0.51 });
    s.addText(b[1], { x: x + 2.5, y: 2.65, w: 1.1, h: 0.7, fontFace: FONTH, fontSize: 34, bold: true, color: "CFE0E6", align: "right" });
    s.addText(b[2], { x: x + 0.35, y: 3.85, w: 3.25, h: 0.85, fontFace: FONTH, fontSize: 17, bold: true, color: INK, lineSpacingMultiple: 1.0 });
    s.addText(b[3], { x: x + 0.37, y: 4.7, w: 3.25, h: 1.3, fontFace: FONT, fontSize: 12.5, color: MUTED, lineSpacingMultiple: 1.22 });
  });
  pageNum(s, 6);

  // ===== S7 Self-evolution + gate =====
  s = pres.addSlide(); s.background = { color: WHITE };
  kicker(s, "SPOTLIGHT · SELF-EVOLUTION (HERMES AGENT)");
  title(s, "The system discovers new risks — but tiering stays gated");
  s.addText("Signals used to be predefined by Legal from experience; now the agent proposes new hypotheses from accumulated cases.", { x: 0.6, y: 1.75, w: 12, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });
  const pipe = [
    ["Agent Discovers", "learns recurring new patterns", TEAL, "brain"],
    ["Enters Candidacy", "marked pending, observe first", AMBER, "eye"],
    ["Statistical Calibration", "validated by real hit rate", SLATE, "scale"],
    ["Human Approval", "live only after sign-off", GREEN, "gavel"],
  ];
  pipe.forEach((b, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.5, w: 2.7, h: 2.0, fill: { color: PANEL }, line: { color: b[2], width: 1.5 }, rectRadius: 0.12 });
    s.addShape(pres.shapes.OVAL, { x: x + 1.0, y: 2.72, w: 0.7, h: 0.7, fill: { color: b[2] } });
    s.addImage({ data: ic[b[3]], x: x + 1.14, y: 2.86, w: 0.42, h: 0.42 });
    s.addText(b[0], { x: x + 0.1, y: 3.5, w: 2.5, h: 0.45, fontFace: FONTH, fontSize: 14, bold: true, color: INK, align: "center", lineSpacingMultiple: 1.0 });
    s.addText(b[1], { x: x + 0.12, y: 3.98, w: 2.46, h: 0.45, fontFace: FONT, fontSize: 11, color: MUTED, align: "center", lineSpacingMultiple: 1.0 });
    if (i < 3) s.addImage({ data: ic.arrow, x: x + 2.74, y: 3.35, w: 0.32, h: 0.32 });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 4.95, w: 12.13, h: 1.3, fill: { color: "FFF6E8" }, line: { color: "F0D8A8", width: 1.2 }, rectRadius: 0.12 });
  s.addImage({ data: await icon(Fa.FaLock, "#C9861A"), x: 0.95, y: 5.32, w: 0.5, h: 0.5 });
  s.addText([
    { text: "Compliance bottom line: ", options: { bold: true, color: AMBER } },
    { text: "self-evolution may only propose hypotheses — never silently change alert tiers. Any change affecting tiering must pass auditable statistical calibration + human approval.", options: { color: INK } },
  ], { x: 1.65, y: 5.05, w: 10.85, h: 1.1, fontFace: FONT, fontSize: 13.5, valign: "middle", lineSpacingMultiple: 1.2 });
  pageNum(s, 7);

  // ===== S8 Summary + roadmap (white) =====
  s = pres.addSlide(); s.background = { color: WHITE };
  s.addShape(pres.shapes.OVAL, { x: -2.2, y: 4.6, w: 6, h: 6, fill: { color: TEAL, transparency: 94 }, line: { type: "none" } });
  kicker(s, "IN ONE SENTENCE");
  s.addText("Surface the high-value alerts, and keep getting sharper", { x: 0.6, y: 0.82, w: 12.2, h: 1.0, fontFace: FONTH, fontSize: 29, bold: true, color: INK });
  s.addText("Tiered alerts replace the overall score (strong signals no longer diluted), two entry points cover single- and cross-payment tactics, AI speeds up investigation, and self-evolution surfaces new risks — with every tiering change inside an auditable gate of statistical calibration + human approval.", { x: 0.62, y: 2.2, w: 11.9, h: 1.4, fontFace: FONT, fontSize: 15, color: INK, lineSpacingMultiple: 1.32 });
  s.addText("FOR THE LEGAL TEAM", { x: 0.6, y: 3.9, w: 9, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: TEAL, charSpacing: 1 });
  const vals = ["A ranked list — no more needle in a haystack", "Every item comes with a 'why', easy to explain", "Explainable & auditable — stands up to regulators", "Every review you do makes the system sharper"];
  vals.forEach((v, i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 4.35 + Math.floor(i / 2) * 0.66;
    s.addImage({ data: icTeal.check, x, y: y + 0.02, w: 0.3, h: 0.3 });
    s.addText(v, { x: x + 0.42, y: y - 0.05, w: 5.7, h: 0.45, fontFace: FONT, fontSize: 12.5, color: INK, valign: "middle" });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.95, w: 12.13, h: 0.62, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
  s.addText([{ text: "Next: ", options: { bold: true, color: TEAL } }, { text: "real data sources (Qichacha / Tianyancha / Dow Jones) · deploy the Hermes Agent framework · integrate the payment system", options: { color: INK } }], { x: 0.85, y: 5.95, w: 11.7, h: 0.62, fontFace: FONT, fontSize: 12, valign: "middle" });
  s.addText("Prototype demo · company payment data is synthetic; external data sources / Hermes framework / payment hold are pending integration.", { x: 0.6, y: 6.85, w: 12, h: 0.35, fontFace: FONT, fontSize: 10, italic: true, color: MUTED });

  await pres.writeFile({ fileName: "AML-System-Walkthrough-Legal-EN.pptx" });
  console.log("WROTE EN deck (8 slides)");
})();
