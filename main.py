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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
