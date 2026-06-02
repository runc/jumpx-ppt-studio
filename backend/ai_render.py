"""AI 渲染器：让强模型直接写整套 HTML slides —— 唯一渲染路径（模板渲染已移除）。

保留 deck 外壳契约（#deck / .slide / translateX 翻页），以便「演示模式」与
「导出 PDF/PNG/PPTX」继续可用。

多页鲁棒（解决"slide 数 8≠12"那类卡死）：
- 主路径仍是一次性整套写（保设计连贯）。
- 页数对不齐时不再硬失败：精确算出缺哪几页 → 让模型复用已有 CSS **只续写缺失页**，
  循环补齐（截断也能逐步补全）。
- 所有 section 按页号升序重排、去重、剔除多余，保证正好 N 页且翻页顺序正确。
- 极端兜底：仍缺页时用 style_lock 配色生成极简但可用的 section 填上，生产环境永不卡死
  （非旧模板渲染器，仅最后安全网，会在 note 标注）。
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

SYSTEM = """你是世界顶级的 HTML 演示设计师（Stripe / Linear / Apple Keynote 水准）。
你把"逐页内容 + 设计 token"做成一套专业级的单文件 HTML 幻灯片——不是填模板，是真正做版面设计。"""

# 必须遵守的 deck 外壳契约（让演示/导出能驱动）
CONTRACT = """# 硬契约（必须严格遵守，否则演示和导出会坏）
1. 结构：`<main id="deck" class="deck">` 内，**每页一个** `<section class="slide" data-page-id="P01">`（P01、P02…按序）。slide 数必须 = 内容页数。
2. 布局：`.deck{{position:fixed;inset:0;display:flex;flex-wrap:nowrap;width:{deckvw}vw;height:100vh;transition:transform .4s ease}}`；`.slide{{flex:0 0 100vw;width:100vw;height:100vh;overflow:hidden;position:relative}}`。
3. 翻页：内置 JS，`←/→/空格` 与底部上一页/下一页按钮通过 `deck.style.transform='translateX(-i*100vw)'` 切换；控件放在 `<nav class="slide-controls">`，页码用 `.slide-index` 之外的元素即可（这两个 class 导出时会被隐藏）。
4. 自包含：内联所有 CSS/JS，**不引任何外部资源**（无 CDN、无外链字体）。中文字体兜底 `"Noto Sans SC","PingFang SC",sans-serif`。
5. 不溢出：每页内容必须一屏放下（1280×720 基准），宁可精炼。"""

USER_TMPL = """把下面这套 deck 做成一个**单文件 index.html**，达到专业设计水准。

{contract}

# 设计要求（重点——发挥设计能力，不要千篇一律）
- 每页**按其内容与角色自己决定最合适的版面**：封面有气场、对比页用左右/卡片、列点用网格或时间线、金句大留白、收尾有行动感。
- 强排版层级、充足留白、克制强调色、卡片/分隔线/几何点缀、kicker 小标、页码。
- 用下面的设计 token 当基调（配色/字体/字号），但**版式由你创造**；可用 CSS grid/flex、渐变、阴影、圆角、内联 SVG 图标、CSS 简单示意图。
- 参考每页的 `visual_direction` 提示去构图。遵守 `forbidden` 约束。

# 设计 token（style_lock）
```json
{tokens}
```

# 逐页内容（slide_plan）
```json
{pages}
```

# 输出
直接输出完整 `<!doctype html>...</html>`，不要解释、不要 markdown 包裹。"""


# 续写补齐：只补缺失的页，复用已有 CSS，保证视觉一致
CONT_TMPL = """你之前为这套 deck 写的 HTML 缺了几页（很可能被截断或漏写）。现在**只补这些缺失的页**，
必须**复用下面已有的 CSS 类与设计语言**，让补出来的页和前面的页视觉完全一致。

# 已有样式（请复用其中的 class，不要另造新风格）
```html
{style_block}
```

# 需要补的页（slide_plan 节选）
```json
{missing}
```

# 设计 token（基调）
```json
{tokens}
```

# 输出要求（严格）
- **只输出**这些缺失页的 `<section class="slide" data-page-id="Pxx">…</section>` 块，按 data-page-id 升序，每页一个 `<section>`。
- data-page-id 必须正好是：{ids}
- **不要**输出 `<!doctype>` / `<html>` / `<head>` / `<style>` / `<script>` / `<main>`，不要解释、不要 markdown 包裹——直接给若干 `<section>`。
- 每页一屏放下（1280×720 基准）。"""

MAX_TOKENS = int(os.environ.get("ARK_MAX_TOKENS", "24000"))
MAX_REPAIR_ROUNDS = int(os.environ.get("ARK_RENDER_ROUNDS", "4"))


def _slim_pages(plan: dict) -> list[dict]:
    out = []
    for p in plan.get("pages", []):
        out.append({
            "page_title": p.get("page_title"),
            "role": p.get("page_role_in_story"),
            "key_message": p.get("key_message"),
            "on_slide_text": p.get("on_slide_text"),
            "visual_direction": p.get("visual_direction"),
            "layout_hint": p.get("layout_type"),
        })
    return out


def _extract_html(text: str) -> str:
    if "```" in text:
        m = re.search(r"```(?:html)?\s*(.*?)```", text, re.S)
        if m:
            text = m.group(1)
    text = text.strip()
    i = text.lower().find("<!doctype")
    if i > 0:
        text = text[i:]
    return text


_SECTION_RE = re.compile(r'<section\b[^>]*\bclass="[^"]*\bslide\b[^"]*"[^>]*>.*?</section>', re.S | re.I)
_PAGEID_RE = re.compile(r'data-page-id\s*=\s*["\']?\s*P?(\d{1,3})', re.I)


def _slide_count(html: str) -> int:
    return len(_SECTION_RE.findall(html))


def _section_blocks(html: str) -> list[tuple[int, str]]:
    """提取所有 slide section，返回 [(page_no, block)]；无 page-id 的按出现序补号。"""
    out, seq = [], 0
    for m in _SECTION_RE.finditer(html):
        block = m.group(0)
        seq += 1
        pm = _PAGEID_RE.search(block)
        pno = int(pm.group(1)) if pm else seq
        out.append((pno, block))
    return out


def _present_ids(html: str) -> set[int]:
    return {pno for pno, _ in _section_blocks(html)}


def _extract_style_block(html: str) -> str:
    """取 <style>…</style>（可能多个，拼起来）+ 第一段含 .deck/.slide 的关键 CSS，给续写复用。"""
    styles = re.findall(r"<style[^>]*>.*?</style>", html, re.S | re.I)
    blob = "\n".join(styles)
    return blob[:8000] if blob else "(未找到 <style>，请按 .slide 契约自行内联样式)"


def _emergency_section(page_no: int, page: dict, lock: dict) -> str:
    """最后安全网：用 style_lock 配色生成极简但可用的一页（非模板渲染器）。"""
    colors = (lock or {}).get("colors") or {}
    bg = colors.get("background") or colors.get("bg") or "#ffffff"
    fg = colors.get("text") or colors.get("ink") or "#1a1a2e"
    accent = colors.get("primary") or colors.get("accent") or "#3b5bdb"
    title = (page.get("page_title") or f"第 {page_no} 页").strip()
    role = (page.get("role") or "").strip()
    key = (page.get("key_message") or "").strip()
    ost = page.get("on_slide_text") or {}
    body = ost.get("body") if isinstance(ost, dict) else None
    bullets = body if isinstance(body, list) else ([] if body is None else [str(body)])
    lis = "".join(f'<li style="margin:.5em 0">{str(b)}</li>' for b in bullets[:5])
    import html as _h
    e = _h.escape
    return (
        f'<section class="slide" data-page-id="P{page_no:02d}" '
        f'style="flex:0 0 100vw;width:100vw;height:100vh;overflow:hidden;position:relative;'
        f'box-sizing:border-box;padding:8vh 9vw;display:flex;flex-direction:column;justify-content:center;'
        f'background:{e(bg)};color:{e(fg)};font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif">'
        f'{f"<div style=\"font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:{e(accent)};margin-bottom:1.2em\">{e(role)}</div>" if role else ""}'
        f'<h2 style="font-size:46px;line-height:1.2;margin:0 0 .4em;font-weight:800">{e(title)}</h2>'
        f'{f"<p style=\"font-size:24px;opacity:.85;margin:0 0 .8em\">{e(key)}</p>" if key else ""}'
        f'{f"<ul style=\"font-size:21px;line-height:1.7;opacity:.9;padding-left:1.2em\">{lis}</ul>" if lis else ""}'
        f'</section>'
    )


def _rebuild(html: str, ordered_blocks: list[str]) -> str:
    """把 deck 内的所有 section 替换为 ordered_blocks（已按页号排好序）。"""
    ms = list(_SECTION_RE.finditer(html))
    if not ms:
        return html
    start, end = ms[0].start(), ms[-1].end()
    return html[:start] + "\n".join(ordered_blocks) + html[end:]


def _client():
    from openai import OpenAI
    return OpenAI(base_url=os.environ["ARK_BASE_URL"], api_key=os.environ["ARK_API_KEY"])


def render_deck_html(project_dir: Path) -> tuple[str | None, str]:
    """返回 (html, note)。html 为 None 表示失败（调用方报错，不回退）。"""
    src = project_dir / "source"
    try:
        plan = json.loads((src / "slide_plan.json").read_text(encoding="utf-8"))
        lock = json.loads((src / "style_lock.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return None, f"读取 slide_plan/style_lock 失败：{e}"

    pages = _slim_pages(plan)
    n = len(pages)
    if n == 0:
        return None, "slide_plan 无页面"

    contract = CONTRACT.format(deckvw=n * 100)
    tokens_json = json.dumps(lock, ensure_ascii=False, indent=2)
    user = USER_TMPL.format(
        contract=contract,
        tokens=tokens_json,
        pages=json.dumps(pages, ensure_ascii=False, indent=2),
    )
    model = os.environ.get("ARK_MODEL", "ark-code-latest")
    client = _client()

    def call(messages, *, raw: bool = False):
        r = client.chat.completions.create(
            model=model, max_tokens=MAX_TOKENS, temperature=0.6, messages=messages,
        )
        txt = r.choices[0].message.content or ""
        return txt if raw else _extract_html(txt)

    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    try:
        html = call(msgs)
    except Exception as e:  # noqa: BLE001
        return None, f"AI 渲染调用失败：{e}"

    # 没有 deck 外壳 → 整套重写 1 次（外壳缺失无法续写补齐）
    if 'id="deck"' not in html:
        fix = (f"上面的输出缺少 `<main id=\"deck\">` 外壳。请重新输出**完整** HTML，"
               f"严格按硬契约：`<main id=\"deck\">` 内恰好 {n} 个 `<section class=\"slide\" data-page-id=\"Pxx\">`。")
        try:
            html2 = call(msgs + [{"role": "assistant", "content": html[:1500]},
                                 {"role": "user", "content": fix}])
            if 'id="deck"' in html2:
                html = html2
        except Exception:  # noqa: BLE001
            pass
    if 'id="deck"' not in html:
        return None, "渲染失败：模型始终未产出 #deck 外壳"

    # 续写补齐缺失页：循环最多 MAX_REPAIR_ROUNDS 轮
    style_block = _extract_style_block(html)
    rounds = 0
    while rounds < MAX_REPAIR_ROUNDS:
        present = _present_ids(html)
        missing = [i for i in range(1, n + 1) if i not in present]
        if not missing:
            break
        rounds += 1
        miss_pages = [{"page_id": f"P{i:02d}", **pages[i - 1]} for i in missing]
        ids = ", ".join(f"P{i:02d}" for i in missing)
        cont = CONT_TMPL.format(
            style_block=style_block,
            missing=json.dumps(miss_pages, ensure_ascii=False, indent=2),
            tokens=tokens_json,
            ids=ids,
        )
        try:
            new = call([{"role": "system", "content": SYSTEM},
                        {"role": "user", "content": cont}], raw=True)
        except Exception:  # noqa: BLE001
            break
        new_blocks = _SECTION_RE.findall(new)
        if not new_blocks:
            break
        # 合并：把新块按页号排进现有块
        by_id: dict[int, str] = {pno: blk for pno, blk in _section_blocks(html)}
        for blk in new_blocks:
            pm = _PAGEID_RE.search(blk)
            if pm:
                by_id[int(pm.group(1))] = blk
        ordered = [by_id[i] for i in sorted(by_id) if 1 <= i <= n]
        html = _rebuild(html, ordered)

    # 最终整理：按页号重排 + 去多余；仍缺页用应急 section 兜底
    by_id = {pno: blk for pno, blk in _section_blocks(html)}
    filled = 0
    for i in range(1, n + 1):
        if i not in by_id:
            by_id[i] = _emergency_section(i, pages[i - 1], lock)
            filled += 1
    ordered = [by_id[i] for i in range(1, n + 1)]
    html = _rebuild(html, ordered)

    cnt = _slide_count(html)
    if cnt != n:
        return None, f"渲染失败：整理后 slide 数仍为 {cnt}（应 {n}）"
    if filled:
        return html, f"AI 渲染成功（{n} 页，{len(html)} 字节；其中 {filled} 页为应急兜底，建议重试以获更佳版面）"
    return html, f"AI 渲染成功（{n} 页，{len(html)} 字节）"
