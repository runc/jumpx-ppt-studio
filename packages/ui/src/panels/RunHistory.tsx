import React from 'react'
import { usePorts } from '@jumpx/adapters-browser'
import type { RunListItem } from '@jumpx/ports'

function fmtTime(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function RunHistory({
  onOpenRun,
  onResume,
  canResume,
}: {
  onOpenRun: (id: string) => void
  onResume?: () => void
  canResume?: boolean
}) {
  const ports = usePorts()
  const [runs, setRuns] = React.useState<RunListItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!ports.run.list) {
        setLoading(false)
        return
      }
      try {
        const rows = await ports.run.list()
        if (!cancelled) setRuns(rows)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ports])

  if (loading) return null

  const hasRuns = runs.length > 0

  if (!canResume && !hasRuns) return null

  return (
    <div className="run-history">
      {canResume && onResume && (
        <div className="run-resume" style={{ marginBottom: hasRuns ? 14 : 0 }}>
          <span className="pdot" />
          检测到未完成的生成任务
          <button type="button" className="btn primary" onClick={() => onResume()}>
            继续上次
          </button>
        </div>
      )}
      {hasRuns && (
        <>
          <div className="lab" style={{ marginBottom: 8 }}>
            最近生成
          </div>
          <div className="run-history-list">
            {runs.slice(0, 8).map((r) => (
              <button
                type="button"
                key={r.id}
                className="run-history-item"
                disabled={!r.has_html}
                onClick={() => onOpenRun(r.id)}
                title={r.has_html ? '打开预览' : '尚无 HTML'}
              >
                <span className="run-history-title">{r.title}</span>
                <span className="run-history-meta">
                  {r.pages ? `${r.pages} 页 · ` : ''}
                  {fmtTime(r.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
