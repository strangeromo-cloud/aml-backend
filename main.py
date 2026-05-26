"""
AML Chat Backend — thin LLM proxy for the AML Identifier demo.

Exposes POST /api/aml/chat. Takes the payment dataset + user message + history,
calls an OpenAI-compatible chat completions endpoint with an AML-analyst system
prompt, returns structured JSON the frontend can render.
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

load_dotenv()

LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
PORT = int(os.getenv("PORT", "8080"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aml-chat")

if not LLM_API_KEY:
    raise RuntimeError("LLM_API_KEY must be set in environment (.env or platform env vars).")

client = AsyncOpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)

app = FastAPI(title="AML Chat Backend", version="0.1.0")
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


SYSTEM_PROMPT_EN = """You are an AML (anti-money-laundering) risk analyst assistant embedded in an internal compliance tool. You help the Legal team analyze flagged payments, surface patterns, and locate payments by vendor or by risk dimension.

Six analysis dimensions used by the system:
- geographic — high-risk jurisdictions, offshore entities, country/bank/invoice mismatch
- pep — Politically Exposed Person ownership or close relationships
- adverseMedia — negative media on corruption, fraud, sanctions exposure
- docMissing — missing PO/contract, or business mismatch vs. procurement category
- timeAnomaly — new vendor surge, weekend/holiday transactions
- behavior — suspicious account routing, fake invoices, irregular payment patterns

Risk levels: High = total score >= 70; Medium = 50-69.

The payments dataset below is the SINGLE source of truth. Do not fabricate payments, vendors, amounts, or scores. If the user asks something not answerable from this dataset, say so plainly.

Behavior:
- Vendor lookup → match payments whose vendor name contains the queried token (case-insensitive, partial match OK).
- Risk dimension query → list payments whose riskTypes include that dimension; give count + total amount + vendor count.
- High-risk / top / overview → list highest total scores first.
- Aggregate first, then cite specific payments.
- Be concise and actionable; do not pad.

Output requirement — return ONLY a strict JSON object, no markdown fences, no extra prose:
{
  "text": "Concise analysis (<= 4 short sentences). Use <strong>X</strong> for emphasis on key numbers or vendor names. Optionally use <ul><li>...</li></ul> for short bullets.",
  "paymentIds": ["PAY-..."]   // up to 5 most relevant payment IDs from the dataset; empty list if nothing relevant
}
"""

SYSTEM_PROMPT_ZH = """你是嵌入在合规系统中的 AML（反洗钱）风险分析助手。你帮助法务团队分析被标记的付款、发现模式，并按供应商或风险维度定位付款。

系统使用的六个分析维度：
- geographic 地理风险 — 高风险司法管辖区、离岸实体、国家/银行/发票不一致
- pep PEP 人物 — 政治公众人物持股或紧密关联
- adverseMedia 不利媒体 — 腐败、欺诈、制裁相关负面媒体报道
- docMissing 文件缺失 — 缺少 PO/合同，或业务范围与采购品类不匹配
- timeAnomaly 时间异常 — 新供应商付款突增、周末/节假日交易
- behavior 行为指标 — 可疑账户路由、虚假发票、异常付款模式

风险等级：High = 总分 ≥ 70；Medium = 50-69。

下方付款数据集是唯一事实来源。不要编造付款、供应商、金额或分数。若用户问题无法基于该数据集回答，直说即可。

行为规范：
- 供应商查询 → 按供应商名做（不区分大小写的）部分包含匹配。
- 风险维度查询 → 列出 riskTypes 包含该维度的付款；给出数量、总金额、涉及供应商数。
- 高风险 / Top / 概览 → 按总分从高到低排序。
- 先聚合数据，再点出具体付款。
- 简洁、可执行，不要冗余。

输出要求 — 仅返回严格的 JSON 对象，不要 markdown 围栏，不要多余文字：
{
  "text": "简洁分析（≤ 4 句短句）。可用 <strong>X</strong> 强调关键数字或供应商名。可选 <ul><li>...</li></ul> 列项。",
  "paymentIds": ["PAY-..."]   // 最多 5 个最相关的付款编号；无相关则空数组
}
"""


def build_messages(req: ChatReq) -> list[dict]:
    base_prompt = SYSTEM_PROMPT_ZH if req.lang == "zh" else SYSTEM_PROMPT_EN
    payments_json = json.dumps([p.model_dump() for p in req.payments], ensure_ascii=False)
    system = f"{base_prompt}\n\nPayments dataset (JSON array):\n{payments_json}"
    messages = [{"role": "system", "content": system}]
    for turn in req.history[-6:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": req.message})
    return messages


def extract_json(content: str) -> dict:
    content = (content or "").strip()
    if content.startswith("```"):
        content = content.strip("`")
        if content.lower().startswith("json"):
            content = content[4:].strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start:end + 1])
        raise


@app.get("/api/health")
async def health():
    return {"ok": True, "model": LLM_MODEL, "base_url": LLM_BASE_URL}


@app.post("/api/aml/chat", response_model=ChatResp)
async def aml_chat(req: ChatReq):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is empty")
    if not req.payments:
        raise HTTPException(status_code=400, detail="payments dataset is empty")

    messages = build_messages(req)

    # temperature=1 is the only value newer reasoning-class models (e.g. gpt-5.x)
    # accept. Lower-tier models accept any value, so 1 is a safe universal default.
    try:
        resp = await client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=1,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        logger.warning("first call failed (%s), retrying without response_format", e)
        try:
            resp = await client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=1,
            )
        except Exception as e2:
            logger.exception("LLM call failed")
            raise HTTPException(status_code=502, detail=f"LLM error: {type(e2).__name__}: {e2}")

    content = resp.choices[0].message.content or "{}"
    try:
        data = extract_json(content)
    except Exception:
        logger.warning("Could not parse JSON from LLM, returning raw text. Raw: %r", content[:200])
        return ChatResp(text=content, paymentIds=[])

    text = str(data.get("text", "")).strip()
    raw_ids = data.get("paymentIds") or []
    valid_ids = {p.id for p in req.payments}
    payment_ids = [pid for pid in raw_ids if pid in valid_ids][:5]
    return ChatResp(text=text, paymentIds=payment_ids)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
