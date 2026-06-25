export { buildSlidesAgent, buildChatModel, skillFilesToInvokePayload } from './agent.js'
export { SYSTEM_PROMPT } from './prompt.js'
export { createSlideTools } from './tools.js'
export { renderDeckHtml } from './aiRender.js'
export {
  loadLlmConfig,
  saveLlmConfig,
  llmConfigReady,
  resolveProvider,
  LLM_TEXT_DEFAULTS,
  type LlmConfig,
  type LlmProvider,
} from './providers.js'
export { testLlmConnection } from './llm/testConnection.js'
export { loadImageCfg, saveImageCfg, IMAGE_DEFAULTS, type ImageProviderCfg } from './imageConfig.js'
export { generateImageInBrowser, pngBytesToFileContent, type GenerateImageResult } from './generateImage.js'
export {
  useBrowserAgent,
  readInterrupt,
  respondInterrupt,
  sendChatMessage,
  startRun,
  findOutputPath,
  findRunSlug,
  findRunId,
  findPageCount,
  runFinished,
  planFinished,
  findLastBuildError,
  type BrowserAgentStream,
} from './useBrowserAgent.js'
export { activityFromMessages, tasksFromTodos } from '@jumpx/ports'
