/** 消费 LangGraph agent.stream（values + messages），统一首轮与 resume。 */

type StreamAgent = {
  stream: (
    input: unknown,
    config: Record<string, unknown>,
  ) => Promise<AsyncIterable<unknown>>
}

export type ConsumeStreamConfig = Record<string, unknown> & {
  signal?: AbortSignal
}

export type StreamHandlers = {
  onValues: (state: Record<string, unknown>) => void
  onMessages?: (data: unknown) => void
}

function asState(data: unknown): Record<string, unknown> | null {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return null
}

export async function consumeAgentStream(
  agent: StreamAgent,
  payload: unknown,
  config: ConsumeStreamConfig,
  handlers: StreamHandlers,
): Promise<Record<string, unknown>> {
  let latest: Record<string, unknown> = {}
  const { signal, ...restConfig } = config
  const stream = await agent.stream(payload, {
    ...restConfig,
    streamMode: ['values', 'messages'],
  })

  for await (const item of stream) {
    if (signal?.aborted) break
    if (!Array.isArray(item)) {
      const state = asState(item)
      if (state) {
        latest = state
        handlers.onValues(state)
      }
      continue
    }

    if (item.length === 2 && typeof item[0] === 'string') {
      const [mode, data] = item as [string, unknown]
      if (mode === 'values') {
        const state = asState(data)
        if (state) {
          latest = state
          handlers.onValues(state)
        }
      } else if (mode === 'messages') {
        handlers.onMessages?.(data)
      }
      continue
    }

    if (item.length === 3 && typeof item[1] === 'string') {
      const mode = item[1] as string
      const data = item[2]
      if (mode === 'values') {
        const state = asState(data)
        if (state) {
          latest = state
          handlers.onValues(state)
        }
      } else if (mode === 'messages') {
        handlers.onMessages?.(data)
      }
    }
  }

  return latest
}
