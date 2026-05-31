"""Run 产物访问（Phase 4a）。

生成完成后，deck 落在 workspace/runs/<id>/（index.html + source/）。
前端完成态要：① 真缩略图（读 source/slide_plan.json 的 pages）② 内嵌预览生成的 deck（serve index.html）。

只读、单机、无账号。路径严格沙箱在 RUNS 之内，rid 只允许安全字符。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from setup_workspace import RUNS

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


def _run_dir(rid: str) -> Path | None:
    """解析 run 目录，越界 / 非法 id / 不存在 → None。"""
    if not rid or not _SAFE_ID.match(rid):
        return None
    d = (RUNS / rid).resolve()
    try:
        d.relative_to(RUNS.resolve())
    except ValueError:
        return None
    return d if d.is_dir() else None


def _load_plan(d: Path) -> dict | None:
    p = d / "source" / "slide_plan.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def list_runs() -> list[dict]:
    """按修改时间倒序列出所有 run（id / 标题 / 页数 / 是否有 html）。"""
    if not RUNS.exists():
        return []
    out = []
    for d in RUNS.iterdir():
        if not d.is_dir():
            continue
        plan = _load_plan(d)
        pages = (plan or {}).get("pages") or []
        meta = (plan or {}).get("deck_meta") or {}
        out.append({
            "id": d.name,
            "title": meta.get("deck_title") or meta.get("title") or d.name,
            "pages": len(pages),
            "has_html": (d / "index.html").exists(),
            "mtime": d.stat().st_mtime,
        })
    out.sort(key=lambda r: r["mtime"], reverse=True)
    return out


def get_plan(rid: str) -> dict | None:
    """slide_plan.json（含 pages，用于缩略图）；不存在 → None。"""
    d = _run_dir(rid)
    return _load_plan(d) if d else None


def index_html_path(rid: str) -> Path | None:
    """生成的 deck index.html 绝对路径（用于内嵌预览）；不存在 → None。"""
    d = _run_dir(rid)
    if not d:
        return None
    p = d / "index.html"
    return p if p.exists() else None
