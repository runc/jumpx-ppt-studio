export type LlmProvider = 'openai' | 'anthropic' | 'auto'

export type LlmConfig = {
  apiKey: string
  baseURL?: string
  model: string
  maxTokens?: number
  provider?: LlmProvider
}

const STORAGE_KEY = 'jumpx-lite-llm'

/** 文本模型未配置时的占位 / 首次默认值（DeepSeek · Anthropic 兼容） */
export const LLM_TEXT_DEFAULTS = {
  baseURL: 'https://api.deepseek.com/anthropic',
  model: 'deepseek',
} as const

const DEFAULTS: LlmConfig = {
  apiKey: '',
  baseURL: LLM_TEXT_DEFAULTS.baseURL,
  model: LLM_TEXT_DEFAULTS.model,
  maxTokens: 24000,
  provider: 'auto',
}

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveLlmConfig(cfg: Partial<LlmConfig>) {
  const next = { ...loadLlmConfig(), ...cfg }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function llmConfigReady(cfg: LlmConfig): boolean {
  return Boolean(cfg.apiKey?.trim() && cfg.model?.trim())
}

/**
 * 推断 provider：
 * - 显式配置优先
 * - 'auto' 模式按 baseURL / model 推断：
 *   - baseURL 含 anthropic → 'anthropic'
 *   - baseURL 含 claude / opencode / claude-code-proxy → 'anthropic'
 *   - model 以 claude- 开头 → 'anthropic'
 *   - 其它 → 'openai'
 */
export function resolveProvider(cfg: LlmConfig): 'openai' | 'anthropic' {
  const explicit = cfg.provider
  if (explicit === 'anthropic') return 'anthropic'
  if (explicit === 'openai') return 'openai'
  const base = (cfg.baseURL || '').toLowerCase()
  const model = (cfg.model || '').toLowerCase()
  if (base.includes('anthropic') || base.includes('claude')) return 'anthropic'
  if (model.startsWith('claude')) return 'anthropic'
  return 'openai'
}
