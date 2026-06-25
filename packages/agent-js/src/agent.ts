import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { MemorySaver, type BaseCheckpointSaver } from '@langchain/langgraph'
import { createDeepAgent, StateBackend } from 'deepagents/browser'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { SYSTEM_PROMPT } from './prompt.js'
import { createSlideTools, type SlideToolsDeps } from './tools.js'
import type { LlmConfig } from './providers.js'
import { resolveProvider } from './providers.js'
import { ensureBrowserAsyncLocalStorage } from './browserAls.js'
import type { SkillFileData } from '@jumpx/forge-assets'

export type BuildAgentOptions = SlideToolsDeps & {
  llmConfig: LlmConfig
  skillFiles?: Record<string, SkillFileData>
  checkpointer?: BaseCheckpointSaver
  skillsMount?: string
}

export function buildChatModel(cfg: LlmConfig): BaseChatModel {
  const provider = resolveProvider(cfg)
  const baseURL = cfg.baseURL ? cfg.baseURL.replace(/\/$/, '') : undefined

  if (provider === 'anthropic') {
    const options: ConstructorParameters<typeof ChatAnthropic>[0] = {
      model: cfg.model,
      apiKey: cfg.apiKey,
      temperature: 0,
      maxTokens: cfg.maxTokens ?? 8192,
      streaming: true,
      clientOptions: { dangerouslyAllowBrowser: true },
    }
    if (baseURL) {
      options.anthropicApiUrl = baseURL.replace(/\/v1$/, '')
    }
    return new ChatAnthropic(options)
  }

  return new ChatOpenAI({
    model: cfg.model,
    apiKey: cfg.apiKey,
    temperature: 0,
    maxTokens: cfg.maxTokens ?? 8192,
    streaming: true,
    configuration: {
      ...(baseURL ? { baseURL } : {}),
      dangerouslyAllowBrowser: true,
    },
  })
}

export function buildSlidesAgent(opts: BuildAgentOptions) {
  ensureBrowserAsyncLocalStorage()
  const tools = createSlideTools(opts)
  const checkpointer = opts.checkpointer ?? new MemorySaver()

  return createDeepAgent({
    model: buildChatModel(opts.llmConfig),
    tools,
    systemPrompt: SYSTEM_PROMPT,
    skills: [opts.skillsMount || '/skills/ai-slide-producer'],
    backend: (runtime) => new StateBackend(runtime),
    checkpointer,
    interruptOn: {
      choose_template: {
        allowedDecisions: ['approve', 'edit'],
        description: '选一套视觉模板',
      },
      confirm_outline: {
        allowedDecisions: ['approve', 'edit', 'reject'],
        description: '确认大纲',
      },
      choose_render_mode: {
        allowedDecisions: ['approve', 'edit'],
        description: '选输出形态（HTML / 图片）',
      },
    },
  })
}

export function skillFilesToInvokePayload(
  skillFiles: Record<string, SkillFileData>,
): Record<string, SkillFileData> {
  return { ...skillFiles }
}
