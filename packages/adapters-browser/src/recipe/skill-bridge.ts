import type { SkillFileData } from '@jumpx/forge-assets'
import { createFileData } from '@jumpx/forge-assets'
import type { RecipeManifest } from '@jumpx/ports'
import { BG_TEMPLATE, CONTRACT_VERSION, EDITABLE, META_FIELDS } from './constants.js'
import { RECIPES_FALLBACK } from '../mock-data.js'

export type RecipeRecord = {
  id: string
  manifest: RecipeManifest
  files: Record<string, string>
}

export function skillFilesToRelativeMap(
  skillFiles: Record<string, SkillFileData>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [vpath, fd] of Object.entries(skillFiles)) {
    const m =
      vpath.match(/\/skills\/ai-slide-producer\/(.+)$/) ||
      vpath.match(/\/recipes\/[^/]+\/(.+)$/)
    if (!m || typeof fd.content !== 'string') continue
    out[m[1]] = fd.content
  }
  return out
}

export function recipeToSkillFiles(
  id: string,
  files: Record<string, string>,
): Record<string, SkillFileData> {
  const out: Record<string, SkillFileData> = {}
  for (const [rel, content] of Object.entries(files)) {
    const vpath = `/recipes/${id}/${rel}`
    const mime = rel.endsWith('.json') ? 'application/json' : 'text/markdown'
    out[vpath] = createFileData(content, mime)
  }
  return out
}

export function activeSkillMount(id: string): string {
  return `/recipes/${id}`
}

function cloneFiles(files: Record<string, string>): Record<string, string> {
  return { ...files }
}

function ensureBackground(files: Record<string, string>) {
  if (!files['references/background.md']?.trim()) {
    files['references/background.md'] = BG_TEMPLATE
  }
}

function uniqueId(base: string, taken: Set<string>): string {
  let slug = base.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'recipe'
  let id = slug
  let n = 2
  while (taken.has(id)) {
    id = `${slug}-${n++}`
  }
  return id
}

/** 从 forge 基座 + RECIPES_FALLBACK 种子生成内置配方 */
export function buildSeedRecipes(
  baseSkillFiles: Record<string, SkillFileData>,
): RecipeRecord[] {
  const base = cloneFiles(skillFilesToRelativeMap(baseSkillFiles))
  ensureBackground(base)

  const seeds: RecipeRecord[] = [
    {
      id: 'default',
      manifest: {
        id: 'default',
        name: 'ai-slide-producer · 内置',
        version: '1',
        author: 'builtin',
        contract_version: CONTRACT_VERSION,
        editable: [...EDITABLE],
        density: 1,
        persona: '懂通用清单与图表 · 写得干练清晰 · 厚薄适中',
        domain: ['清单', '图表', '概念'],
        voice: '干练清晰',
        tag: '内置 · 推荐',
        narrative: '默认弧',
        absorb: ['忠实原文'],
      },
      files: base,
    },
  ]

  const overrides: Record<string, Partial<Record<(typeof EDITABLE)[number], string>>> = {
    invest: {
      'references/background.md':
        '# 投资复盘领域\n\n- 北极星指标、AARRR\n- STAR 复盘框架\n',
      'references/05-writer.md': '# 结论先行\n\n- 先抛结论再展开\n',
      'references/03-strategist.md': '# 先抛结论\n\nHook → 结论 → 论据 → 行动\n',
    },
    teach: {
      'references/background.md': '# 教学领域\n\n- 概念拆解与类比\n',
      'references/05-writer.md': '# 循循善诱\n\n- 举例 + 练习\n',
      'references/03-strategist.md': '# 教学递进\n\n问题 → 概念 → 方法 → 练习\n',
    },
    song: {
      'references/background.md': '# 宋代美学\n\n- 汝窑、点茶、文人审美\n',
      'references/05-writer.md': '# 故事化叙事\n',
    },
  }

  for (const fb of RECIPES_FALLBACK) {
    if (fb.id === 'plain') continue
    const files = cloneFiles(base)
    const ov = overrides[fb.id]
    if (ov) {
      for (const [k, v] of Object.entries(ov)) {
        if (v) files[k] = v
      }
    }
    ensureBackground(files)
    seeds.push({
      id: fb.id,
      manifest: {
        id: fb.id,
        name: fb.name,
        version: '1',
        author: 'builtin',
        contract_version: CONTRACT_VERSION,
        editable: [...EDITABLE],
        density: fb.densityIdx,
        persona: fb.persona,
        domain: [...fb.domain],
        voice: fb.voice,
        tag: fb.tag,
        narrative:
          fb.id === 'invest' ? '先抛结论' : fb.id === 'teach' ? '教学递进' : '故事化',
        absorb: fb.id === 'invest' ? ['数据优先'] : ['忠实原文'],
      },
      files,
    })
  }

  return seeds
}

export function mergeManifestMeta(
  manifest: RecipeManifest,
  partial: { name?: string; density?: number; narrative?: string; voice?: string; absorb?: string[] },
): RecipeManifest {
  const next = { ...manifest }
  for (const k of META_FIELDS) {
    const v = (partial as Record<string, unknown>)[k]
    if (v !== undefined) (next as Record<string, unknown>)[k] = v
  }
  return next
}

export { uniqueId, ensureBackground, cloneFiles }
