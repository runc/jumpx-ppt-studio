import type { AgentStream, FileEntry, InterruptInfo, Todo } from './types.js'

/** 从 messages 拉活动流（assistant 的工具调用 + 文本片段） */
export function activityFromMessages(messages: unknown[]): string[] {
  const evs: string[] = []
  for (const m of messages || []) {
    const msg = m as {
      type?: string
      role?: string
      content?: unknown
      tool_calls?: { name?: string; function?: { name?: string } }[]
      additional_kwargs?: { tool_calls?: { name?: string; function?: { name?: string } }[] }
    }
    const role = msg.type || msg.role
    if (role === 'human' || role === 'user') {
      if (typeof msg.content === 'string' && msg.content.trim()) {
        evs.push('你说：' + msg.content.trim().slice(0, 52))
      }
      continue
    }
    if (role !== 'ai' && role !== 'assistant') continue
    const tcs = msg.tool_calls || msg.additional_kwargs?.tool_calls || []
    for (const tc of tcs) {
      const nm = tc.name || tc.function?.name
      if (nm) evs.push(`调用 ${nm}`)
    }
    if (typeof msg.content === 'string' && msg.content.trim()) {
      evs.push(msg.content.trim().slice(0, 60))
    }
  }
  return evs.slice(-6).reverse()
}

export function tasksFromTodos(todos: Todo[] = []) {
  return todos.map((t) => ({
    ti: t.content || t.title || '',
    st:
      t.status === 'completed' ? ('done' as const)
      : t.status === 'in_progress' ? ('doing' as const)
      : ('todo' as const),
  }))
}

function fileContent(files: Record<string, FileEntry>, path: string): string | null {
  const fd = files[path]
  if (!fd) return null
  if (typeof fd.content === 'string') return fd.content
  if (Array.isArray(fd.content)) return fd.content.join('\n')
  return null
}

export function findOutputPath(stream: AgentStream | null): string | null {
  const files = stream?.values?.files || {}
  const k = Object.keys(files).find((x) => x.endsWith('index.html'))
  return k || null
}

export function findRunSlug(stream: AgentStream | null): string | null {
  const p = findOutputPath(stream)
  if (p) {
    const m = p.match(/runs\/([^/]+)\/index\.html/)
    if (m) return m[1]
  }
  const msgs = stream?.messages || []
  for (const m of [...msgs].reverse()) {
    let s = ''
    try {
      s =
        typeof (m as { content?: unknown }).content === 'string'
          ? (m as { content: string }).content
          : JSON.stringify(m)
    } catch {
      s = ''
    }
    const mm = s.match(/runs[\\/]+([A-Za-z0-9_-]+)[\\/]/)
    if (mm) return mm[1]
  }
  return null
}

export function findPageCount(stream: AgentStream | null): number {
  const files = stream?.values?.files || {}
  const k = Object.keys(files).find((x) => x.endsWith('slide_plan.json'))
  if (k) {
    try {
      const raw = fileContent(files, k)
      if (raw) {
        const plan = JSON.parse(raw) as { pages?: unknown[] }
        if (Array.isArray(plan.pages)) return plan.pages.length
      }
    } catch {
      /* ignore */
    }
  }
  return 0
}

export function runFinished(stream: AgentStream | null): boolean {
  if (stream?.htmlPreview || findOutputPath(stream)) return true
  return false
}

export function planFinished(stream: AgentStream | null): boolean {
  const todos = stream?.values?.todos || []
  return (
    todos.length > 0 &&
    todos.every((t) => t.status === 'completed') &&
    !stream?.isLoading &&
    !stream?.interrupt
  )
}

export function readInterrupt(stream: AgentStream | null): InterruptInfo | null {
  const it = stream?.interrupt as {
    value?: {
      name?: string
      actionRequests?: { name: string; args?: Record<string, unknown> }[]
      action_requests?: { name: string; args?: Record<string, unknown> }[]
      [key: string]: unknown
    }
  } | null
  if (!it?.value) return null
  const v = it.value
  const ar = v.actionRequests?.[0] || v.action_requests?.[0]
  if (ar) return { name: ar.name, args: ar.args || {}, description: '' }
  if (typeof v.name === 'string') {
    const { name, ...args } = v
    return { name, args: args as Record<string, unknown>, description: '' }
  }
  return null
}

export function parseSlidePlanFromFiles(
  files: Record<string, FileEntry>,
): { pages: import('./types.js').SlidePlanPage[] } | null {
  const k = Object.keys(files).find((x) => x.endsWith('slide_plan.json'))
  if (!k) return null
  try {
    const raw = fileContent(files, k)
    if (!raw) return null
    const plan = JSON.parse(raw) as { pages?: import('./types.js').SlidePlanPage[] }
    if (!Array.isArray(plan.pages)) return null
    return { pages: plan.pages }
  } catch {
    return null
  }
}
