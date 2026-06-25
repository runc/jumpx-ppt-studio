import { tool } from 'langchain'
import { z } from 'zod'
import { renderDeckHtml } from './aiRender.js'
import { generateImageInBrowser, pngBytesToFileContent } from './generateImage.js'
import type { LlmConfig } from './providers.js'

export type SlideToolsDeps = {
  getFiles: () => Record<string, { content?: string | string[] }>
  getLlmConfig: () => LlmConfig
  onHtmlRendered: (project: string, html: string) => void
  onFileWritten?: (path: string, content: string) => void
}

type ToolStateConfig = {
  state?: { files?: Record<string, { content?: string | string[] | Uint8Array }> }
}

/** 合并 deps 缓存与 invoke 进行中的 graph state.files（write_file 尚未回灌到 React 时） */
export function resolveToolFiles(
  depsFiles: Record<string, { content?: string | string[] }>,
  stateFiles?: Record<string, { content?: string | string[] | Uint8Array }>,
): Record<string, { content?: string | string[] }> {
  const merged = { ...depsFiles }
  if (!stateFiles) return merged
  for (const [path, fd] of Object.entries(stateFiles)) {
    if (!fd?.content) continue
    if (Array.isArray(fd.content)) merged[path] = { content: fd.content }
    else if (typeof fd.content === 'string') merged[path] = { content: fd.content }
  }
  return merged
}

export function createSlideTools(deps: SlideToolsDeps) {
  const chooseTemplate = tool(
    async ({ recommended }: { recommended: string[]; note?: string }) => {
      return recommended[0] || 'teaching-clean'
    },
    {
      name: 'choose_template',
      description: `交互点①：请用户从 7 套视觉模板（style preset）中选 1 套。
在「选模板」决策点调用（生成 design spec / style_lock 之前）。
recommended：你推荐的 2-3 个 preset id（teaching-clean, editorial-magazine, swiss-system, blueprint, sketch-notes, corporate, creator-social）。
note：给用户的一句话说明。
（用户在 HITL 弹层里 approve=接受 recommended[0]，或 edit 改成其它 preset id。）
返回用户选定的 preset id（字符串）。`,
      schema: z.object({
        recommended: z.array(z.string()),
        note: z.string().optional().default(''),
      }),
    },
  )

  const confirmOutline = tool(
    async ({ outline_md }: { outline_md: string; note?: string }) => {
      return `OK：\n${outline_md.slice(0, 200)}${outline_md.length > 200 ? '…' : ''}`
    },
    {
      name: 'confirm_outline',
      description: `交互点：把生成的大纲交给用户确认 / 修改（大纲门禁）。
在写好 runs/<project>/source/outline.md 之后、进入 slide_plan 之前调用。
outline_md：大纲全文。note：给用户的一句话。
（用户在 HITL 弹层里 approve=放行，edit=改 outline_md 后再放行，reject=回退意见。）
返回用户的确认或修改意见。`,
      schema: z.object({
        outline_md: z.string(),
        note: z.string().optional().default(''),
      }),
    },
  )

  const chooseRenderMode = tool(
    async ({ mode }: { mode: 'html' | 'image'; note?: string }) => mode,
    {
      name: 'choose_render_mode',
      description: `交互点②：请用户选择输出形态——HTML 幻灯片 还是 生成图片。
在「出图 / HTML」决策点调用。mode：'html' 或 'image'，默认 'html'。note：给用户的一句话说明。
（用户在 HITL 弹层里 approve=接受当前 mode，edit=改成另一种 mode。）
返回 mode 字符串。`,
      schema: z.object({
        mode: z.enum(['html', 'image']).default('html'),
        note: z.string().optional().default(''),
      }),
    },
  )

  const buildSlidesHtml = tool(
    async (
      { project }: { project: string },
      _runManager?: unknown,
      config?: ToolStateConfig,
    ) => {
      const files = resolveToolFiles(deps.getFiles(), config?.state?.files)
      const cfg = deps.getLlmConfig()
      if (!cfg.apiKey) {
        return 'error: 未配置 LLM API Key（请在设置中填写）'
      }
      const planPath = `/runs/${project}/source/slide_plan.json`
      const lockPath = `/runs/${project}/source/style_lock.json`
      if (!files[planPath]) {
        return `error: 缺少 ${planPath} —— 请先用 write_file 写好。`
      }
      if (!files[lockPath]) {
        return `error: 缺少 ${lockPath} —— 请先用 write_file 写好。`
      }
      try {
        const { html, note } = await renderDeckHtml(files, project, cfg)
        if (!html) return `error: AI 渲染失败：${note}`
        const outPath = `/runs/${project}/index.html`
        deps.onHtmlRendered(project, html)
        return (
          `已生成幻灯片：${outPath}（${note}）\n` +
          `（这是可见产物，请把该路径交给用户。）`
        )
      } catch (e) {
        return `error: AI 渲染异常：${e}`
      }
    },
    {
      name: 'build_slides_html',
      description: `生成可直接打开的自包含 index.html 幻灯片（模型按 style_lock 直接写 HTML）。
读取 runs/<project>/source/slide_plan.json 与 style_lock.json。
project：runs/ 下的工程目录名（slug）。返回生成的 HTML 路径。`,
      schema: z.object({
        project: z.string(),
        minimal: z.boolean().optional().default(false),
      }),
    },
  )

  const generateImage = tool(
    async ({ prompt, out_path }: { prompt: string; out_path: string }) => {
      const result = await generateImageInBrowser(prompt, out_path)
      if (!result.ok) return result.message
      if (deps.onFileWritten) {
        deps.onFileWritten(result.path, pngBytesToFileContent(result.bytes))
      }
      return result.message
    },
    {
      name: 'generate_image',
      description: `web 层出图能力。prompt：完整出图 prompt；out_path：保存路径。
未配置或失败时返回 image-backend-unavailable，应回退 HTML 渲染。`,
      schema: z.object({
        prompt: z.string(),
        out_path: z.string(),
      }),
    },
  )

  return [confirmOutline, chooseTemplate, chooseRenderMode, buildSlidesHtml, generateImage]
}
