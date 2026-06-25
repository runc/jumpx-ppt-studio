import React from 'react'
import type { AgentStream, SlidePlanPage } from '@jumpx/ports'
import { usePorts } from '@jumpx/adapters-browser'

/** 从 agent files 或 RunPreviewPort 拉逐页 plan（Lite 无 /api/runs 轮询） */
export function useRunPlan(
  stream: AgentStream,
  runSlug: string | null,
  finished: boolean,
): { pages: SlidePlanPage[] } | null {
  const ports = usePorts()
  const [runPlan, setRunPlan] = React.useState<{ pages: SlidePlanPage[] } | null>(null)
  const fileKeys = Object.keys(stream.values.files || {}).join(',')
  const msgCount = stream.messages.length

  React.useEffect(() => {
    if (!runSlug) {
      setRunPlan(null)
      return
    }
    let alive = true
    const pull = () =>
      void ports.run.getPlan(runSlug, stream).then((d) => {
        if (alive && d) setRunPlan(d)
      })
    pull()
    const t = finished ? null : setInterval(pull, 2000)
    return () => {
      alive = false
      if (t) clearInterval(t)
    }
  }, [ports, runSlug, finished, fileKeys, msgCount, stream])

  return runPlan
}
