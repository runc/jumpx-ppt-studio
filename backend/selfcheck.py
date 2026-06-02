"""首启动自检（Phase 5）。

单机应用启动前，验证四件事就位，缺什么就提示装什么：
  1. .env 配置（ARK_BASE_URL / ARK_API_KEY 必需）
  2. skill 已挂进 workspace（缺则自动 ensure_workspace 修）
  3. 渲染引擎 chromium 就位（导出 PDF/PNG/PPTX 必需）
  4. python 依赖（playwright / python-pptx）+ 活动配方契约校验

CLI：`python selfcheck.py`（打印报告；有 CRITICAL 失败则退出码 1）。
Docker entrypoint 启动前调用它，给用户清晰的「缺什么、怎么补」。
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

OK, WARN, FAIL = "ok", "warn", "fail"


def _check(name, status, msg, fix=""):
    return {"name": name, "status": status, "msg": msg, "fix": fix}


def check_env() -> dict:
    load_dotenv()
    missing = [k for k in ("ARK_BASE_URL", "ARK_API_KEY") if not os.environ.get(k)]
    if missing:
        return _check(".env 模型配置", FAIL, f"缺 {', '.join(missing)}",
                      "复制 backend/.env.example 为 backend/.env 并填入火山方舟 base_url/api_key")
    model = os.environ.get("ARK_MODEL", "ark-code-latest")
    return _check(".env 模型配置", OK, f"ARK_BASE_URL/API_KEY 就位，model={model}")


def check_skill() -> dict:
    try:
        from setup_workspace import SKILL_DST, SKILL_SRC, ensure_workspace
        if (SKILL_DST / "SKILL.md").exists():
            return _check("skill 挂载", OK, f"已挂载：{SKILL_DST}")
        if SKILL_SRC.exists():
            ensure_workspace()
            return _check("skill 挂载", OK, f"已自动挂载：{SKILL_DST}")
        return _check("skill 挂载", FAIL, f"找不到 skill 源：{SKILL_SRC}",
                      "确认 jumpx-ppt-slides-skill 与本仓库同级（Github/ 下），或设 SKILL_SRC")
    except Exception as e:  # noqa: BLE001
        return _check("skill 挂载", FAIL, f"异常：{e}", "")


def check_chromium() -> dict:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            path = p.chromium.executable_path
        if path and Path(path).exists():
            return _check("chromium 渲染引擎", OK, "已安装（导出 PDF/PNG/PPTX 可用）")
        return _check("chromium 渲染引擎", FAIL, "未安装", "运行：playwright install chromium")
    except Exception as e:  # noqa: BLE001
        return _check("chromium 渲染引擎", FAIL, f"不可用：{e}", "运行：playwright install chromium")


def check_deps() -> dict:
    missing = []
    for mod, pip in (("playwright", "playwright"), ("pptx", "python-pptx"),
                     ("starlette", "starlette"), ("deepagents", "deepagents")):
        try:
            __import__(mod)
        except ImportError:
            missing.append(pip)
    if missing:
        return _check("python 依赖", FAIL, f"缺 {', '.join(missing)}",
                      "运行：pip install -r backend/requirements.txt")
    return _check("python 依赖", OK, "playwright / python-pptx / starlette / deepagents 就位")


def check_recipe() -> dict:
    try:
        import recipes as R
        R.ensure_recipes()
        active = R.get_active()
        rep = R.validate_recipe(active)
        if rep.get("ok", True):
            return _check("活动配方", OK, f"{active} 契约校验通过")
        return _check("活动配方", WARN, f"{active} 校验未过：{rep}",
                      "在配方页修复，或切换到默认配方")
    except Exception as e:  # noqa: BLE001
        return _check("活动配方", WARN, f"无法校验：{e}", "")


def run_checks() -> list[dict]:
    return [check_env(), check_deps(), check_chromium(), check_skill(), check_recipe()]


def main() -> int:
    icon = {OK: "✅", WARN: "⚠️ ", FAIL: "❌"}
    print("\nJumpx Slides · 首启动自检\n" + "─" * 44)
    results = run_checks()
    for r in results:
        print(f"{icon[r['status']]} {r['name']}：{r['msg']}")
        if r["status"] != OK and r["fix"]:
            print(f"     ↳ 修复：{r['fix']}")
    crit = [r for r in results if r["status"] == FAIL]
    print("─" * 44)
    if crit:
        print(f"有 {len(crit)} 项必需检查未通过，请按上面提示修复后重试。\n")
        return 1
    print("自检通过，可以启动。\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
