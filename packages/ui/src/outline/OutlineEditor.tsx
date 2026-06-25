import React from 'react'
import { respondInterrupt } from '@jumpx/agent-js'
import type { AgentStream } from '@jumpx/ports'
import { parseOutline, roleTag } from './parseOutline.js'

export function OutlineEditor({
  stream,
  args,
}: {
  stream: AgentStream
  args: Record<string, unknown>
}) {
  const outline = String(args.outline_md || args.outline || '')
  const note = String(args.note || '')
  const { strategy, pages } = React.useMemo(() => parseOutline(outline), [outline])
  const [sel, setSel] = React.useState(pages[0]?.n ?? 1)

  React.useEffect(() => {
    if (pages[0]?.n) setSel(pages[0].n)
  }, [pages])

  if (!pages.length) {
    if (!outline.trim()) {
      return (
        <div className="oe-empty">
          <p>大纲生成中…</p>
        </div>
      )
    }
    return (
      <div className="oe oe-raw">
        <div className="oe-raw-head">确认大纲{note ? ` · ${note.slice(0, 50)}` : ''}</div>
        <pre className="oe-raw-body">{outline}</pre>
        <div className="oe-acts">
          <button
            type="button"
            className="btn"
            onClick={() => void respondInterrupt(stream, '请把要点更精简一些，重拟大纲')}
          >
            重拟（更精简）
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void respondInterrupt(stream, 'OK，确认大纲，继续')}
          >
            ✓ 确认大纲，继续
          </button>
        </div>
      </div>
    )
  }

  const selPage = pages.find((p) => p.n === sel) || pages[0]

  return (
    <div className="oe">
      <div className="oe-tree">
        <div className="oe-agent">
          <div className="oe-ai">
            <i />
          </div>
          <div className="oe-msg">
            共 <b>{pages.length} 页</b>。
            {strategy ? (
              <span className="oe-strategy">
                {strategy.slice(0, 80)}
                {strategy.length > 80 ? '…' : ''}
              </span>
            ) : (
              '顺序和重点先这样——有要调的直接告诉我。'
            )}
          </div>
        </div>
        <div className="oe-list">
          {pages.map((p) => (
            <div
              key={p.n}
              className={'oe-row' + (sel === p.n ? ' sel' : '')}
              onClick={() => setSel(p.n)}
              onKeyDown={(e) => e.key === 'Enter' && setSel(p.n)}
              role="button"
              tabIndex={0}
            >
              <span className="oe-pn">{String(p.n).padStart(2, '0')}</span>
              <span className="oe-pt">{p.title}</span>
              {p.role && <span className="oe-role">{roleTag(p.role)}</span>}
            </div>
          ))}
        </div>
        <div className="oe-foot">
          <span className="oe-meta">
            {pages.length} 页{note ? ` · ${note}` : ''}
          </span>
        </div>
      </div>

      <div className="oe-board">
        <div className="oe-grid">
          {pages.map((p) => {
            const isFirst = p.n === 1
            const isSel = p.n === sel
            return (
              <div
                key={p.n}
                className={'oe-card' + (isFirst ? ' cover' : '') + (isSel ? ' sel' : '')}
                onClick={() => setSel(p.n)}
                onKeyDown={(e) => e.key === 'Enter' && setSel(p.n)}
                role="button"
                tabIndex={0}
              >
                <div className="oe-bn">{isFirst ? '封面' : String(p.n).padStart(2, '0')}</div>
                <div className="oe-bt">{p.title}</div>
                {p.oneliner && <div className="oe-one">{p.oneliner}</div>}
                <div className="oe-bls">
                  {p.bullets.slice(0, 3).map((b, i) => (
                    <i key={i}>{b}</i>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {selPage && (
          <div className="oe-detail">
            <div className="oe-dh">
              <b>
                {String(selPage.n).padStart(2, '0')} · {selPage.title}
              </b>
              {selPage.role && <span className="oe-role">{roleTag(selPage.role)}</span>}
            </div>
            {selPage.oneliner && <div className="oe-done">{selPage.oneliner}</div>}
            {selPage.bullets.length > 0 && (
              <ul className="oe-dbl">
                {selPage.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="oe-acts">
          <button
            type="button"
            className="btn"
            onClick={() => void respondInterrupt(stream, '请把要点更精简一些，重拟大纲')}
          >
            重拟（更精简）
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void respondInterrupt(stream, 'OK，确认大纲，继续')}
          >
            ✓ 确认大纲，继续
          </button>
        </div>
      </div>
    </div>
  )
}
