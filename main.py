"""
AML Chat Backend — LLM proxy for the AML Identifier demo.

Endpoints:
  POST /api/aml/chat         — one-shot JSON response
  POST /api/aml/chat/stream  — SSE stream with reasoning summary + answer

Both use the same OpenAI-compatible API key/base URL/model. Streaming endpoint
prefers the Responses API so reasoning summaries can be surfaced; falls back to
chat completions streaming if the model doesn't support Responses.
"""
from __future__ import annotations

import json
import logging
import os
from typing import List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

load_dotenv()

LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
REASONING_EFFORT = os.getenv("REASONING_EFFORT", "medium").strip()
PORT = int(os.getenv("PORT", "8080"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aml-chat")

if not LLM_API_KEY:
    raise RuntimeError("LLM_API_KEY must be set in environment (.env or platform env vars).")

client = AsyncOpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)

app = FastAPI(title="AML Chat Backend", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Payment(BaseModel):
    id: str
    caseId: str = ""
    date: str
    source: str
    vendor: str
    amount: str
    amountNum: float
    category: str
    categoryZh: str = ""
    vendorScore: int
    paymentScore: int
    reasonable: str
    reasonableScore: int
    total: int
    status: str
    riskTypes: List[str] = Field(default_factory=list)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatReq(BaseModel):
    message: str
    payments: List[Payment]
    history: List[ChatTurn] = Field(default_factory=list)
    lang: Literal["en", "zh"] = "en"


class ChatResp(BaseModel):
    text: str
    paymentIds: List[str] = Field(default_factory=list)


IDS_MARKER = "__IDS__:"


SYSTEM_PROMPT_EN = f"""You are an AML (anti-money-laundering) risk analyst assistant embedded in an internal compliance tool. You help the Legal team analyze flagged payments, surface patterns, and locate payments by vendor or by risk dimension.

Six analysis dimensions:
- geographic — high-risk jurisdictions, offshore entities, country/bank/invoice mismatch
- pep — Politically Exposed Person ownership or close relationships
- adverseMedia — negative media on corruption, fraud, sanctions exposure
- docMissing — missing PO/contract, or business mismatch vs. procurement category
- timeAnomaly — new vendor surge, weekend/holiday transactions
- behavior — suspicious account routing, fake invoices, irregular patterns

Risk levels: High = total >= 70; Medium = 50-69.

LANGUAGE: Respond in English. Always. Even if the user writes in another language, your analysis text must be in English. Vendor names and payment IDs are case- and locale-insensitive — match them regardless of input language.

The payments dataset is the SINGLE source of truth. Do not fabricate payments, vendors, amounts, or scores. If the user's question is not answerable from the dataset, say so plainly.

Behavior:
- Vendor lookup → match payments whose vendor contains the queried token (case-insensitive, partial OK).
- Risk dimension query → list payments whose riskTypes include that dimension; give count + total amount + vendor count.
- High-risk / top / overview → highest total first.
- Aggregate first, then cite specific payments.
- Concise and actionable; do not pad.

OUTPUT FORMAT — exactly two sections, in this order, separated by a newline:

1. Analysis text. Plain text with these inline tags allowed: <strong>...</strong> for emphasis on numbers/vendor names, <ul><li>...</li></ul> for short bullets. Keep to 4 short sentences or 5 short bullets. No markdown fences, no JSON.

2. On a SEPARATE LINE, exactly:
{IDS_MARKER}PAY-XXXX,PAY-YYYY

Up to 5 most relevant payment IDs from the dataset, comma-separated, no spaces. If nothing relevant, output `{IDS_MARKER}` with nothing after it.

Example output:
<strong>3</strong> high-risk payments totaling <strong>$827,100</strong> across <strong>3</strong> vendors. Northstar Trading dominates with a 90 score; Vertex and Blue Meridian follow.
{IDS_MARKER}PAY-2409-0187,PAY-2409-0261,PAY-2409-0214
"""

SYSTEM_PROMPT_ZH = f"""你是嵌入在合规系统中的 AML（反洗钱）风险分析助手。你帮助法务团队分析被标记的付款、发现模式，并按供应商或风险维度定位付款。

六个分析维度：
- geographic 地理风险 — 高风险司法管辖区、离岸实体、国家/银行/发票不一致
- pep PEP 人物 — 政治公众人物持股或紧密关联
- adverseMedia 不利媒体 — 腐败、欺诈、制裁相关负面媒体报道
- docMissing 文件缺失 — 缺少 PO/合同，或业务范围与采购品类不匹配
- timeAnomaly 时间异常 — 新供应商付款突增、周末/节假日交易
- behavior 行为指标 — 可疑账户路由、虚假发票、异常付款模式

风险等级：High = 总分 ≥ 70；Medium = 50-69。

语言：始终用中文回答。即使用户用其他语言提问，你的分析文字也必须是中文。供应商名和付款编号本身不需要翻译。

付款数据集是唯一事实来源。不要编造付款、供应商、金额或分数。若用户问题无法基于该数据集回答，直说即可。

行为规范：
- 供应商查询 → 按供应商名做（不区分大小写的）部分包含匹配。
- 风险维度查询 → 列出 riskTypes 包含该维度的付款；给出数量、总金额、涉及供应商数。
- 高风险 / Top / 概览 → 按总分从高到低排序。
- 先聚合，再点出具体付款。
- 简洁、可执行，不要冗余。

输出格式 — 严格两段，按顺序，用换行分隔：

1. 分析文字。纯文本，允许这些内联标签：<strong>...</strong> 强调数字/供应商名，<ul><li>...</li></ul> 用于简短列项。控制在 4 句短句或 5 个短项以内。不要 markdown 围栏，不要 JSON。

2. 单独一行，严格格式：
{IDS_MARKER}PAY-XXXX,PAY-YYYY

最多 5 个最相关的付款编号，逗号分隔，无空格。若无相关则只输出 `{IDS_MARKER}` 后面留空。

输出示例：
<strong>3</strong> 笔高风险付款，总金额 <strong>$827,100</strong>，涉及 <strong>3</strong> 个供应商。Northstar Trading 评分 90 居首，Vertex 与 Blue Meridian 紧随其后。
{IDS_MARKER}PAY-2409-0187,PAY-2409-0261,PAY-2409-0214
"""


def build_system_prompt(req: ChatReq) -> str:
    base = SYSTEM_PROMPT_ZH if req.lang == "zh" else SYSTEM_PROMPT_EN
    payments_json = json.dumps([p.model_dump() for p in req.payments], ensure_ascii=False)
    return f"{base}\n\nPayments dataset (JSON array):\n{payments_json}"


def build_chat_messages(req: ChatReq) -> list[dict]:
    """Messages for Chat Completions API (system + history + user)."""
    system = build_system_prompt(req)
    messages = [{"role": "system", "content": system}]
    for turn in req.history[-6:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": req.message})
    return messages


def build_responses_input(req: ChatReq) -> list[dict]:
    """Input array for Responses API (history + user; system goes in `instructions`)."""
    messages = []
    for turn in req.history[-6:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": req.message})
    return messages


def split_ids(text: str) -> tuple[str, list[str]]:
    """Split analysis text from the trailing __IDS__: marker line."""
    if IDS_MARKER not in text:
        return text.strip(), []
    head, tail = text.rsplit(IDS_MARKER, 1)
    ids = [s.strip() for s in tail.replace("\n", " ").split(",") if s.strip()]
    return head.strip(), ids


@app.get("/api/health")
async def health():
    return {"ok": True, "model": LLM_MODEL, "base_url": LLM_BASE_URL, "reasoning_effort": REASONING_EFFORT}


@app.post("/api/aml/chat", response_model=ChatResp)
async def aml_chat(req: ChatReq):
    """Non-streaming: returns the parsed final answer in one shot."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is empty")
    if not req.payments:
        raise HTTPException(status_code=400, detail="payments dataset is empty")

    messages = build_chat_messages(req)

    try:
        resp = await client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=1,
        )
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"LLM error: {type(e).__name__}: {e}")

    content = resp.choices[0].message.content or ""
    text_part, ids = split_ids(content)
    valid_ids = {p.id for p in req.payments}
    payment_ids = [pid for pid in ids if pid in valid_ids][:5]
    return ChatResp(text=text_part, paymentIds=payment_ids)


@app.post("/api/aml/chat/stream")
async def aml_chat_stream(req: ChatReq):
    """SSE stream. Events:
      {"type":"reasoning","text":"..."}  — reasoning summary delta (gray panel in UI)
      {"type":"delta","text":"..."}      — answer text delta
      {"type":"done","text":"<full>","paymentIds":[...]} — terminal event with parsed IDs
      {"type":"error","message":"..."}   — failure
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is empty")
    if not req.payments:
        raise HTTPException(status_code=400, detail="payments dataset is empty")

    system_prompt = build_system_prompt(req)
    input_messages = build_responses_input(req)
    valid_ids = {p.id for p in req.payments}

    async def gen():
        # Try Responses API first (reasoning summary support).
        answer_buffer = ""
        try:
            stream = await client.responses.create(
                model=LLM_MODEL,
                instructions=system_prompt,
                input=input_messages,
                reasoning={"effort": REASONING_EFFORT, "summary": "auto"},
                stream=True,
            )
            async for event in stream:
                etype = getattr(event, "type", "") or ""
                # Reasoning summary chunks (e.g. response.reasoning_summary_text.delta)
                if "reasoning" in etype and "delta" in etype:
                    delta = getattr(event, "delta", None) or getattr(event, "text", "") or ""
                    if delta:
                        yield json.dumps({"type": "reasoning", "text": delta})
                # Final answer text chunks (e.g. response.output_text.delta)
                elif "output_text" in etype and "delta" in etype:
                    delta = getattr(event, "delta", "") or ""
                    if delta:
                        answer_buffer += delta
                        yield json.dumps({"type": "delta", "text": delta})
                elif etype.endswith(".failed") or etype.endswith(".error"):
                    err = getattr(event, "error", None) or getattr(event, "message", "")
                    yield json.dumps({"type": "error", "message": str(err) or "stream failed"})
                    return
                elif etype.endswith(".completed"):
                    break
        except Exception as e:
            # Fall back to Chat Completions streaming (no reasoning summary surfaced).
            logger.warning("Responses API unavailable (%s: %s); falling back to chat completions stream", type(e).__name__, e)
            yield json.dumps({"type": "reasoning", "text": f"[Responses API unavailable, using chat completions stream]\n"})
            try:
                stream = await client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=build_chat_messages(req),
                    temperature=1,
                    stream=True,
                )
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        answer_buffer += delta
                        yield json.dumps({"type": "delta", "text": delta})
            except Exception as e2:
                logger.exception("Fallback stream failed")
                yield json.dumps({"type": "error", "message": f"{type(e2).__name__}: {e2}"})
                return

        text_part, ids = split_ids(answer_buffer)
        payment_ids = [pid for pid in ids if pid in valid_ids][:5]
        yield json.dumps({"type": "done", "text": text_part, "paymentIds": payment_ids})

    return EventSourceResponse(gen())


# ══════════════════════════════════════════════════════════════════════
#  Investigation Agent (Hermes-style)
#  Gathers multi-source evidence for a flagged payment, then an LLM
#  synthesizes an investigation package + recommendation for Legal.
#
#  Data-source lookups are MOCK (derived from the payment's own risk
#  signals). They are structured so real Tianyancha / Qichacha / Dow Jones
#  / internal APIs can drop in later without changing the agent flow.
# ══════════════════════════════════════════════════════════════════════

class InvestigateReq(BaseModel):
    payment: Payment
    vendorCountry: str = ""
    vendorSignals: List[str] = Field(default_factory=list)
    lang: Literal["en", "zh"] = "en"


# ── Deterministic mock data sources (Tianyancha / Dow Jones) ──────────
# Stable per-vendor (hash of name), and correlated with the payment's
# risk types so the "evidence" lines up with why it was flagged.
# All names are anonymized — not real persons/entities.
import hashlib

_CN_REPS = ["陈**", "王**", "李**", "张**", "刘**"]
_EN_REPS = ["Z. Chen", "L. Wang", "Y. Li", "H. Zhang", "J. Liu"]
_SCOPES_ZH = ["技术咨询与服务", "贸易与供应链", "物流与仓储", "原材料批发", "信息技术服务"]
_SCOPES_EN = ["tech consulting & services", "trading & supply chain", "logistics & warehousing",
              "raw-materials wholesale", "IT services"]
_MEDIA_ZH = ["涉采购回扣调查的报道", "关联方挪用资金的诉讼报道", "海关申报异常的负面报道"]
_MEDIA_EN = ["coverage of a procurement-kickback probe", "litigation over related-party fund diversion",
             "negative report on irregular customs declarations"]
_PEP_ROLES_ZH = ["某地方政府部门前官员的近亲属", "国有机构董事会成员关联人"]
_PEP_ROLES_EN = ["close relative of a former local-government official", "associate of a state-entity board member"]


def _seed(s: str) -> int:
    return int(hashlib.md5(s.encode("utf-8")).hexdigest(), 16)


def _pick(seed: int, arr):
    return arr[seed % len(arr)]


def mock_tianyancha(vendor: str, country: str, risk_types, lang: str):
    """Company registry profile + beneficial-owner penetration (mock)."""
    sd = _seed(vendor)
    zh = lang == "zh"
    offshore = country.upper() in {"BVI", "PA", "AE", "KZ"}
    items = []
    rep = _pick(sd, _CN_REPS if zh else _EN_REPS)
    scope = _pick(sd >> 3, _SCOPES_ZH if zh else _SCOPES_EN)
    small_cap = "docMissing" in risk_types or (sd % 3 == 0)
    cap = ("注册资本 50 万（与付款规模明显不匹配）" if small_cap else "注册资本 5,000 万") if zh \
        else ("registered capital RMB 500K (clearly mismatched to payment size)" if small_cap else "registered capital RMB 50M")
    items.append({"source": "天眼查" if zh else "Tianyancha",
                  "text": (f"法定代表人 {rep}；经营范围：{scope}；{cap}。" if zh
                           else f"Legal rep {rep}; business scope: {scope}; {cap}.")})

    # ownership penetration → UBO
    npA = _pick(sd, _CN_REPS if zh else _EN_REPS)
    npB = _pick(sd >> 5, _CN_REPS[::-1] if zh else _EN_REPS[::-1])
    if offshore:
        chain = ("股权穿透：本体 ← 离岸控股公司（持股 100%，受益所有人披露受限）← 名义股东；"
                 "最终受益人不可见。" if zh
                 else "Ownership penetration: entity ← offshore holding (100%, limited UBO disclosure) ← nominee shareholders; "
                      "ultimate beneficial owner not visible.")
    else:
        chain = (f"股权穿透：本体 ← 控股公司 X（60%）+ 自然人 {npA}（40%）；控股公司 X 由自然人 {npB}（90%）持有。"
                 f"最终受益人：{npB}（约 54%）、{npA}（40%）。" if zh
                 else f"Ownership penetration: entity ← HoldCo X (60%) + natural person {npA} (40%); HoldCo X is 90% held by {npB}. "
                      f"UBOs: {npB} (~54%), {npA} (40%).")
    if "pep" in risk_types:
        chain += ("最终受益人疑似 PEP 关联。" if zh else " One UBO is a probable PEP associate.")
    items.append({"source": "天眼查·股权穿透" if zh else "Tianyancha · UBO", "text": chain})

    if "adverseMedia" in risk_types or "behavior" in risk_types:
        items.append({"source": "天眼查·涉诉" if zh else "Tianyancha · litigation",
                      "text": ("存在 1 起合同纠纷、1 条行政处罚记录。" if zh
                               else "1 contract-dispute case and 1 administrative-penalty record on file.")})
    return items


def mock_dowjones(vendor: str, country: str, risk_types, lang: str):
    """Sanctions / watchlist / PEP / adverse-media screening (mock)."""
    sd = _seed(vendor)
    zh = lang == "zh"
    src = "Dow Jones"
    items = []
    # sanctions / watchlist
    if "geographic" in risk_types and sd % 2 == 0:
        items.append({"source": src, "text": ("观察名单：实体名称存在部分相似匹配，需人工排除。" if zh
                                               else "Watchlist: partial name-similarity match, needs manual clearing.")})
    else:
        items.append({"source": src, "text": ("制裁 / 观察名单：未命中。" if zh else "Sanctions / watchlist: no hit.")})
    # PEP
    if "pep" in risk_types:
        items.append({"source": src, "text": (f"PEP：命中 —— {_pick(sd, _PEP_ROLES_ZH)}。" if zh
                                               else f"PEP: hit — {_pick(sd, _PEP_ROLES_EN)}.")})
    # adverse media
    if "adverseMedia" in risk_types:
        items.append({"source": src, "text": (f"不利媒体（近 12 月）：{_pick(sd >> 2, _MEDIA_ZH)}。" if zh
                                               else f"Adverse media (last 12m): {_pick(sd >> 2, _MEDIA_EN)}.")})
    return items


_VENDOR_SIGNAL_FINDINGS = {
    "structuring": {"en": "Multiple sub-threshold payments cluster in a short window (structuring pattern).",
                    "zh": "短期内多笔低于阈值的付款聚集（拆分/化整为零特征）。"},
    "surge": {"en": "Payment frequency to this (relatively new) vendor surged versus its baseline.",
              "zh": "对该（较新）供应商的付款频率较基线突增。"},
    "cumulativeAlerts": {"en": "This vendor has repeatedly tripped high-precision rules across multiple payments.",
                         "zh": "该供应商在多笔付款中反复命中高精度规则。"},
}


def gather_evidence(req: InvestigateReq):
    """Deterministic mock evidence gathering (Tianyancha + Dow Jones + internal).
    Returns (steps, evidence)."""
    lang = req.lang
    zh = lang == "zh"
    p = req.payment
    country = (req.vendorCountry or "").upper()
    is_cn = country == "CN"
    steps, evidence = [], []

    # route + always run ownership penetration (beneficial owners matter for offshore too)
    if is_cn:
        steps.append("天眼查 / 企查查：基础信息、股权穿透与受益人、涉诉" if zh
                     else "Tianyancha / Qichacha: profile, ownership/UBO penetration, litigation")
        steps.append("Dow Jones：制裁 / 观察名单、PEP、不利媒体" if zh
                     else "Dow Jones: sanctions / watchlist, PEP, adverse media")
        evidence += mock_tianyancha(p.vendor, country, p.riskTypes, lang)
        evidence += mock_dowjones(p.vendor, country, p.riskTypes, lang)
    else:
        steps.append("Dow Jones：制裁 / 观察名单、PEP、不利媒体" if zh
                     else "Dow Jones: sanctions / watchlist, PEP, adverse media")
        steps.append("登记机构：股权穿透与受益人（离岸主体）" if zh
                     else "Registry: ownership / UBO penetration (offshore entity)")
        evidence += mock_dowjones(p.vendor, country, p.riskTypes, lang)
        evidence += mock_tianyancha(p.vendor, country, p.riskTypes, lang)  # provides ownership/UBO block

    steps.append("内部：历史付款时间线、收款账户与关联图谱" if zh
                 else "Internal: payment-history timeline, receiving accounts, relationship graph")
    for s in req.vendorSignals:
        vf = _VENDOR_SIGNAL_FINDINGS.get(s)
        if vf:
            evidence.append({"source": ("内部" if zh else "Internal"), "text": vf[lang]})

    if not evidence:
        evidence.append({"source": "Dow Jones",
                         "text": ("未发现额外外部风险信号。" if zh else "No additional external risk signals found.")})
    return steps, evidence


REC_MARKER = "__REC__:"

INVESTIGATE_PROMPT_EN = f"""You are an AML investigation agent supporting the Legal team. You are given a flagged payment and the evidence already gathered: company registry profile + ownership/beneficial-owner (UBO) penetration (Tianyancha/registry), sanctions/watchlist/PEP/adverse-media screening (Dow Jones), and internal signals. Synthesize a concise investigation package. Call out the beneficial owners and any opaque/nominee ownership explicitly.

Write in English. Output format — analysis text first, then a recommendation line:

<2-4 short sentences. Use <strong>...</strong> on key entities/numbers. Optionally a short <ul><li>...</li></ul>.>
{REC_MARKER}escalate | investigate | clear

Where:
- escalate  = strong evidence, send to enhanced review / consider holding payment
- investigate = needs more evidence before a conclusion
- clear = evidence suggests a likely-benign business explanation
Base everything strictly on the provided evidence. Do not invent facts."""

INVESTIGATE_PROMPT_ZH = f"""你是支持法务团队的 AML 调查 Agent。系统会给你一笔被标记的付款，以及已收集的证据：公司基础信息 + 股权穿透/最终受益人（天眼查/登记）、制裁/观察名单/PEP/不利媒体筛查（Dow Jones）、以及内部信号。请综合给出一份简洁的调查结论包，并明确点出最终受益人及任何不透明/名义股东情况。

用中文回答。输出格式 —— 先分析文字，再一行建议：

<2-4 句短句。关键主体/数字用 <strong>...</strong>。可选简短 <ul><li>...</li></ul>。>
{REC_MARKER}escalate | investigate | clear

其中：
- escalate   = 证据较强，升级强化复核/考虑暂停付款
- investigate = 需补充更多证据才能定性
- clear      = 证据显示很可能有合规的业务解释
所有结论严格基于所给证据，不得编造。"""


@app.post("/api/aml/investigate/stream")
async def aml_investigate_stream(req: InvestigateReq):
    p = req.payment
    steps, evidence = gather_evidence(req)
    base_prompt = INVESTIGATE_PROMPT_ZH if req.lang == "zh" else INVESTIGATE_PROMPT_EN
    ev_text = "\n".join(f"- [{e['source']}] {e['text']}" for e in evidence)
    context = (
        f"Payment: {p.id} | vendor: {p.vendor} ({req.vendorCountry}) | amount: {p.amount} | "
        f"category: {p.category} | total score: {p.total} | risk types: {', '.join(p.riskTypes)} | "
        f"vendor signals: {', '.join(req.vendorSignals) or 'none'}\n\nGathered evidence:\n{ev_text}"
    )

    async def gen():
        # 1) emit the evidence-gathering steps
        for s in steps:
            yield json.dumps({"type": "step", "text": s})
        for e in evidence:
            yield json.dumps({"type": "evidence", "source": e["source"], "text": e["text"]})

        # 2) LLM synthesizes the package
        input_messages = [{"role": "user", "content": context}]
        answer = ""
        try:
            stream = await client.responses.create(
                model=LLM_MODEL,
                instructions=base_prompt,
                input=input_messages,
                reasoning={"effort": REASONING_EFFORT, "summary": "auto"},
                stream=True,
            )
            async for event in stream:
                etype = getattr(event, "type", "") or ""
                if "reasoning" in etype and "delta" in etype:
                    delta = getattr(event, "delta", None) or getattr(event, "text", "") or ""
                    if delta:
                        yield json.dumps({"type": "reasoning", "text": delta})
                elif "output_text" in etype and "delta" in etype:
                    delta = getattr(event, "delta", "") or ""
                    if delta:
                        answer += delta
                        yield json.dumps({"type": "delta", "text": delta})
                elif etype.endswith(".completed"):
                    break
                elif etype.endswith(".failed") or etype.endswith(".error"):
                    yield json.dumps({"type": "error", "message": "stream failed"})
                    return
        except Exception as e:
            logger.warning("Investigate Responses API failed (%s), falling back", e)
            try:
                resp = await client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=[{"role": "system", "content": base_prompt}, {"role": "user", "content": context}],
                    temperature=1,
                    stream=True,
                )
                async for chunk in resp:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        answer += delta
                        yield json.dumps({"type": "delta", "text": delta})
            except Exception as e2:
                logger.exception("Investigate fallback failed")
                yield json.dumps({"type": "error", "message": f"{type(e2).__name__}: {e2}"})
                return

        rec = ""
        text = answer
        if REC_MARKER in answer:
            head, tail = answer.rsplit(REC_MARKER, 1)
            text = head.strip()
            rec = tail.strip().split()[0] if tail.strip() else ""
        yield json.dumps({"type": "done", "text": text, "recommendation": rec})

    return EventSourceResponse(gen())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
