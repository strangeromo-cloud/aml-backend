"""Upload endpoint for the Legal-maintained FATF baseline workbook.

Why this exists: the daily pipeline in strangeromo-cloud/aml reads the baseline from
seeds/fatf-baseline.xlsx in that repo, and Legal cannot reasonably be expected to
commit to GitHub. This accepts the workbook they edit, validates it, shows them what
would change, and — only after they confirm — commits it through the GitHub API. The
pipeline itself needs no change: its next run picks the new file up and the emailed
attachment carries it.

Two-step on purpose. This file is the authority the whole comparison rests on, so a
mis-uploaded workbook must never replace it silently: /validate parses and returns a
diff, /commit writes only what /validate already approved.

Env:
  GH_REPO_TOKEN   GitHub token with contents:write on the pipeline repo
  GH_REPO         owner/name, default strangeromo-cloud/aml
  GH_BRANCH       default main
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Any, Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from openpyxl import load_workbook
from pydantic import BaseModel

logger = logging.getLogger("aml-chat.fatf-baseline")
router = APIRouter(prefix="/api/aml/fatf-baseline", tags=["fatf-baseline"])

GH_REPO_TOKEN = os.getenv("GH_REPO_TOKEN", "").strip()
GH_REPO = os.getenv("GH_REPO", "strangeromo-cloud/aml").strip()
GH_BRANCH = os.getenv("GH_BRANCH", "main").strip()
BASELINE_PATH = "scripts/data-refresh/seeds/fatf-baseline.xlsx"
SHEET_NAME = "FATF 黑灰名单"
TZ_SHANGHAI = timezone(timedelta(hours=8))

# Same bounds the pipeline enforces, so a workbook accepted here cannot be rejected
# there. Keep in step with verify_fatf.validate_rows.
BLACK_RANGE = (1, 6)
GREY_RANGE = (8, 40)
MAX_BYTES = 2 * 1024 * 1024

ALIASES = {
    "democratic peoples republic of korea": "north korea",
    "democratic republic of korea": "north korea",
    "korea democratic peoples republic of": "north korea",
    "dprk": "north korea",
    "burma": "myanmar",
    "virgin islands uk": "british virgin islands",
    "virgin islands british": "british virgin islands",
    "democratic republic of congo": "democratic republic of the congo",
    "lao peoples democratic republic": "laos",
    "lao pdr": "laos",
    "syrian arab republic": "syria",
    "united republic of tanzania": "tanzania",
    "viet nam": "vietnam",
}


def norm(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name or "")
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    s = re.sub(r"[^a-z\s]", "", ascii_only.lower()).strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"^the ", "", s)
    return ALIASES.get(s, s)


def parse_workbook(data: bytes) -> dict[str, Any]:
    """Parse and validate an uploaded baseline workbook.

    Raises HTTPException(422) with a message Legal can act on — every rejection names
    what is wrong and where, because "上传失败" alone would just get retried.
    """
    if not data:
        raise HTTPException(422, "文件为空")
    if len(data) > MAX_BYTES:
        raise HTTPException(422, f"文件超过 {MAX_BYTES // 1024 // 1024} MB")
    try:
        wb = load_workbook(BytesIO(data), data_only=True)
    except Exception as e:
        raise HTTPException(422, f"无法作为 Excel 打开（{type(e).__name__}）。"
                                 f"请确认是 .xlsx 文件，不是 .xls 或 CSV。")
    if SHEET_NAME not in wb.sheetnames:
        raise HTTPException(422, f"找不到工作表「{SHEET_NAME}」。"
                                 f"当前工作表：{', '.join(wb.sheetnames)}")
    ws = wb[SHEET_NAME]

    note = str(ws.cell(1, 1).value or "")
    m = re.search(r"(\d{4}-\d{2}-\d{2})", note)
    if not m:
        raise HTTPException(422, "第 1 行说明里找不到名单日期。"
                                 "请在第 1 行写入 FATF 声明日期，格式 YYYY-MM-DD（例如 2026-10-23）。")
    list_date = m.group(1)

    black: list[str] = []
    grey: list[str] = []
    for r in range(3, ws.max_row + 1):
        lst, juris = ws.cell(r, 1).value, ws.cell(r, 2).value
        if not juris:
            continue
        label = str(lst or "")
        if "Black" in label or "黑" in label:
            black.append(str(juris).strip())
        elif "Grey" in label or "灰" in label:
            grey.append(str(juris).strip())
        else:
            raise HTTPException(422, f"第 {r} 行的「名单 List」既不是黑名单也不是灰名单："
                                     f"{label!r}。请填「黑名单 Black」或「灰名单 Grey」。")

    nb, ng = {norm(x) for x in black} - {""}, {norm(x) for x in grey} - {""}
    if not (BLACK_RANGE[0] <= len(nb) <= BLACK_RANGE[1]):
        raise HTTPException(422, f"黑名单 {len(nb)} 条，超出合理范围 {BLACK_RANGE[0]}–{BLACK_RANGE[1]} 条。"
                                 f"FATF 黑名单历来只有 1–5 个辖区，请检查是否填错列。")
    if not (GREY_RANGE[0] <= len(ng) <= GREY_RANGE[1]):
        raise HTTPException(422, f"灰名单 {len(ng)} 条，超出合理范围 {GREY_RANGE[0]}–{GREY_RANGE[1]} 条。")
    overlap = nb & ng
    if overlap:
        raise HTTPException(422, f"同一辖区同时出现在黑灰名单：{', '.join(sorted(overlap))}")

    return {"listDate": list_date, "black": sorted(black), "grey": sorted(grey),
            "normBlack": nb, "normGrey": ng, "rowCount": len(black) + len(grey)}


# ── GitHub ──────────────────────────────────────────────────────────────

async def _gh(method: str, path: str, **kw) -> httpx.Response:
    if not GH_REPO_TOKEN:
        raise HTTPException(503, "服务器未配置 GH_REPO_TOKEN，无法写入仓库。"
                                 "请在部署环境变量里设置后重试。")
    headers = {"Authorization": f"Bearer {GH_REPO_TOKEN}",
               "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
    async with httpx.AsyncClient(timeout=30) as c:
        return await c.request(method, f"https://api.github.com{path}", headers=headers, **kw)


async def fetch_current() -> tuple[bytes | None, str | None]:
    """(file bytes, blob sha) of the baseline currently in the repo."""
    r = await _gh("GET", f"/repos/{GH_REPO}/contents/{BASELINE_PATH}",
                  params={"ref": GH_BRANCH})
    if r.status_code == 404:
        return None, None
    if r.status_code >= 400:
        raise HTTPException(502, f"读取仓库现有基线失败：{r.status_code} {r.text[:180]}")
    j = r.json()
    return base64.b64decode(j["content"]), j["sha"]


def diff(cur: dict[str, Any] | None, new: dict[str, Any]) -> dict[str, Any]:
    if not cur:
        return {"firstUpload": True, "dateFrom": None, "dateTo": new["listDate"],
                "blackAdded": new["black"], "blackRemoved": [],
                "greyAdded": new["grey"], "greyRemoved": [], "identical": False}
    by_norm_new = {norm(x): x for x in new["black"] + new["grey"]}
    by_norm_cur = {norm(x): x for x in cur["black"] + cur["grey"]}

    def names(keys):
        return sorted(by_norm_new.get(k) or by_norm_cur.get(k) or k for k in keys)

    d = {
        "firstUpload": False,
        "dateFrom": cur["listDate"], "dateTo": new["listDate"],
        "blackAdded": names(new["normBlack"] - cur["normBlack"]),
        "blackRemoved": names(cur["normBlack"] - new["normBlack"]),
        "greyAdded": names(new["normGrey"] - cur["normGrey"]),
        "greyRemoved": names(cur["normGrey"] - new["normGrey"]),
    }
    d["identical"] = (cur["listDate"] == new["listDate"]
                      and not any(d[k] for k in
                                  ("blackAdded", "blackRemoved", "greyAdded", "greyRemoved")))
    return d


class CommitResp(BaseModel):
    committed: bool
    # Optional[...] rather than `str | None`: Pydantic evaluates model annotations at
    # class creation, and the PEP 604 form fails on Python 3.9 even under
    # `from __future__ import annotations`.
    commitUrl: Optional[str] = None
    message: str


@router.post("/validate")
async def validate(file: UploadFile = File(...)) -> dict[str, Any]:
    """Parse + validate the upload and show what would change. Writes nothing."""
    data = await file.read()
    new = parse_workbook(data)
    try:
        cur_bytes, _ = await fetch_current()
        cur = parse_workbook(cur_bytes) if cur_bytes else None
        repo_readable = True
        repo_error = None
    except HTTPException as e:
        # A diff is nice to have; a validation result is not worth losing because the
        # repo is briefly unreachable.
        cur, repo_readable, repo_error = None, False, e.detail
    return {
        "ok": True,
        "filename": file.filename,
        "listDate": new["listDate"],
        "counts": {"black": len(new["normBlack"]), "grey": len(new["normGrey"])},
        "black": new["black"], "grey": new["grey"],
        "diff": diff(cur, new) if repo_readable else None,
        "repoReadable": repo_readable, "repoError": repo_error,
        "note": ("确认后提交，将写入仓库 "
                 f"{GH_REPO}:{GH_BRANCH}/{BASELINE_PATH}，"
                 "次日自动邮件的附件即使用新基线。"),
    }


@router.post("/commit", response_model=CommitResp)
async def commit(file: UploadFile = File(...),
                 uploader: str = Form(...),
                 confirmedDate: str = Form(...)) -> CommitResp:
    """Commit the workbook, but only if it still matches what was validated.

    confirmedDate is the list date the uploader saw in the preview: if the file has
    been swapped between preview and confirm, the dates disagree and this refuses.
    """
    data = await file.read()
    new = parse_workbook(data)
    if new["listDate"] != confirmedDate.strip():
        raise HTTPException(409, f"文件与预览时不一致（预览名单日期 {confirmedDate}，"
                                 f"当前文件 {new['listDate']}）。请重新预览后再提交。")
    if not uploader.strip():
        raise HTTPException(422, "请填写上传人，提交记录需要留痕。")

    _, sha = await fetch_current()
    stamp = datetime.now(TZ_SHANGHAI).strftime("%Y-%m-%d %H:%M")
    body = {
        "message": (f"chore(fatf): 基线更新至 {new['listDate']}"
                    f"（黑 {len(new['normBlack'])} / 灰 {len(new['normGrey'])}）\n\n"
                    f"由 {uploader.strip()} 于 {stamp} 通过基线上传页提交。\n"
                    f"次日定时运行的邮件附件将使用此基线。"),
        "content": base64.b64encode(data).decode(),
        "branch": GH_BRANCH,
    }
    if sha:
        body["sha"] = sha
    r = await _gh("PUT", f"/repos/{GH_REPO}/contents/{BASELINE_PATH}", json=body)
    if r.status_code >= 400:
        raise HTTPException(502, f"提交仓库失败：{r.status_code} {r.text[:200]}")
    j = r.json()
    url = (j.get("commit") or {}).get("html_url")
    logger.info("FATF baseline committed by %s → %s (%s)", uploader, new["listDate"], url)
    return CommitResp(committed=True, commitUrl=url,
                      message=(f"已提交。基线名单日期 {new['listDate']}，"
                               f"黑 {len(new['normBlack'])} / 灰 {len(new['normGrey'])}。"
                               f"次日自动邮件的附件将使用此基线。"))


@router.get("/current")
async def current() -> dict[str, Any]:
    """What the pipeline is using right now, so the page can show it side by side."""
    try:
        cur_bytes, _ = await fetch_current()
    except HTTPException as e:
        return {"available": False, "error": e.detail}
    if not cur_bytes:
        return {"available": False, "error": "仓库里还没有基线文件"}
    cur = parse_workbook(cur_bytes)
    return {"available": True, "listDate": cur["listDate"],
            "counts": {"black": len(cur["normBlack"]), "grey": len(cur["normGrey"])},
            "black": cur["black"], "grey": cur["grey"],
            "repo": f"{GH_REPO}:{GH_BRANCH}", "path": BASELINE_PATH}
