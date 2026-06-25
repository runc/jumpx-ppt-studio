import React from 'react'
import { BrandMark } from '../shell/Brand.js'
import type { SlidePlanPage } from '@jumpx/ports'

const LOGICAL_W = 1280
const LOGICAL_H = 720

function deckDoc(iframe: HTMLIFrameElement | null) {
  try {
    return iframe?.contentDocument ?? null
  } catch {
    return null
  }
}

function deckSlideCount(iframe: HTMLIFrameElement | null) {
  const d = deckDoc(iframe)
  return d ? d.querySelectorAll('.slide').length : 0
}

function driveDeck(iframe: HTMLIFrameElement | null, i: number, animate = true) {
  const d = deckDoc(iframe)
  if (!d) return
  const deck = d.getElementById('deck')
  if (!deck) return
  deck.style.transition = animate ? 'transform .35s ease' : 'none'
  deck.style.transform = `translateX(${-i * 100}vw)`
}

function hideDeckChrome(iframe: HTMLIFrameElement | null) {
  const d = deckDoc(iframe)
  if (!d) return
  let s = d.getElementById('__present_css') as HTMLStyleElement | null
  if (!s) {
    s = d.createElement('style')
    s.id = '__present_css'
    d.head.appendChild(s)
  }
  s.textContent = '.slide-controls,.slide-index{display:none!important}'
}

function makeChannel(presentKey: string, role: string, onMsg: (data: Record<string, unknown>) => void) {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, close: () => {} }
  const ch = new BroadcastChannel(`jumpx-present-${presentKey}`)
  const id = role + '-' + Math.floor(performance.now())
  ch.onmessage = (e) => {
    if (e.data && e.data.sender !== id) onMsg(e.data)
  }
  return {
    post: (data: Record<string, unknown>) => ch.postMessage({ ...data, sender: id }),
    close: () => ch.close(),
  }
}

function useFit(ref: React.RefObject<HTMLDivElement | null>, depKey: unknown) {
  const [scale, setScale] = React.useState(1)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      setScale(Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [depKey])
  return scale
}

function DeckFrame({
  previewUrl,
  previewHtml,
  page,
  onReady,
  title,
  className,
  style,
}: {
  previewUrl?: string | null
  previewHtml?: string | null
  page: number
  onReady?: () => void
  title?: string
  className?: string
  style?: React.CSSProperties
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  React.useEffect(() => {
    if (frameRef.current) {
      hideDeckChrome(frameRef.current)
      driveDeck(frameRef.current, page, false)
    }
  }, [page, previewUrl, previewHtml])

  return (
    <iframe
      ref={frameRef}
      title={title || 'deck'}
      className={className}
      style={style}
      src={previewUrl || undefined}
      srcDoc={!previewUrl && previewHtml ? previewHtml : undefined}
      scrolling="no"
      onLoad={() => {
        hideDeckChrome(frameRef.current)
        driveDeck(frameRef.current, page, false)
        onReady?.()
      }}
    />
  )
}

function DeckMini({
  previewUrl,
  previewHtml,
  page,
}: {
  previewUrl?: string | null
  previewHtml?: string | null
  page: number
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const scale = useFit(wrapRef, 0)
  return (
    <div className="pm-wrap" ref={wrapRef}>
      <div
        className="pm-canvas"
        style={{
          width: LOGICAL_W,
          height: LOGICAL_H,
          transform: `translate(-50%,-50%) scale(${scale})`,
        }}
      >
        <DeckFrame
          previewUrl={previewUrl}
          previewHtml={previewHtml}
          page={page}
          title={'p' + page}
          style={{ width: LOGICAL_W, height: LOGICAL_H, border: 0, pointerEvents: 'none' }}
        />
      </div>
    </div>
  )
}

export function PresentStage({
  presentKey,
  previewUrl,
  previewHtml,
  onExit,
}: {
  presentKey: string
  previewUrl?: string | null
  previewHtml?: string | null
  onExit?: () => void
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [overview, setOverview] = React.useState(false)
  const [buf, setBuf] = React.useState('')
  const chanRef = React.useRef<ReturnType<typeof makeChannel> | null>(null)
  const pageRef = React.useRef(0)
  pageRef.current = page

  React.useEffect(() => {
    chanRef.current = makeChannel(presentKey, 'stage', (m) => {
      if (m.type === 'goto' && typeof m.page === 'number') applyPage(m.page, false)
      if (m.type === 'hello') chanRef.current?.post({ type: 'state', page: pageRef.current, total })
    })
    return () => chanRef.current?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentKey, total])

  function applyPage(i: number, broadcast = true) {
    const n = total || deckSlideCount(frameRef.current) || 1
    const p = Math.max(0, Math.min(n - 1, i))
    pageRef.current = p
    setPage(p)
    driveDeck(frameRef.current, p)
    if (broadcast && chanRef.current) chanRef.current.post({ type: 'goto', page: p, total: n })
  }
  const go = (d: number) => applyPage(pageRef.current + d)

  function onFrameLoad() {
    hideDeckChrome(frameRef.current)
    const n = deckSlideCount(frameRef.current)
    setTotal(n)
    driveDeck(frameRef.current, pageRef.current, false)
    chanRef.current?.post({ type: 'state', page: pageRef.current, total: n })
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setBuf((b) => (b + e.key).slice(-3))
        return
      }
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
        case 'ArrowDown':
          go(1)
          break
        case 'ArrowLeft':
        case 'PageUp':
        case 'ArrowUp':
          go(-1)
          break
        case 'Home':
          applyPage(0)
          break
        case 'End':
          applyPage((total || 1) - 1)
          break
        case 'Enter':
          if (buf) {
            applyPage(parseInt(buf, 10) - 1)
            setBuf('')
          }
          break
        case 'f':
        case 'F':
          toggleFs()
          break
        case 'o':
        case 'O':
          setOverview((v) => !v)
          break
        case 'p':
        case 'P':
          openPresenter()
          break
        case 'Escape':
          if (overview) setOverview(false)
          else onExit?.()
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, overview, buf])

  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }
  function openPresenter() {
    if (previewHtml) {
      try {
        sessionStorage.setItem(`jumpx-present-html-${presentKey}`, previewHtml)
      } catch {
        /* ignore quota */
      }
    }
    window.open(`?present=${encodeURIComponent(presentKey)}&role=presenter`, '_blank')
  }

  return (
    <div className="present-stage">
      <BrandMark onDark className="ps-brand" />
      <iframe
        ref={frameRef}
        title="deck"
        className="ps-frame"
        src={previewUrl || undefined}
        srcDoc={!previewUrl && previewHtml ? previewHtml : undefined}
        onLoad={onFrameLoad}
      />
      <div className="ps-bar">
        <button type="button" className="ps-btn" onClick={() => go(-1)} aria-label="上一页">
          ‹
        </button>
        <span className="ps-page">
          {Math.min(page + 1, total || 1)} / {total || '…'}
        </span>
        <button type="button" className="ps-btn" onClick={() => go(1)} aria-label="下一页">
          ›
        </button>
        <span className="ps-sp" />
        <button type="button" className="ps-btn" onClick={() => setOverview(true)} title="总览 (O)">
          ▦
        </button>
        <button type="button" className="ps-btn" onClick={openPresenter} title="演讲者视图 (P)">
          🧑‍🏫
        </button>
        <button type="button" className="ps-btn" onClick={toggleFs} title="全屏 (F)">
          ⛶
        </button>
        <button type="button" className="ps-btn" onClick={() => onExit?.()} title="退出 (Esc)">
          ✕
        </button>
      </div>
      <div className="ps-progress">
        <i style={{ width: `${total ? ((page + 1) / total) * 100 : 0}%` }} />
      </div>
      {buf && <div className="ps-goto">跳到第 {buf} 页 · Enter</div>}
      {overview && (
        <div className="ps-overview" onClick={() => setOverview(false)}>
          <div className="ps-ov-grid">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={'ps-ov-cell' + (i === page ? ' cur' : '')}
                onClick={(e) => {
                  e.stopPropagation()
                  applyPage(i)
                  setOverview(false)
                }}
              >
                <DeckMini previewUrl={previewUrl} previewHtml={previewHtml} page={i} />
                <span className="ps-ov-n">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PresenterView({
  presentKey,
  previewUrl,
  previewHtml,
  pages: pagesProp,
}: {
  presentKey: string
  previewUrl?: string | null
  previewHtml?: string | null
  pages?: SlidePlanPage[]
}) {
  const [page, setPage] = React.useState(0)
  const [total, setTotal] = React.useState(pagesProp?.length || 0)
  const [pages, setPages] = React.useState<SlidePlanPage[]>(pagesProp || [])
  const chanRef = React.useRef<ReturnType<typeof makeChannel> | null>(null)
  const pageRef = React.useRef(0)
  pageRef.current = page

  React.useEffect(() => {
    if (pagesProp?.length) {
      setPages(pagesProp)
      setTotal(pagesProp.length)
    }
  }, [pagesProp])

  React.useEffect(() => {
    chanRef.current = makeChannel(presentKey, 'presenter', (m) => {
      if ((m.type === 'goto' || m.type === 'state') && typeof m.page === 'number') {
        setPage(m.page)
        if (typeof m.total === 'number') setTotal(m.total)
      }
    })
    chanRef.current.post({ type: 'hello' })
    return () => chanRef.current?.close()
  }, [presentKey])

  function go(d: number) {
    const n = total || 1
    const p = Math.max(0, Math.min(n - 1, pageRef.current + d))
    pageRef.current = p
    setPage(p)
    chanRef.current?.post({ type: 'goto', page: p, total: n })
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'PageDown', 'ArrowDown'].includes(e.key)) {
        go(1)
        e.preventDefault()
      } else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) {
        go(-1)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  const cur = pages[page] || {}
  const notes = cur.speaker_notes || (cur as { speaker_note?: string }).speaker_note || '（本页无演讲备注）'

  return (
    <div className="presenter">
      <div className="pr-main">
        <div className="pr-h">
          当前 · 第 {page + 1} / {total || '…'} 页
        </div>
        <DeckMini previewUrl={previewUrl} previewHtml={previewHtml} page={page} />
      </div>
      <div className="pr-side">
        <Timer />
        <div className="pr-next">
          <div className="pr-h">下一页</div>
          {page + 1 < (total || 0) ? (
            <DeckMini previewUrl={previewUrl} previewHtml={previewHtml} page={page + 1} />
          ) : (
            <div className="pr-end">— 已是最后一页 —</div>
          )}
        </div>
      </div>
      <div className="pr-notes">
        <div className="pr-h">演讲备注 · {cur.page_title || ''}</div>
        <div className="pr-notes-body">{notes}</div>
      </div>
      <div className="pr-ctrl">
        <button type="button" className="ps-btn" onClick={() => go(-1)}>
          ‹ 上一页
        </button>
        <button type="button" className="ps-btn" onClick={() => go(1)}>
          下一页 ›
        </button>
      </div>
    </div>
  )
}

function Timer() {
  const [ms, setMs] = React.useState(0)
  const [run, setRun] = React.useState(true)
  React.useEffect(() => {
    if (!run) return
    const t = setInterval(() => setMs((m) => m + 1000), 1000)
    return () => clearInterval(t)
  }, [run])
  const s = Math.floor(ms / 1000)
  const fmt = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return (
    <div className="pr-timer">
      <div className="pr-clock">{fmt}</div>
      <div className="pr-tbtns">
        <button type="button" className="ps-btn" onClick={() => setRun((r) => !r)}>
          {run ? '暂停' : '继续'}
        </button>
        <button type="button" className="ps-btn" onClick={() => setMs(0)}>
          重置
        </button>
      </div>
    </div>
  )
}
