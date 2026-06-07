"""Tier-1 render-check：用真实无头浏览器测量 deck 的「像素级」视觉问题。

这是 ai-slide-producer skill 的 Tier-0 `validate_html.py`（结构/外链/页序/颜色/文本预算）
**测不到**的那一半——只有真渲染才知道：
  - 溢出：某元素的盒子超出它所在 .slide 的可视边界（标题换行成 3 行、卡片撑爆…）
  - 断字：固定盒子里 `overflow:hidden` 把文字裁掉
  - 对比度：文字与其有效背景的 WCAG 对比度不足

设计原则（呼应 skill 的"别做硬依赖"）：
  - 这是**壳侧 Tier-1**，靠壳里已装的 Playwright；**skill 本体零依赖**。
  - **探测式**：浏览器不可用 → 返回 {available:false}，调用方据此降级 + 在 qa_report 标
    "像素 QA 未运行"，**绝不 silent fail，也不阻塞交付**。

用法：
  .venv/bin/python render_check.py <index.html 路径> [--json] [--ratio 16:9|4:3|...] [--pdf] [--png]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

RATIO_PX = {
    "16:9": (1280, 720),
    "4:3": (1440, 1080),
    "1:1": (1080, 1080),
    "3:4": (1080, 1440),
    "9:16": (1080, 1920),
}

# in-page measurement: per slide, find off-slide overflow / clipped text / low contrast.
_MEASURE_JS = r"""
(slideEl) => {
  const TOL = 2;
  const sr = slideEl.getBoundingClientRect();
  const W = sr.width, H = sr.height;
  const out = { overflow: [], clipped: [], contrast: [] };

  function cssPath(el) {
    const parts = [];
    let e = el, hops = 0;
    while (e && e.nodeType === 1 && hops < 4) {
      let s = e.tagName.toLowerCase();
      if (e.id) { s += '#' + e.id; parts.unshift(s); break; }
      const cls = (e.className && e.className.toString().trim().split(/\s+/)[0]) || '';
      if (cls) s += '.' + cls;
      parts.unshift(s); e = e.parentElement; hops++;
    }
    return parts.join('>');
  }
  function parseColor(str) {
    const m = str && str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    return m[1].split(',').map(x => parseFloat(x));
  }
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function effBg(el) {
    let e = el;
    while (e && e.nodeType === 1) {
      const p = parseColor(getComputedStyle(e).backgroundColor);
      if (p && (p.length < 4 || p[3] >= 0.5)) return p.slice(0, 3);
      e = e.parentElement;
    }
    return [255, 255, 255];
  }

  const all = slideEl.querySelectorAll('*');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const isTextLeaf = el.childElementCount === 0 && el.textContent.trim().length > 0;

    // (1) off-slide overflow (box extends beyond the slide's own viewport)
    const left = r.left - sr.left, top = r.top - sr.top;
    const overR = (left + r.width) - W, overB = (top + r.height) - H;
    const over = Math.max(overR, overB, -left, -top);
    if (over > TOL && (isTextLeaf || el.matches('section *') && r.width < W * 1.5)) {
      out.overflow.push({ sel: cssPath(el), text: el.textContent.trim().slice(0, 44), px: Math.round(over),
        dir: (overB > overR && overB > -top ? 'bottom' : overR > -left ? 'right' : (top < 0 ? 'top' : 'left')) });
    }
    // (2) clipped text (overflow hidden box smaller than its content)
    if (isTextLeaf && (cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflowX === 'hidden')) {
      const cx = el.scrollWidth - el.clientWidth, cy = el.scrollHeight - el.clientHeight;
      if (cx > TOL || cy > TOL)
        out.clipped.push({ sel: cssPath(el), text: el.textContent.trim().slice(0, 44), px: Math.round(Math.max(cx, cy)) });
    }
    // (3) WCAG contrast on text leaves
    if (isTextLeaf && parseFloat(cs.fontSize) >= 9) {
      const fg = parseColor(cs.color);
      if (fg) {
        const bg = effBg(el);
        const L1 = lum(fg), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const size = parseFloat(cs.fontSize), bold = (parseInt(cs.fontWeight) || 400) >= 700;
        const need = (size >= 24 || (size >= 18.66 && bold)) ? 3.0 : 4.5;
        if (ratio < need)
          out.contrast.push({ sel: cssPath(el), text: el.textContent.trim().slice(0, 44),
            ratio: Math.round(ratio * 100) / 100, need, size: Math.round(size) });
      }
    }
  }
  // cap to keep agent context lean
  for (const k of ['overflow', 'clipped', 'contrast']) out[k] = out[k].slice(0, 12);
  return out;
}
"""


async def _run(html: Path, w: int, h: int) -> dict:
    from playwright.async_api import async_playwright

    findings = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": w, "height": h})
        await page.goto(html.resolve().as_uri(), wait_until="networkidle")
        await page.add_style_tag(content=".deck{transition:none !important}"
                                 ".slide-controls,.slide-index,[data-action]{display:none !important}")
        n = await page.eval_on_selector_all(".slide", "els => els.length")
        slides = await page.query_selector_all(".slide")
        for i in range(max(1, n)):
            await page.evaluate(
                "(i)=>{const d=document.getElementById('deck');if(d)d.style.transform='translateX('+(-i*100)+'vw)';}", i)
            await page.wait_for_timeout(120)
            res = await page.evaluate(_MEASURE_JS, slides[i]) if i < len(slides) else {"overflow": [], "clipped": [], "contrast": []}
            pid = await slides[i].get_attribute("data-page-id") if i < len(slides) else None
            findings.append({"page": pid or f"slide-{i+1}", **res})
        await browser.close()
    return {"findings": findings}


def render_check(html: Path, ratio: str = "16:9") -> dict:
    """Return {available, summary, findings} or {available:False, reason}."""
    w, h = RATIO_PX.get(ratio, RATIO_PX["16:9"])
    try:
        data = asyncio.run(_run(html, w, h))
    except Exception as e:  # noqa: BLE001 — browser missing / launch failure → graceful
        return {"available": False, "reason": f"{type(e).__name__}: {e}",
                "note": "Tier-1 像素 QA 未运行（无浏览器/渲染失败）；请退回 Tier-0 测量 + 人工门禁，勿 silent fail。"}
    f = data["findings"]
    n_over = sum(len(s["overflow"]) for s in f)
    n_clip = sum(len(s["clipped"]) for s in f)
    n_contrast = sum(len(s["contrast"]) for s in f)
    # Hard (blocks / triggers regen) = layout breaks. Contrast = advisory (surface, don't loop).
    return {
        "available": True,
        "ratio": ratio,
        "summary": {"slides": len(f), "overflow": n_over, "clipped": n_clip, "contrast": n_contrast,
                    "failed": (n_over + n_clip) > 0},
        "findings": [s for s in f if s["overflow"] or s["clipped"] or s["contrast"]],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("html", type=Path, help="path to index.html")
    ap.add_argument("--ratio", default="16:9", choices=list(RATIO_PX))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--pdf", action="store_true", help="also export PDF (reuses export_deck)")
    ap.add_argument("--png", action="store_true", help="also export per-page PNG zip")
    a = ap.parse_args()

    if not a.html.exists():
        print(f"error: not found: {a.html}", file=sys.stderr)
        return 2

    res = render_check(a.html.resolve(), a.ratio)

    if a.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    elif not res["available"]:
        print(f"⚠ render-check unavailable: {res['reason']}\n  {res['note']}", file=sys.stderr)
    else:
        s = res["summary"]
        print(f"render-check ({res['ratio']}): {s['slides']} slides | "
              f"overflow={s['overflow']} clipped={s['clipped']} contrast<AA={s['contrast']}")
        for sl in res["findings"]:
            for o in sl["overflow"]:
                print(f"  [{sl['page']}] OVERFLOW {o['px']}px {o['dir']}  {o['sel']}  “{o['text']}”")
            for c in sl["clipped"]:
                print(f"  [{sl['page']}] CLIPPED  {c['px']}px  {c['sel']}  “{c['text']}”")
            for ct in sl["contrast"]:
                print(f"  [{sl['page']}] CONTRAST {ct['ratio']}:1 (need {ct['need']}, {ct['size']}px)  “{ct['text']}”")

    if not res.get("available"):
        return 0  # unavailable is NOT a failure (graceful) — caller decides
    return 1 if res["summary"]["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
