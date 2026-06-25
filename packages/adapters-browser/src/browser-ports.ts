import type { AgentStream, AppPorts, ExportFormat, PresetMeta } from '@jumpx/ports'
import {
  findOutputPath,
  findRunSlug,
  parseSlidePlanFromFiles,
} from '@jumpx/ports'
import { loadLlmConfig, saveLlmConfig, llmConfigReady, loadImageCfg, saveImageCfg, generateImageInBrowser, testLlmConnection } from '@jumpx/agent-js'
import presetsCatalog from '@jumpx/ui-assets/presets.json'
import { MOCK_STYLES } from './mock-data.js'
import {
  buildForgeSkillOverview,
  exportForgeSkillZip,
  readForgeReference,
} from './skill/docs.js'
import { extractMaterialText } from './materials/extractMaterial.js'
import {
  exportRecipeZip,
  forkRecipe,
  getRecipeDetail,
  importRecipeZip,
  listRecipeManifests,
  saveRecipe,
  setActiveRecipeId,
} from './recipe/store.js'
import {
  getStoredRun,
  listStoredRuns,
  saveRunSnapshot,
  type RunSnapshot,
} from './run/store.js'

function htmlFromStream(stream: AgentStream | null | undefined, slug: string): string | null {
  if (stream?.htmlPreview) return stream.htmlPreview
  const files = stream?.values?.files || {}
  const key = findOutputPath(stream) || `/runs/${slug}/index.html`
  const fd = files[key]
  if (typeof fd?.content === 'string') return fd.content
  return null
}

export function createBrowserPorts(): AppPorts {
  const run = {
    getRunSlug(stream: AgentStream | null) {
      return findRunSlug(stream)
    },
    async list() {
      return listStoredRuns()
    },
    async getStored(id: string) {
      return getStoredRun(id)
    },
    async saveSnapshot(snapshot: RunSnapshot) {
      await saveRunSnapshot(snapshot)
    },
    async getPlan(slug: string, stream?: AgentStream | null) {
      const files = stream?.values?.files || {}
      const fromFiles = parseSlidePlanFromFiles(files)
      if (fromFiles) return fromFiles
      const planKey = Object.keys(files).find(
        (k) => k.includes(slug) && k.endsWith('slide_plan.json'),
      )
      if (planKey) {
        return parseSlidePlanFromFiles({ [planKey]: files[planKey] })
      }
      const stored = await getStoredRun(slug)
      if (stored?.plan) return stored.plan
      return null
    },
    async getPreviewUrl(slug: string, stream?: AgentStream | null) {
      let html = htmlFromStream(stream, slug)
      if (!html) {
        const stored = await getStoredRun(slug)
        html = stored?.html ?? null
      }
      if (!html) return null
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      return URL.createObjectURL(blob)
    },
    async downloadHtml(slug: string, stream?: AgentStream | null, filename?: string) {
      let html = htmlFromStream(stream, slug)
      if (!html) {
        const stored = await getStoredRun(slug)
        html = stored?.html ?? null
      }
      if (!html) throw new Error('尚未生成 HTML')
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `${slug}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    },
  }

  const presets = {
    async list(): Promise<PresetMeta[]> {
      return (presetsCatalog.presets || []) as PresetMeta[]
    },
  }

  const settings = {
    async get() {
      const text = loadLlmConfig()
      const image = loadImageCfg()
      return {
        text: {
          provider: text.provider || 'auto',
          base_url: text.baseURL || '',
          model: text.model || '',
          api_key_set: Boolean(text.apiKey?.trim()),
        },
        image: {
          provider: image.provider || 'none',
          base_url: image.base_url || '',
          model: image.model || '',
          api_key_set: Boolean(image.api_key?.trim()),
        },
        tenancy: 'local' as const,
      }
    },
    async save(partial: Parameters<AppPorts['settings']['save']>[0]) {
      if (partial.text) {
        saveLlmConfig({
          apiKey: partial.text.api_key,
          baseURL: partial.text.base_url,
          model: partial.text.model,
          provider: partial.text.provider as 'openai' | 'anthropic' | 'auto' | undefined,
        })
      }
      if (partial.image) {
        saveImageCfg({
          provider: partial.image.provider,
          base_url: partial.image.base_url,
          model: partial.image.model,
          api_key: partial.image.api_key,
        })
      }
      return settings.get()
    },
    async test(body: {
      kind: 'text' | 'image'
      provider: string
      api_key: string
      base_url?: string
      model?: string
    }) {
      if (!body.api_key?.trim()) {
        return { ok: false, message: '请填写 API Key' }
      }
      if (body.kind === 'image') {
        if (body.provider === 'mock') {
          return { ok: true, message: 'mock 占位图无需 key' }
        }
        const prev = loadImageCfg()
        saveImageCfg({
          provider: body.provider,
          api_key: body.api_key,
          base_url: body.base_url || '',
          model: body.model || '',
        })
        const r = await generateImageInBrowser(
          'JumpX connectivity test',
          'runs/__test__/images/probe.png',
        )
        saveImageCfg(prev)
        return { ok: r.ok, message: r.ok ? '图片 · ' + r.message : r.message }
      }
      if (body.kind === 'text') {
        const r = await testLlmConnection({
          apiKey: body.api_key,
          baseURL: body.base_url,
          model: body.model || '',
          provider: body.provider as 'openai' | 'anthropic' | 'auto' | undefined,
        })
        return { ok: r.ok, message: r.message }
      }
    },
  }

  const recipes = {
    list: listRecipeManifests,
    get: getRecipeDetail,
    save: saveRecipe,
    fork: forkRecipe,
    setActive: setActiveRecipeId,
    importZip: importRecipeZip,
    exportZip: exportRecipeZip,
  }

  const materials = {
    extractText: extractMaterialText,
  }

  const importedStyles: typeof MOCK_STYLES[number][] = []

  const styles = {
    async list() {
      const all = [...MOCK_STYLES, ...importedStyles]
      return {
        styles: all.map((s) => ({
          id: s.style_name,
          name: s.display_name,
          label: s.display_name,
          ...s,
        })),
      }
    },
    async importFromImages(
      _images: { dataUrl: string }[],
      label: string,
    ) {
      const style = {
        style_name: `imported-${Date.now().toString(36).slice(-5)}`,
        display_name: label || '导入风格',
        mood: '从参考图识别（Lite mock）',
        background_color: '#f5f5f0',
        primary_color: '#333333',
        accent_color: '#c45c26',
        imported: true,
      }
      importedStyles.push(style)
      return { ok: true, style: { id: style.style_name, name: style.display_name, ...style } }
    },
  }

  const exportPort = {
    supported(): ExportFormat[] {
      return ['html', 'pdf', 'pptx', 'png']
    },
    async exportRun(slug: string, format: ExportFormat, stream?: AgentStream | null) {
      if (format !== 'html') {
        throw new Error(
          `${format.toUpperCase()} 导出需 Studio 后端渲染。Lite 请下载 HTML 后浏览器「打印 → 另存为 PDF」。`,
        )
      }
      const html = htmlFromStream(stream, slug)
      if (!html) throw new Error('尚未生成 HTML')
      return new Blob([html], { type: 'text/html;charset=utf-8' })
    },
  }

  const skill = {
    async overview() {
      return buildForgeSkillOverview()
    },
    async readReference(name: string) {
      return readForgeReference(name) || `# ${name}\n\n（文件不在 Lite 内置 skill 包中）`
    },
    async exportZip() {
      return exportForgeSkillZip()
    },
  }

  return { run, presets, settings, recipes, materials, styles, export: exportPort, skill }
}

/** 是否已配置 LLM（供 Lite 启动门禁） */
export function browserLlmReady(): boolean {
  return llmConfigReady(loadLlmConfig())
}
