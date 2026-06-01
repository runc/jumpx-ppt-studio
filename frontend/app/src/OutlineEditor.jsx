// 大纲编辑器：对齐原型（左树 + 右故事板）
// 解析 confirm_outline 的 outline_md → 结构化数据 → 双栏展示。
import React from 'react'
import { respondInterrupt } from './agent.js'

// ——— 解析 outline_md ———
// 兼容三种格式：
//   格式A: ### P01 · 标题 + **角色**: + **一句话**:  (有 ## 页面规划 段)
//   格式B: 1. **Cover** — 标题  (em dash，无段头)
//   格式C: 1. **标题**\n   - 要点  (有 ## 叙事策略 段或 **叙事弧**:)
function parseOutline(md) {
  if (!md) return { strategy: '', pages: [] }
  const lines = md.split('\n')
  let strategy = ''
  const pages = []
  let inStrategy = false
  let inPages = false   // 格式A 专用：遇到 ## 页面规划 才进入
  let cur = null

  // 是否有段头控制（格式A）
  const hasPageSection = /^##\s*(页面规划|pages|outline)/im.test(md)
  if (!hasPageSection) inPages = true  // 格式B/C：直接处理所有行

  for (const raw of lines) {
    const l = raw.trim()
    if (!l) continue

    // 叙事策略/叙事弧 —— 内联或段头两种
    if (/^##\s*(叙事策略|narrative|strategy)/i.test(l)) { inStrategy = true; inPages = false; continue }
    if (/^\*{1,2}叙事[弧策略线]+\*{0,2}[:：](.+)/.test(l)) {
      const m = l.match(/\*{0,2}叙事[弧策略线]+\*{0,2}[:：](.+)/)
      if (m) strategy = m[1].replace(/\*+/g, '').trim()
      continue
    }
    if (/^##\s*(页面规划|pages|outline)/i.test(l)) { inStrategy = false; inPages = true; continue }
    if (/^##\s*(总页数|预计时长|pacing)/i.test(l)) { inStrategy = false; inPages = false; if (cur) { pages.push(cur); cur = null } continue }

    if (inStrategy) { if (l) strategy += (strategy ? '\n' : '') + l; continue }

    if (!inPages) continue

    // 格式A: ### P01 · 标题
    const mA = l.match(/^###\s*P?(\d+)\s*[·.]\s*(.+)/)
    // 格式B: 1. **Cover** — 标题  (em dash — 或 –)
    const mB = !mA && l.match(/^(\d+)\.\s+\*{1,2}([^*]+)\*{1,2}\s*[—–-]+\s*(.+)/)
    // 格式C: 1. **标题** 或 1. 标题
    const mC = !mA && !mB && l.match(/^(\d+)\.\s+\*{0,2}(.+?)\*{0,2}$/)

    if (mA || mB || mC) {
      if (cur) pages.push(cur)
      let n, title, role = ''
      if (mA) { n = parseInt(mA[1], 10); title = mA[2].trim() }
      else if (mB) {
        n = parseInt(mB[1], 10)
        // "Cover" / "Hook" / "Core ①" 等是角色标签，后面是真实标题
        const roleRaw = mB[2].trim()
        title = mB[3].trim()
        role = roleRaw  // e.g. "Cover", "Core ①"
      }
      else { n = parseInt(mC[1], 10); title = mC[2].replace(/\*+/g, '').trim() }
      cur = { n, title, role, oneliner: '', bullets: [] }
      continue
    }
    if (!cur) continue

    // 角色
    const roleM = l.match(/^\s*[-*]?\s*\*{0,2}角色\*{0,2}[:：]\s*(.+)/)
    if (roleM) { cur.role = roleM[1].replace(/\*+/g, '').trim(); continue }
    // 一句话
    const oneM = l.match(/^\s*[-*]?\s*\*{0,2}(?:一句话|key message|oneliner)\*{0,2}[:：]\s*(.+)/i)
    if (oneM) { cur.oneliner = oneM[1].replace(/\*+/g, '').trim(); continue }
    // bullet
    const bM = l.match(/^\s*[-•]\s+(.+)/)
    if (bM) { cur.bullets.push(bM[1].replace(/\*+/g, '').trim()); continue }
    // 缩进行 (格式C 里的要点无 - 前缀)
    if (/^\s{2,}/.test(raw) && l) cur.bullets.push(l.replace(/\*+/g, '').trim())
  }
  if (cur) pages.push(cur)
  return { strategy, pages }
}

// 把 role 映射成中文标签
const ROLE_LABEL = {
  hook: '钩子', cover: '封面', context: '背景', core: '核心',
  shift: '转折', takeaway: '收束', closing: '收束', evidence: '论据',
}
function roleTag(r) { const k = (r || '').toLowerCase().split('/')[0].trim(); return ROLE_LABEL[k] || r || '' }

// ——— 大纲编辑器组件 ———
export function OutlineEditor({ stream, args }) {
  const outline = args.outline_md || args.outline || ''
  const note = args.note || ''
  const { strategy, pages } = React.useMemo(() => parseOutline(outline), [outline])
  const [sel, setSel] = React.useState(pages[0]?.n ?? 1)

  if (!pages.length) return (
    <div className="oe-empty">
      <p>大纲生成中…</p>
    </div>
  )

  const selPage = pages.find(p => p.n === sel) || pages[0]

  return (
    <div className="oe">
      {/* 左：大纲树 */}
      <div className="oe-tree">
        <div className="oe-agent">
          <div className="oe-ai"><i /></div>
          <div className="oe-msg">
            共 <b>{pages.length} 页</b>。{strategy ? <span className="oe-strategy">{strategy.slice(0, 80)}{strategy.length > 80 ? '…' : ''}</span> : '顺序和重点先这样——有要调的直接告诉我。'}
          </div>
        </div>
        <div className="oe-list">
          {pages.map(p => (
            <div key={p.n} className={'oe-row' + (sel === p.n ? ' sel' : '')} onClick={() => setSel(p.n)}>
              <span className="oe-pn">{String(p.n).padStart(2, '0')}</span>
              <span className="oe-pt">{p.title}</span>
              {p.role && <span className="oe-role">{roleTag(p.role)}</span>}
            </div>
          ))}
        </div>
        <div className="oe-foot">
          <span className="oe-meta">{pages.length} 页{note ? ` · ${note}` : ''}</span>
        </div>
      </div>

      {/* 右：故事板网格 */}
      <div className="oe-board">
        <div className="oe-grid">
          {pages.map(p => {
            const isFirst = p.n === 1
            const isSel = p.n === sel
            return (
              <div key={p.n} className={'oe-card' + (isFirst ? ' cover' : '') + (isSel ? ' sel' : '')} onClick={() => setSel(p.n)}>
                <div className="oe-bn">{isFirst ? '封面' : String(p.n).padStart(2, '0')}</div>
                <div className="oe-bt">{p.title}</div>
                {p.oneliner && <div className="oe-one">{p.oneliner}</div>}
                <div className="oe-bls">
                  {p.bullets.slice(0, 3).map((b, i) => <i key={i}>{b}</i>)}
                </div>
              </div>
            )
          })}
        </div>

        {/* 选中页详情 */}
        {selPage && (
          <div className="oe-detail">
            <div className="oe-dh"><b>{String(selPage.n).padStart(2, '0')} · {selPage.title}</b>{selPage.role && <span className="oe-role">{roleTag(selPage.role)}</span>}</div>
            {selPage.oneliner && <div className="oe-done">{selPage.oneliner}</div>}
            {selPage.bullets.length > 0 && <ul className="oe-dbl">{selPage.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="oe-acts">
          <button className="btn" onClick={() => respondInterrupt(stream, '请把要点更精简一些，重拟大纲')}>重拟（更精简）</button>
          <button className="btn primary" onClick={() => respondInterrupt(stream, 'OK，确认大纲，继续')}>✓ 确认大纲，继续</button>
        </div>
      </div>
    </div>
  )
}
