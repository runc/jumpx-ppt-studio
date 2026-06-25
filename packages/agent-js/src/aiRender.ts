import { resolveProvider, type LlmConfig } from './providers.js'

const SYSTEM = `你是世界顶级的 HTML 演示设计师（Stripe / Linear / Apple Keynote 水准）。
你把"逐页内容 + 设计 token"做成一套专业级的单文件 HTML 幻灯片——不是填模板，是真正做版面设计。`

const CONTRACT = `# 硬契约（必须严格遵守，否则演示和导出会坏）
1. 结构：\`<main id="deck" class="deck">\` 内，**每页一个** \`<section class="slide" data-page-id="P01">\`（P01、P02…按序）。slide 数必须 = 内容页数。
2. 布局：\`.deck{position:fixed;inset:0;display:flex;flex-wrap:nowrap;width:{deckvw}vw;height:100vh;transition:transform .4s ease}\`；\`.slide{flex:0 0 100vw;width:100vw;height:100vh;overflow:hidden;position:relative}\`。
3. 翻页：内置 JS，\`←/→/空格\` 与底部上一页/下一页按钮通过 \`deck.style.transform='translateX(-i*100vw)'\` 切换；控件放在 \`<nav class="slide-controls">\`，页码用 \`.slide-index\` 之外的元素即可（这两个 class 导出时会被隐藏）。
4. 自包含：内联所有 CSS/JS，**不引任何外部资源**（无 CDN、无外链字体）。中文字体兜底 \`"Noto Sans SC","PingFang SC",sans-serif\`。
5. 不溢出：每页内容必须一屏放下（1280×720 基准），宁可精炼。`

const USER_TMPL = `把下面这套 deck 做成一个**单文件 index.html**，达到专业设计水准。

{contract}

# 设计要求（重点——发挥设计能力，不要千篇一律）
- 每页**按其内容与角色自己决定最合适的版面**：封面有气场、对比页用左右/卡片、列点用网格或时间线、金句大留白、收尾有行动感。
- 强排版层级、充足留白、克制强调色、卡片/分隔线/几何点缀、kicker 小标、页码。
- 用下面的设计 token 当基调（配色/字体/字号），但**版式由你创造**；可用 CSS grid/flex、渐变、阴影、圆角、内联 SVG 图标、CSS 简单示意图。
- 参考每页的 \`visual_direction\` 提示去构图。遵守 \`forbidden\` 约束。

# 设计 token（style_lock）
\`\`\`json
{tokens}
\`\`\`

# 逐页内容（slide_plan）
\`\`\`json
{pages}
\`\`\`

# 输出
直接输出完整 \`<!doctype html>...</html>\`，不要解释、不要 markdown 包裹。`

const SECTION_RE =
  /<section\b[^>]*\bclass="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?<\/section>/gi
const PAGEID_RE = /data-page-id\s*=\s*["']?\s*P?(\d{1,3})/i

function slimPages(plan: { pages?: unknown[] }) {
  return (plan.pages || []).map((p: Record<string, unknown>) => ({
    page_title: p.page_title,
    role: p.page_role_in_story,
    key_message: p.key_message,
    on_slide_text: p.on_slide_text,
    visual_direction: p.visual_direction,
    layout_hint: p.layout_type,
  }))
}

function extractHtml(text: string): string {
  if (text.includes('```')) {
    const m = text.match(/```(?:html)?\s*([\s\S]*?)```/)
    if (m) text = m[1]
  }
  text = text.trim()
  const i = text.toLowerCase().indexOf('<!doctype')
  if (i > 0) text = text.slice(i)
  return text
}

function slideCount(html: string) {
  return (html.match(SECTION_RE) || []).length
}

function sectionBlocks(html: string): [number, string][] {
  const out: [number, string][] = []
  let seq = 0
  for (const m of html.matchAll(SECTION_RE)) {
    const block = m[0]
    seq += 1
    const pm = block.match(PAGEID_RE)
    const pno = pm ? parseInt(pm[1], 10) : seq
    out.push([pno, block])
  }
  return out
}

function presentIds(html: string) {
  return new Set(sectionBlocks(html).map(([p]) => p))
}

function rebuild(html: string, ordered: string[]) {
  const re = new RegExp(SECTION_RE.source, 'gi')
  const ms = [...html.matchAll(re)]
  if (!ms.length) return html
  const start = ms[0].index!
  const end = ms[ms.length - 1].index! + ms[ms.length - 1][0].length
  return html.slice(0, start) + ordered.join('\n') + html.slice(end)
}

function emergencySection(pageNo: number, page: Record<string, unknown>, lock: Record<string, unknown>) {
  const colors = (lock?.colors as Record<string, string>) || {}
  const bg = colors.background || colors.bg || '#ffffff'
  const fg = colors.text || colors.ink || '#1a1a2e'
  const accent = colors.primary || colors.accent || '#3b5bdb'
  const title = String(page.page_title || `第 ${pageNo} 页`).trim()
  const role = String(page.role || '').trim()
  const key = String(page.key_message || '').trim()
  const ost = page.on_slide_text as { body?: unknown } | undefined
  const body = ost?.body
  const bullets = Array.isArray(body) ? body : body == null ? [] : [String(body)]
  const lis = bullets
    .slice(0, 5)
    .map((b) => `<li style="margin:.5em 0">${String(b)}</li>`)
    .join('')
  const e = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return (
    `<section class="slide" data-page-id="P${String(pageNo).padStart(2, '0')}" ` +
    `style="flex:0 0 100vw;width:100vw;height:100vh;overflow:hidden;position:relative;` +
    `box-sizing:border-box;padding:8vh 9vw;display:flex;flex-direction:column;justify-content:center;` +
    `background:${e(bg)};color:${e(fg)};font-family:'Noto Sans SC','PingFang SC',sans-serif">` +
    (role
      ? `<div style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:${e(accent)};margin-bottom:1.2em">${e(role)}</div>`
      : '') +
    `<h2 style="font-size:46px;line-height:1.2;margin:0 0 .4em;font-weight:800">${e(title)}</h2>` +
    (key ? `<p style="font-size:24px;opacity:.85;margin:0 0 .8em">${e(key)}</p>` : '') +
    (lis ? `<ul style="font-size:21px;line-height:1.7;opacity:.9;padding-left:1.2em">${lis}</ul>` : '') +
    '</section>'
  )
}

async function chat(
  cfg: LlmConfig,
  messages: { role: string; content: string }[],
): Promise<string> {
  const base = (cfg.baseURL || '').replace(/\/$/, '')
  const provider = resolveProvider(cfg)
  if (provider === 'anthropic') {
    return chatAnthropic(cfg, base, messages)
  }
  return chatOpenAI(cfg, base, messages)
}

async function chatOpenAI(
  cfg: LlmConfig,
  base: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const url = `${base}/chat/completions`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 24000,
      temperature: 0.6,
      messages,
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`LLM ${r.status}: ${t.slice(0, 300)}`)
  }
  const j = await r.json()
  return j.choices?.[0]?.message?.content || ''
}

async function chatAnthropic(
  cfg: LlmConfig,
  base: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const trimmed = base.replace(/\/v1$/, '')
  const url = `${trimmed}/v1/messages`
  const systemMsg = messages.find((m) => m.role === 'system')
  const userAssistantMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 8192,
      temperature: 0.6,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: userAssistantMsgs,
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`LLM ${r.status}: ${t.slice(0, 300)}`)
  }
  const j = await r.json()
  const blocks = Array.isArray(j.content) ? j.content : []
  return blocks
    .filter((b: { type?: string; text?: string }) => b.type === 'text' && typeof b.text === 'string')
    .map((b: { text?: string }) => b.text)
    .join('')
}

function readTextFile(files: Record<string, { content?: string | string[] }>, vpath: string): string | null {
  const fd = files[vpath]
  if (!fd) return null
  const c = fd.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.join('\n')
  return null
}

export async function renderDeckHtml(
  files: Record<string, { content?: string | string[] }>,
  project: string,
  cfg: LlmConfig,
): Promise<{ html: string | null; note: string }> {
  const planPath = `/runs/${project}/source/slide_plan.json`
  const lockPath = `/runs/${project}/source/style_lock.json`
  const planRaw = readTextFile(files, planPath)
  const lockRaw = readTextFile(files, lockPath)
  if (!planRaw || !lockRaw) {
    return { html: null, note: '缺少 slide_plan.json 或 style_lock.json' }
  }
  let plan: { pages?: unknown[] }
  let lock: Record<string, unknown>
  try {
    plan = JSON.parse(planRaw)
    lock = JSON.parse(lockRaw)
  } catch (e) {
    return { html: null, note: `JSON 解析失败：${e}` }
  }
  const pages = slimPages(plan)
  const n = pages.length
  if (!n) return { html: null, note: 'slide_plan 无页面' }

  const contract = CONTRACT.replace('{deckvw}', String(n * 100))
  const tokensJson = JSON.stringify(lock, null, 2)
  const user = USER_TMPL.replace('{contract}', contract)
    .replace('{tokens}', tokensJson)
    .replace('{pages}', JSON.stringify(pages, null, 2))

  const msgs = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]

  let html: string
  try {
    html = extractHtml(await chat(cfg, msgs))
  } catch (e) {
    return { html: null, note: `AI 渲染调用失败：${e}` }
  }

  if (!html.includes('id="deck"')) {
    return { html: null, note: '渲染失败：模型未产出 #deck 外壳' }
  }

  const byId = Object.fromEntries(sectionBlocks(html))
  let filled = 0
  for (let i = 1; i <= n; i++) {
    if (!byId[i]) {
      byId[i] = emergencySection(i, pages[i - 1] as Record<string, unknown>, lock)
      filled += 1
    }
  }
  html = rebuild(
    html,
    Array.from({ length: n }, (_, i) => byId[i + 1]),
  )

  const cnt = slideCount(html)
  if (cnt !== n) return { html: null, note: `渲染失败：slide 数 ${cnt}（应 ${n}）` }
  if (filled) {
    return {
      html,
      note: `AI 渲染成功（${n} 页；${filled} 页应急兜底）`,
    }
  }
  return { html, note: `AI 渲染成功（${n} 页，${html.length} 字节）` }
}
