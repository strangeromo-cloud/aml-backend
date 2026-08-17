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
  BASELINE_UPLOAD_TOKEN  Shared secret required to upload; unset means uploads are off
  GH_REPO_TOKEN   GitHub token with contents:write on the pipeline repo
  GH_REPO         owner/name, default strangeromo-cloud/aml
  GH_BRANCH       default main
"""
from __future__ import annotations

import base64
import hmac
import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Any, Optional

import httpx
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from openpyxl import load_workbook
from pydantic import BaseModel

logger = logging.getLogger("aml-chat.fatf-baseline")
router = APIRouter(prefix="/api/aml/fatf-baseline", tags=["fatf-baseline"])

# The baseline is the authority the whole FATF comparison rests on, so the write path
# is gated. Reads are not: they only expose the FATF lists, which are public.
UPLOAD_TOKEN = os.getenv("BASELINE_UPLOAD_TOKEN", "").strip()

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


def require_token(supplied: Optional[str]) -> None:
    """Fail closed: an unconfigured token means writes are refused, never waved through.

    Compared with compare_digest so a wrong guess cannot be narrowed down by timing.
    """
    if not UPLOAD_TOKEN:
        raise HTTPException(503, "服务器未配置 BASELINE_UPLOAD_TOKEN，基线上传已停用。"
                                 "请在部署环境变量里设置后重试。")
    if not supplied or not hmac.compare_digest(supplied.strip(), UPLOAD_TOKEN):
        raise HTTPException(401, "上传口令不正确。")


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
        # Say which operation is blocked: the same token gates reads and writes, and
        # "无法写入" on a history page just looks like a bug.
        what = "读取" if method.upper() == "GET" else "写入"
        raise HTTPException(503, f"服务器未配置 GH_REPO_TOKEN，无法{what}仓库。"
                                 f"请在部署环境变量里设置后重试。")
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


@router.get("/status")
async def status() -> dict[str, Any]:
    """Is baseline upload actually usable right now?

    The token lives here, not in CI, so CI cannot inspect it — it asks this instead.
    Reports configuration, repo reachability, whether the token can actually write,
    and when it expires: a fine-grained PAT expires silently, and "discovered on the
    day Legal needs to update the baseline" is the failure mode worth avoiding.
    Returns no secret values.
    """
    out: dict[str, Any] = {
        "uploadTokenConfigured": bool(UPLOAD_TOKEN),
        "repoTokenConfigured": bool(GH_REPO_TOKEN),
        "repo": f"{GH_REPO}:{GH_BRANCH}", "path": BASELINE_PATH,
        "repoReadable": False, "canWrite": None,
        "tokenExpiresAt": None, "baselineFound": None, "error": None,
    }
    if not GH_REPO_TOKEN:
        out["error"] = "GH_REPO_TOKEN 未配置"
        out["ready"] = False
        return out
    try:
        r = await _gh("GET", f"/repos/{GH_REPO}")
    except HTTPException as e:
        out["error"] = str(e.detail)
        out["ready"] = False
        return out
    # GitHub returns this header for fine-grained tokens; classic tokens omit it.
    out["tokenExpiresAt"] = r.headers.get("github-authentication-token-expiration")
    if r.status_code == 401:
        out["error"] = "GH_REPO_TOKEN 无效或已过期（GitHub 返回 401）"
        out["ready"] = False
        return out
    if r.status_code >= 400:
        out["error"] = f"读取仓库信息失败：{r.status_code}"
        out["ready"] = False
        return out
    out["repoReadable"] = True
    # permissions.push is the closest thing to "can write contents" without writing.
    out["canWrite"] = bool((r.json().get("permissions") or {}).get("push"))
    try:
        data, _ = await fetch_current()
        out["baselineFound"] = data is not None
        if data:
            out["listDate"] = parse_workbook(data)["listDate"]
    except HTTPException as e:
        out["error"] = str(e.detail)
    out["ready"] = bool(out["uploadTokenConfigured"] and out["repoReadable"]
                        and out["canWrite"] and out["baselineFound"])
    return out


@router.get("/auth")
async def auth(x_upload_token: Optional[str] = Header(None)) -> dict[str, Any]:
    """Lets the page check a token before the user picks a file."""
    require_token(x_upload_token)
    return {"ok": True}


@router.post("/validate")
async def validate(file: UploadFile = File(...),
                   x_upload_token: Optional[str] = Header(None)) -> dict[str, Any]:
    """Parse + validate the upload and show what would change. Writes nothing."""
    require_token(x_upload_token)
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
                 confirmedDate: str = Form(...),
                 x_upload_token: Optional[str] = Header(None)) -> CommitResp:
    """Commit the workbook, but only if it still matches what was validated.

    confirmedDate is the list date the uploader saw in the preview: if the file has
    been swapped between preview and confirm, the dates disagree and this refuses.
    """
    require_token(x_upload_token)
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


# ── Version history ─────────────────────────────────────────────────────
# The repo IS the history: every commit touching the baseline is a version, and git
# makes that record tamper-evident for free. The list view is built from commit
# messages so it costs one API call; the detail view fetches and parses that specific
# version on demand, which is what "查看当时的记录" needs.

_MSG_DATE = re.compile(r"基线更新至\s*(\d{4}-\d{2}-\d{2})")
_MSG_COUNTS = re.compile(r"黑\s*(\d+)\s*/\s*灰\s*(\d+)")
_MSG_UPLOADER = re.compile(r"由\s*(.+?)\s*于\s*([\d\-: ]+)\s*通过基线上传页提交")


def _from_message(msg: str) -> dict[str, Any]:
    """Metadata the upload page wrote into the commit message, when present.

    Commits made directly with git (not through this page) simply have none of it;
    the detail view still works because it parses the file itself.
    """
    out: dict[str, Any] = {}
    m = _MSG_DATE.search(msg)
    if m:
        out["listDate"] = m.group(1)
    m = _MSG_COUNTS.search(msg)
    if m:
        out["counts"] = {"black": int(m.group(1)), "grey": int(m.group(2))}
    m = _MSG_UPLOADER.search(msg)
    if m:
        out["uploader"], out["uploadedAt"] = m.group(1), m.group(2).strip()
    return out


@router.get("/history")
async def history(limit: int = 30) -> dict[str, Any]:
    """Every version of the baseline, newest first."""
    r = await _gh("GET", f"/repos/{GH_REPO}/commits",
                  params={"path": BASELINE_PATH, "sha": GH_BRANCH,
                          "per_page": max(1, min(limit, 100))})
    if r.status_code >= 400:
        raise HTTPException(502, f"读取版本历史失败：{r.status_code} {r.text[:180]}")
    items = []
    for c in r.json():
        msg = (c.get("commit") or {}).get("message") or ""
        items.append({
            "sha": c.get("sha"),
            "shortSha": (c.get("sha") or "")[:8],
            "committedAt": ((c.get("commit") or {}).get("committer") or {}).get("date"),
            "author": ((c.get("commit") or {}).get("author") or {}).get("name"),
            "subject": msg.split("\n")[0],
            "viaUploadPage": "通过基线上传页提交" in msg,
            "commitUrl": c.get("html_url"),
            **_from_message(msg),
        })
    return {"repo": f"{GH_REPO}:{GH_BRANCH}", "path": BASELINE_PATH,
            "count": len(items), "versions": items}


@router.get("/history/{sha}")
async def history_detail(sha: str) -> dict[str, Any]:
    """The baseline exactly as it stood at one version, plus what that change did."""
    if not re.fullmatch(r"[0-9a-fA-F]{7,40}", sha):
        raise HTTPException(422, "版本号格式不正确")

    async def at(ref: str) -> dict[str, Any] | None:
        rr = await _gh("GET", f"/repos/{GH_REPO}/contents/{BASELINE_PATH}",
                       params={"ref": ref})
        if rr.status_code == 404:
            return None
        if rr.status_code >= 400:
            raise HTTPException(502, f"读取该版本失败：{rr.status_code} {rr.text[:160]}")
        return parse_workbook(base64.b64decode(rr.json()["content"]))

    this = await at(sha)
    if not this:
        raise HTTPException(404, "该版本里没有基线文件")

    # The parent commit of this one gives "what changed in this version".
    prev = None
    rc = await _gh("GET", f"/repos/{GH_REPO}/commits/{sha}")
    if rc.status_code < 400:
        parents = rc.json().get("parents") or []
        if parents:
            try:
                prev = await at(parents[0]["sha"])
            except HTTPException:
                prev = None
        meta = rc.json()
        commit_info = {
            "sha": meta.get("sha"),
            "committedAt": ((meta.get("commit") or {}).get("committer") or {}).get("date"),
            "author": ((meta.get("commit") or {}).get("author") or {}).get("name"),
            "message": (meta.get("commit") or {}).get("message"),
            "commitUrl": meta.get("html_url"),
            **_from_message((meta.get("commit") or {}).get("message") or ""),
        }
    else:
        commit_info = {"sha": sha}

    return {
        "commit": commit_info,
        "listDate": this["listDate"],
        "counts": {"black": len(this["normBlack"]), "grey": len(this["normGrey"])},
        "black": this["black"], "grey": this["grey"],
        "changeInThisVersion": diff(prev, this) if prev else None,
        "downloadUrl": (f"https://raw.githubusercontent.com/{GH_REPO}/{sha}/"
                        f"{BASELINE_PATH}"),
    }


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
