import React from 'react'
import { REAL_PRESETS } from '@jumpx/core'
import { respondInterrupt, sendChatMessage } from '@jumpx/agent-js'
import { usePorts } from '@jumpx/adapters-browser'
import {
  activityFromMessages,
  tasksFromTodos,
  findOutputPath,
  findRunSlug,
  findPageCount,
  runFinished,
  readInterrupt,
  type AgentStream,
  type SlidePlanPage,
} from '@jumpx/ports'
import { OutlineEditor } from '../outline/OutlineEditor.js'
import { useRunPlan } from '../hooks/useRunPlan.js'

const chk = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
    <path d="M5 13l4 4L19 7" />
  </svg>
)

function TemplateChooser({
  stream,
  args,
}: {
  stream: AgentStream
  args: Record<string, unknown>
}) {
  const ports = usePorts()
  const rec = Array.isArray(args.recommended) ? (args.recommended as string[]) : []
  const [presets, setPresets] = React.useState<
    { id: string; display_name: string; mood: string; thumbs: string[] }[] | null
  >(null)

  React.useEffect(() => {
    let alive = true
    void ports.presets.list().then((list) => {
      if (alive) setPresets(list)
    })
    return () => {
      alive = false
    }
  }, [ports])

  const meta: Record<string, (typeof presets extends (infer U)[] | null ? U : never)> = {}
  for (const p of presets || []) meta[p.id] = p
  const ids = [...new Set([...rec, ...REAL_PRESETS])]

  return (
    <div className="live-overlay">
      <div className="ov-card wide">
        <div className="ov-h">
          选一套模板{' '}
          <span>{String(args.note || 'AI 推荐高亮；缩略图是该风格的真实渲染样例')}</span>
        </div>
        <div className="ov-tpls grid">
          {ids.map((p) => {
            const m = meta[p]
            const thumb = m?.thumbs?.[1] || m?.thumbs?.[0] || null
            const isRec = rec.includes(p)
            return (
              <button
                key={p}
                type="button"
                className={'ov-tpl card' + (isRec ? ' rec' : '')}
                onClick={() => void respondInterrupt(stream, p)}
              >
                <div className="ov-tpl-thumb">
                  {thumb ? (
                    <img src={thumb} alt={p} loading="lazy" />
                  ) : (
                    <div className="ov-tpl-noimg">{presets ? m?.display_name || p : '加载中…'}</div>
                  )}
                  {isRec && <span className="star">★ 推荐</span>}
                </div>
                <div className="ov-tpl-meta">
                  <b>{m?.display_name || p}</b>
                  <i>{m?.mood || p}</i>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Overlay({ stream }: { stream: AgentStream }) {
  const intr = readInterrupt(stream)
  if (!intr) return null
  const { name, args } = intr

  if (name === 'confirm_outline') {
    return <OutlineEditor stream={stream} args={args} />
  }
  if (name === 'choose_template') {
    return <TemplateChooser stream={stream} args={args} />
  }
  if (name === 'choose_render_mode') {
    return (
      <div className="live-overlay">
        <div className="ov-card">
          <div className="ov-h">
            用哪种形态生成？{' '}
            <span>{String(args.note || 'HTML 秒级、可改；AI 配图较慢、不易改')}</span>
          </div>
          <div className="ov-modes">
            <button
              type="button"
              className="ov-mode rec"
              onClick={() => void respondInterrupt(stream, 'html')}
            >
              <b>🌐 HTML 网页式</b>
              <span>秒级 · 可编辑 · 体积轻 · 推荐</span>
            </button>
            <button
              type="button"
              className="ov-mode"
              onClick={() => void respondInterrupt(stream, 'image')}
            >
              <b>🖼️ AI 配图式</b>
              <span>视觉强 · 较慢 · 需在设置配置 image provider</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="live-overlay">
      <div className="ov-card">
        <div className="ov-h">需要你确认：{name}</div>
        <pre className="ov-outline">{JSON.stringify(args, null, 2)}</pre>
        <div className="ov-acts">
          <button type="button" className="btn primary" onClick={() => void respondInterrupt(stream, 'OK')}>
            继续
          </button>
        </div>
      </div>
    </div>
  )
}

function findSlidePlanFromFiles(files: Record<string, { content?: string | string[] }>) {
  const key = Object.keys(files).find((k) => k.endsWith('slide_plan.json'))
  if (!key) return null
  try {
    const fd = files[key]
    const c =
      typeof fd.content === 'string' ? fd.content : Array.isArray(fd.content) ? fd.content.join('\n') : ''
    return JSON.parse(c) as { pages?: SlidePlanPage[] }
  } catch {
    return null
  }
}

function PageDetail({
  page,
  n,
  total,
  onClose,
  onNav,
}: {
  page: SlidePlanPage
  n: number
  total: number
  onClose: () => void
  onNav: (d: number) => void
}) {
  const t = page.on_slide_text || {}
  const body = t.body || []
  return (
    <div className="pd-mask" onClick={onClose}>
      <div className="pd" onClick={(e) => e.stopPropagation()}>
        <div className="pd-head">
          <span className="pd-n">
            {String(n).padStart(2, '0')} / {total}
          </span>
          <b className="pd-title">{page.page_title || t.headline || ''}</b>
          {page.layout_type && <span className="pd-layout">{page.layout_type}</span>}
          <span className="pd-sp" />
          <button type="button" className="iconbtn" onClick={() => onNav(-1)} disabled={n <= 1}>
            ‹
          </button>
          <button type="button" className="iconbtn" onClick={() => onNav(1)} disabled={n >= total}>
            ›
          </button>
          <button type="button" className="iconbtn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="pd-body">
          {page.key_message && <div className="pd-key">{page.key_message}</div>}
          {t.headline && t.headline !== page.page_title && <div className="pd-h2">{t.headline}</div>}
          {t.sub_headline && <div className="pd-sub">{t.sub_headline}</div>}
          {body.length > 0 && (
            <ul className="pd-bullets">
              {body.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {t.caption && <div className="pd-cap">{t.caption}</div>}
          {page.speaker_notes && (
            <div className="pd-notes">
              <div className="pd-notes-h">演讲备注</div>
              {page.speaker_notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function LiveWorkbench({
  stream,
}: {
  stream: AgentStream
  onNew?: () => void
}) {
  const ports = usePorts()
  const todos = tasksFromTodos(stream.values.todos)
  const acts = activityFromMessages(stream.messages)
  const files = stream.values.files || {}
  const plan = findSlidePlanFromFiles(files)
  const indexHtml = findOutputPath(stream)
  const finished = runFinished(stream)
  const intr = readInterrupt(stream)
  const loading = stream.isLoading
  const runSlug = findRunSlug(stream)

  const runPlan = useRunPlan(stream, runSlug, finished)

  const virtualPages = plan?.pages && Array.isArray(plan.pages) ? plan.pages : []
  const fetchedPages = runPlan?.pages && Array.isArray(runPlan.pages) ? runPlan.pages : []
  const pages = virtualPages.length ? virtualPages : fetchedPages
  const pageCount = pages.length || findPageCount(stream)
  const [openPage, setOpenPage] = React.useState<number | null>(null)
  const [chatText, setChatText] = React.useState('')
  const doneCount = todos.filter((t) => t.st === 'done').length

  const chatBusy = loading
  const chatHints = finished
    ? ['把这页改成三栏', '配色再素一点', '加一页小结']
    : intr
      ? ['OK', '继续']
      : []

  async function handleChatSend(text?: string) {
    const msg = (text ?? chatText).trim()
    if (!msg || chatBusy) return
    setChatText('')
    await sendChatMessage(stream, msg)
  }

  const lastText = (() => {
    const ai = [...stream.messages]
      .reverse()
      .find(
        (m) =>
          ((m as { type?: string }).type === 'ai' ||
            (m as { role?: string }).role === 'assistant') &&
          typeof (m as { content?: unknown }).content === 'string' &&
          String((m as { content: string }).content).trim(),
      ) as { content: string } | undefined
    return ai ? ai.content.trim() : ''
  })()

  const previewHtml = stream.htmlPreview || null

  return (
    <div className="screen">
      <div className="wb">
        <div className="wb-stage" style={{ position: 'relative' }}>
          {intr ? (
            <Overlay stream={stream} />
          ) : finished ? (
            <div className="live-done">
              <div className="ld-bar">
                <span className="ld-h">
                  ✅ 已生成{pageCount ? ` · ${pageCount} 页` : ''}
                </span>
                {(previewHtml || runSlug) && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (previewHtml) {
                        const w = window.open('', '_blank')
                        if (w) {
                          w.document.write(previewHtml)
                          w.document.close()
                        }
                      }
                    }}
                  >
                    新标签打开 ↗
                  </button>
                )}
              </div>
              {previewHtml ? (
                <iframe
                  className="ld-frame"
                  srcDoc={previewHtml}
                  title="生成的幻灯片预览"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.7 }}>
                  产物：<code>{indexHtml || 'runs/…/index.html'}</code>
                </p>
              )}
            </div>
          ) : (
            <div className="ov-card">
              <div className="ov-h">
                {loading ? '副驾正在工作…' : '准备就绪'}
                {loading && <span className="ring" style={{ marginLeft: 10 }} />}
              </div>
              <p
                style={{
                  color: 'var(--ink-2)',
                  fontSize: 13,
                  lineHeight: 1.7,
                  maxWidth: 520,
                }}
              >
                {lastText ? lastText.slice(0, 280) : '正在规划与生成…'}
              </p>
            </div>
          )}
        </div>

        <div className="cop">
          <div className="cop-head">
            <div className={'ai' + (loading ? ' busy' : '')}>
              <i />
            </div>
            <span className="t">副驾</span>
            <span className="s">
              {loading ? '运行中…' : intr ? '等你确认' : '空闲'}
            </span>
          </div>
          <div className="cop-scroll">
            <div className="sec-h">
              本次任务{' '}
              <span className="cnt">
                {doneCount} / {todos.length || '—'}
              </span>
            </div>
            <div className="todo-list">
              {todos.length === 0 && (
                <div className="task todo">
                  <span className="mk" />
                  <div className="body">
                    <div className="ti">等待规划…</div>
                  </div>
                </div>
              )}
              {todos.map((t, i) => (
                <div key={i} className={'task ' + t.st}>
                  <span className="mk">
                    {t.st === 'done' ? chk : t.st === 'doing' ? <i /> : null}
                  </span>
                  <div className="body" style={{ flex: 1, minWidth: 0 }}>
                    <div className="ti">{t.ti}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flow">
              <div className="flow-h">
                <span className="t">它在干什么 · 实时</span>
              </div>
              <div className="log">
                {acts.length === 0 && (
                  <div className="ev">
                    <span className="d" />
                    <div>
                      <div className="tx" style={{ color: 'var(--ink-3)' }}>
                        —
                      </div>
                    </div>
                  </div>
                )}
                {acts.map((e, i) => (
                  <div key={i} className={'ev' + (i === 0 ? ' now' : '')}>
                    <span className="d" />
                    <div>
                      <div className="tx">{e}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chat">
            {chatHints.length > 0 && (
              <div className="chips">
                {chatHints.map((c) => (
                  <span key={c} className="chip" onClick={() => void handleChatSend(c)}>
                    {c}
                  </span>
                ))}
              </div>
            )}
            <div className="composer">
              <input
                placeholder={
                  intr
                    ? '回复副驾（或在上层弹窗确认）…'
                    : finished
                      ? '继续改 deck、加页、调风格…'
                      : '和副驾说点什么…'
                }
                value={chatText}
                disabled={chatBusy}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleChatSend()
                  }
                }}
              />
              {loading ? (
                <button
                  type="button"
                  className="send"
                  title="停止"
                  onClick={() => stream.stop?.()}
                >
                  <svg viewBox="0 0 24 24" fill="#fff">
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  className="send"
                  title="发送"
                  disabled={!chatText.trim()}
                  onClick={() => void handleChatSend()}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="film">
          <div className="film-h">
            <span className="t">幻灯片</span>
            <span className="c">
              {pages.length
                ? pages.length + ' 页 · 点开看内容'
                : pageCount
                  ? pageCount + ' 页'
                  : '生成中'}
            </span>
          </div>
          <div className="strip">
            {(pages.length ? pages : Array.from({ length: pageCount || 6 })).map((p, i) => (
              <div
                key={i}
                className={
                  'thumb' + (pages.length ? ' has' : finished ? ' ready' : ' pending')
                }
                onClick={() => pages.length && setOpenPage(i)}
                onKeyDown={(e) => e.key === 'Enter' && pages.length && setOpenPage(i)}
                role={pages.length ? 'button' : undefined}
                tabIndex={pages.length ? 0 : undefined}
                title={pages.length ? '点开看本页内容' : ''}
              >
                <span className="tn">{String(i + 1).padStart(2, '0')}</span>
                {pages.length ? (
                  <div
                    className="tmini"
                    style={{
                      inset: '16px 8px 8px 8px',
                      position: 'absolute',
                      fontSize: 9,
                      color: 'var(--ink-2)',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                    }}
                  >
                    {(p as SlidePlanPage).page_title || (p as SlidePlanPage).title || ''}
                  </div>
                ) : finished ? null : (
                  <div className="thumb-skel">
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {openPage !== null && pages[openPage] && (
        <PageDetail
          page={pages[openPage] as SlidePlanPage}
          n={openPage + 1}
          total={pages.length}
          onClose={() => setOpenPage(null)}
          onNav={(d) =>
            setOpenPage(Math.max(0, Math.min(pages.length - 1, openPage + d)))
          }
        />
      )}
    </div>
  )
}
