import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command, isGraphInterrupt } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { composeBrief } from '@jumpx/core'
import type { AgentStream, StartRunOpts } from '@jumpx/ports'
import {
  findOutputPath,
  findPageCount,
  findRunSlug,
  planFinished,
  readInterrupt as readInterruptPort,
  runFinished,
} from '@jumpx/ports'
import { buildSlidesAgent, skillFilesToInvokePayload } from './agent.js'
import { runWithGraphConfig } from './browserAls.js'
import { loadLlmConfig } from './providers.js'
import { consumeAgentStream } from './consumeAgentStream.js'
import type { SkillFileData } from '@jumpx/forge-assets'
import {
  ACTIVE_THREAD_KEY,
  ACTIVE_TOPIC_KEY,
  getLiteCheckpointer,
  hasPersistedThread,
} from './persistence/indexedDbCheckpointSaver.js'

export type BrowserAgentStream = AgentStream & {
  markOutlineGateResolved?: () => void
  resetSession: () => void
  hasPersistedSession: boolean
  restorePersistedSession: () => Promise<boolean>
}

function parseInterruptFromResult(
  result: Record<string, unknown> | null | undefined,
): { value: unknown } | null | undefined {
  if (!result || !('__interrupt__' in result)) return undefined
  const raw = result.__interrupt__ as Array<{ value?: unknown } | unknown> | undefined
  if (!raw?.length) return null
  const item = raw[0]
  const value =
    item && typeof item === 'object' && item !== null && 'value' in item
      ? (item as { value?: unknown }).value
      : item
  if (!value) return null
  return { value }
}

async function resolveStateAfterRun(
  agent: { getState: (config: { configurable: { thread_id: string } }) => Promise<unknown> },
  config: { configurable: { thread_id: string } },
  result: Record<string, unknown>,
) {
  if (parseInterruptFromResult(result) !== undefined) return result
  try {
    const snap = (await agent.getState(config)) as {
      values?: Record<string, unknown>
      tasks?: { interrupts?: { value?: unknown }[] }[]
    }
    const merged = { ...(snap?.values || {}), ...result }
    const fromTasks = (snap?.tasks || []).flatMap((t) => t.interrupts || [])
    if (fromTasks.length && !('__interrupt__' in merged)) {
      merged.__interrupt__ = fromTasks
    }
    return merged
  } catch {
    return result
  }
}

function normalizeFiles(
  files: Record<string, { content?: string | string[] }> | undefined,
): Record<string, { content?: string | string[] }> {
  return files || {}
}

function fileContent(
  files: Record<string, { content?: string | string[] }>,
  path: string,
): string | null {
  const fd = files[path]
  if (!fd) return null
  if (typeof fd.content === 'string') return fd.content
  if (Array.isArray(fd.content)) return fd.content.join('\n')
  return null
}

function findOutlineMd(files: Record<string, { content?: string | string[] }>): string | null {
  const k = Object.keys(files).find((x) => x.endsWith('/source/outline.md'))
  if (!k) return null
  const c = fileContent(files, k)
  return c?.trim() ? c : null
}

function hasSlidePlan(files: Record<string, { content?: string | string[] }>): boolean {
  return Object.keys(files).some((x) => x.endsWith('/source/slide_plan.json'))
}

function messagesIncludeToolCall(msgs: unknown[], toolName: string): boolean {
  for (const m of msgs) {
    const msg = m as {
      name?: string
      tool_calls?: { name?: string }[]
      kwargs?: { tool_calls?: { name?: string }[] }
    }
    if (msg.name === toolName) return true
    const calls = msg.tool_calls || msg.kwargs?.tool_calls
    if (calls?.some((tc) => tc.name === toolName)) return true
  }
  return false
}

function extractOutlineFromMessages(msgs: unknown[]): string | null {
  for (const m of [...msgs].reverse()) {
    const msg = m as { type?: string; role?: string; content?: unknown }
    const role = msg.type || msg.role
    if (role !== 'ai' && role !== 'assistant') continue
    const c = typeof msg.content === 'string' ? msg.content : ''
    if (!c || c.length < 80) continue
    if (/确认无误|请回\s*["']?OK|Gate 2|outline/i.test(c)) return c.trim()
    if (/^#\s/m.test(c) && (/页|大纲|outline/i.test(c) || c.split('\n').length >= 8)) return c.trim()
  }
  return null
}

/** skill Gate 2 在 Claude Code 里是「聊天等 OK」；Lite 无聊天框，需从 outline 合成 HITL 弹层 */
function syntheticOutlineInterrupt(
  files: Record<string, { content?: string | string[] }>,
  msgs: unknown[],
  outlineGateResolved: boolean,
): { value: unknown } | null {
  if (outlineGateResolved) return null
  if (findOutputPathFromFiles(files) || hasSlidePlan(files)) return null
  if (messagesIncludeToolCall(msgs, 'confirm_outline')) return null
  const outline = findOutlineMd(files) || extractOutlineFromMessages(msgs)
  if (!outline) return null
  return {
    value: {
      __synthetic: true,
      actionRequests: [
        {
          name: 'confirm_outline',
          args: {
            outline_md: outline,
            note: '大纲已写入工程目录，请确认后继续（Lite 无聊天框，须在此确认）',
          },
        },
      ],
    },
  }
}

function findOutputPathFromFiles(files: Record<string, { content?: string | string[] }>) {
  return Object.keys(files).find((x) => x.endsWith('index.html')) || null
}

export function useBrowserAgent(
  skillFiles: Record<string, SkillFileData>,
  skillsMount = '/skills/ai-slide-producer',
): BrowserAgentStream {
  const [messages, setMessages] = useState<unknown[]>([])
  const [todos, setTodos] = useState<unknown[]>([])
  const [files, setFiles] = useState<Record<string, { content?: string | string[] }>>({})
  const [interrupt, setInterrupt] = useState<unknown | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null)
  const [awaitingUser, setAwaitingUser] = useState(false)

  const filesRef = useRef(files)
  filesRef.current = files
  const threadIdRef = useRef(`lite-${Date.now()}`)
  const checkpointerRef = useRef(getLiteCheckpointer())
  const [hasPersistedSession, setHasPersistedSession] = useState(false)
  const agentRef = useRef<ReturnType<typeof buildSlidesAgent> | null>(null)
  const htmlStoreRef = useRef<Record<string, string>>({})
  const runningRef = useRef(false)
  const llmKeyRef = useRef('')
  const skillKeyRef = useRef('')
  const outlineGateResolvedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const getAgent = useCallback(() => {
    const llmConfig = loadLlmConfig()
    const llmKey = `${llmConfig.apiKey}|${llmConfig.baseURL}|${llmConfig.model}`
    const skillKey = `${skillsMount}|${Object.keys(skillFiles).sort().join(',')}`
    if (!agentRef.current || llmKeyRef.current !== llmKey || skillKeyRef.current !== skillKey) {
      llmKeyRef.current = llmKey
      skillKeyRef.current = skillKey
      agentRef.current = buildSlidesAgent({
        llmConfig,
        skillFiles,
        skillsMount,
        checkpointer: checkpointerRef.current,
        getFiles: () => {
          const merged = { ...filesRef.current }
          for (const [proj, html] of Object.entries(htmlStoreRef.current)) {
            merged[`/runs/${proj}/index.html`] = { content: html }
          }
          return merged
        },
        getLlmConfig: () => loadLlmConfig(),
        onHtmlRendered: (project, html) => {
          htmlStoreRef.current[project] = html
          setHtmlPreview(html)
          setFiles((prev) => ({
            ...prev,
            [`/runs/${project}/index.html`]: { content: html },
          }))
        },
        onFileWritten: (path, content) => {
          setFiles((prev) => {
            const merged = { ...prev, [path]: { content } }
            filesRef.current = merged
            return merged
          })
        },
      })
    }
    return agentRef.current
  }, [skillFiles, skillsMount])

  const resetSession = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    runningRef.current = false
    threadIdRef.current = `lite-${Date.now()}`
    checkpointerRef.current = getLiteCheckpointer()
    agentRef.current = null
    llmKeyRef.current = ''
    filesRef.current = {}
    htmlStoreRef.current = {}
    outlineGateResolvedRef.current = false
    try {
      localStorage.removeItem(ACTIVE_THREAD_KEY)
      localStorage.removeItem(ACTIVE_TOPIC_KEY)
    } catch {
      /* ignore */
    }
    setHasPersistedSession(false)
    setMessages([])
    setTodos([])
    setFiles({})
    setInterrupt(null)
    setAwaitingUser(false)
    setError(null)
    setHtmlPreview(null)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_THREAD_KEY)
      if (saved) {
        void hasPersistedThread(saved).then(setHasPersistedSession)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const persistSessionMeta = useCallback((topic?: string) => {
    try {
      localStorage.setItem(ACTIVE_THREAD_KEY, threadIdRef.current)
      if (topic) localStorage.setItem(ACTIVE_TOPIC_KEY, topic)
    } catch {
      /* ignore */
    }
    setHasPersistedSession(true)
  }, [])

  const applyState = useCallback((state: Record<string, unknown>) => {
    if (Array.isArray(state.messages)) setMessages(state.messages)
    if (Array.isArray(state.todos)) setTodos(state.todos)
    if (state.files && typeof state.files === 'object') {
      const next = normalizeFiles(state.files as Record<string, { content?: string | string[] }>)
      setFiles((prev) => {
        const merged = { ...prev, ...next }
        filesRef.current = merged
        return merged
      })
      for (const [k, v] of Object.entries(next)) {
        if (k.endsWith('/index.html')) {
          const c = fileContent(next, k)
          if (c) setHtmlPreview(c)
        }
      }
    }
    const intr = parseInterruptFromResult(state)
    if (intr !== undefined) {
      setInterrupt(intr)
      setAwaitingUser(Boolean(intr))
    }
  }, [])

  const restorePersistedSession = useCallback(async () => {
    try {
      const threadId = localStorage.getItem(ACTIVE_THREAD_KEY)
      if (!threadId) return false
      const ok = await hasPersistedThread(threadId)
      if (!ok) return false
      threadIdRef.current = threadId
      const agent = getAgent()
      const config = { configurable: { thread_id: threadId } }
      const snap = (await agent.getState(config)) as {
        values?: Record<string, unknown>
        tasks?: { interrupts?: { value?: unknown }[] }[]
        next?: string[]
      }
      const values = snap?.values || {}
      applyState(values)
      const fromTasks = (snap?.tasks || []).flatMap((t) => t.interrupts || [])
      if (fromTasks.length) {
        setInterrupt({ value: fromTasks[0].value })
        setAwaitingUser(true)
      } else if (Array.isArray(snap?.next) && snap.next.length > 0) {
        setAwaitingUser(true)
      }
      setHasPersistedSession(true)
      return true
    } catch {
      return false
    }
  }, [applyState, getAgent])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    runningRef.current = false
    setIsLoading(false)
  }, [])

  const runInvoke = useCallback(
    async (
      input: Record<string, unknown> | Command | null,
      opts?: Parameters<BrowserAgentStream['submit']>[1],
    ) => {
      if (runningRef.current) {
        setError('上一步仍在执行，请稍候…')
        return
      }
      runningRef.current = true
      setIsLoading(true)
      setError(null)
      setAwaitingUser(false)
      setInterrupt(null)
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      try {
        const agent = getAgent()
        const config = {
          configurable: { thread_id: threadIdRef.current },
          recursionLimit: 100,
          signal: ac.signal,
        }
        persistSessionMeta()
        let payload: Record<string, unknown> | Command
        const isResume = opts?.command?.resume !== undefined

        if (isResume) {
          payload = new Command({ resume: opts!.command!.resume })
        } else if (input && input instanceof Command) {
          payload = input
        } else {
          const partial: Record<string, unknown> = { ...(input || {}) }
          const hasRun = Object.keys(filesRef.current).some((k) => k.includes('/runs/'))
          if (!partial.files && !hasRun) {
            partial.files = skillFilesToInvokePayload(skillFiles)
          }
          payload = partial
        }

        let latest: Record<string, unknown> = {}
        await runWithGraphConfig(config, async () => {
          latest = await consumeAgentStream(agent, payload, config, {
            onValues: applyState,
            onMessages: () => {
              /* messages 流已启用；完整 state 由 values 模式回灌 */
            },
          })
        })
        const finalState = await resolveStateAfterRun(agent, config, latest)
        applyState(finalState)

        const snap = (await agent.getState(config)) as { next?: string[] }
        const paused = Array.isArray(snap?.next) && snap.next.length > 0
        const hasIntr = parseInterruptFromResult(finalState)
        if (hasIntr) {
          setInterrupt(hasIntr)
          setAwaitingUser(true)
        } else if (paused) {
          setAwaitingUser(true)
        } else {
          const msgs = Array.isArray(finalState.messages) ? finalState.messages : []
          const bridge = syntheticOutlineInterrupt(
            filesRef.current,
            msgs,
            outlineGateResolvedRef.current,
          )
          if (bridge) {
            setInterrupt(bridge)
            setAwaitingUser(true)
          } else {
            setAwaitingUser(false)
          }
        }
      } catch (e) {
        if (ac.signal.aborted) {
          return
        }
        if (isGraphInterrupt(e)) {
          const intr = (e as { interrupts?: { value?: unknown }[] }).interrupts
          if (intr?.length) {
            setInterrupt({ value: intr[0].value })
            setAwaitingUser(true)
          }
        } else {
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null
        runningRef.current = false
        setIsLoading(false)
      }
    },
    [applyState, getAgent, persistSessionMeta, skillFiles],
  )

  const submit = useCallback(
    async (
      input: { messages?: { type?: string; role?: string; content: string }[] } | null,
      opts?: Parameters<BrowserAgentStream['submit']>[1],
    ) => {
      if (opts?.command?.resume !== undefined) {
        await runInvoke(null, opts)
        return
      }
      const human = input?.messages?.[0]
      if (!human) return
      const hasRunArtifacts =
        Boolean(findOutputPathFromFiles(filesRef.current)) ||
        Object.keys(filesRef.current).some((k) => k.includes('/runs/'))
      await runInvoke({
        messages: [new HumanMessage({ content: human.content })],
        ...(hasRunArtifacts ? {} : { files: skillFilesToInvokePayload(skillFiles) }),
      })
    },
    [runInvoke, skillFiles],
  )

  const markOutlineGateResolved = useCallback(() => {
    outlineGateResolvedRef.current = true
  }, [])

  return useMemo(
    () => ({
      messages,
      values: { todos, files },
      interrupt,
      isLoading,
      error,
      htmlPreview,
      awaitingUser,
      markOutlineGateResolved,
      resetSession,
      submit,
      stop,
      hasPersistedSession,
      restorePersistedSession,
    }),
    [
      messages,
      todos,
      files,
      interrupt,
      isLoading,
      error,
      htmlPreview,
      awaitingUser,
      markOutlineGateResolved,
      resetSession,
      submit,
      stop,
      hasPersistedSession,
      restorePersistedSession,
    ],
  )
}

export function readInterrupt(stream: BrowserAgentStream | null) {
  return readInterruptPort(stream)
}

export function respondInterrupt(stream: BrowserAgentStream, message: string) {
  const intr = readInterrupt(stream)
  if (!intr) return Promise.resolve()
  if (intr.name === 'confirm_outline') {
    stream.markOutlineGateResolved?.()
  }
  const raw = stream.interrupt as { value?: { __synthetic?: boolean } } | null
  if (raw?.value?.__synthetic) {
    const approved = message === '__approve' || message === 'OK' || message === ''
    const content = approved
      ? '大纲已确认。请继续：写 slide_plan.json → 调用 choose_template → 调用 choose_render_mode → build_slides_html。各交互点必须用工具，不要用文字问用户。'
      : `请按以下意见修改大纲后继续：${message}`
    return stream.submit({ messages: [{ type: 'human', content }] })
  }
  const name = intr.name
  let decision: { type: 'approve' | 'edit' | 'reject'; editedAction?: unknown; message?: string }
  if (message === '__approve' || message === 'OK' || message === '') {
    decision = { type: 'approve' }
  } else if (name === 'choose_template') {
    decision = {
      type: 'edit',
      editedAction: { name, args: { ...intr.args, recommended: [message] } },
    }
  } else if (name === 'choose_render_mode') {
    decision = {
      type: 'edit',
      editedAction: { name, args: { ...intr.args, mode: message } },
    }
  } else if (name === 'confirm_outline') {
    decision = { type: 'edit', editedAction: { name, args: { ...intr.args, outline_md: message } } }
  } else {
    decision = { type: 'reject', message }
  }
  return stream.submit(null, {
    command: { resume: { decisions: [decision] } },
  })
}

export function startRun(
  stream: BrowserAgentStream,
  topic: string,
  opts: StartRunOpts = {},
) {
  try {
    localStorage.setItem(ACTIVE_TOPIC_KEY, topic)
  } catch {
    /* ignore */
  }
  return stream.submit({
    messages: [{ type: 'human', content: composeBrief(topic, opts) }],
  })
}

/** 副驾聊天续跑：有 HITL 中断时走 respondInterrupt，否则追加 human 消息 */
export function sendChatMessage(stream: BrowserAgentStream, text: string) {
  const msg = String(text || '').trim()
  if (!msg) return Promise.resolve()
  if (stream.isLoading) return Promise.resolve()
  const intr = readInterrupt(stream)
  if (intr) return respondInterrupt(stream, msg)
  return stream.submit({ messages: [{ type: 'human', content: msg }] })
}

export {
  findOutputPath,
  findRunSlug,
  findPageCount,
  runFinished,
  planFinished,
} from '@jumpx/ports'

export function findRunId(stream: BrowserAgentStream | null) {
  const p = findOutputPath(stream)
  if (!p) return null
  const m = p.match(/runs\/([^/]+)\/index\.html/)
  return m ? m[1] : null
}

export function findLastBuildError(stream: BrowserAgentStream | null): string | null {
  const msgs = stream?.messages || []
  for (const m of [...msgs].reverse()) {
    const msg = m as { type?: string; name?: string; content?: unknown }
    const c = typeof msg.content === 'string' ? msg.content : ''
    if (!c) continue
    if (msg.name === 'build_slides_html' && (c.startsWith('error:') || c.includes('渲染失败'))) {
      return c
    }
    if (c.includes('error: 缺少') && c.includes('slide_plan')) return c
  }
  return stream?.error || null
}
