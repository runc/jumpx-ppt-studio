import {
  FORGE_SKILL_FILES,
  readForgeSkillText,
} from '@jumpx/forge-assets/skillBundle'
import skillRefMeta from '@jumpx/forge-assets/skill-ref.json'
import JSZip from 'jszip'

const REF_ORDER: [string, string][] = [
  ['references/01-intake-brief.md', '意图澄清'],
  ['references/02-context-pack.md', '资料吸收'],
  ['references/03-strategist.md', '叙事策略'],
  ['references/04-researcher.md', '事实补充'],
  ['references/05-writer.md', '逐页写作'],
  ['references/06-reviewer.md', '叙事审核'],
  ['references/07-designer.md', '视觉设计'],
  ['references/08-web-renderer.md', 'HTML 渲染'],
  ['references/09-image-renderer.md', '图片渲染'],
  ['references/10-style-guard.md', '风格守卫'],
  ['references/11-producer.md', '交付制片'],
  ['references/12-style-presets.md', '风格预设'],
  ['references/14-quality-checklist.md', '质量清单'],
  ['references/15-export-contract.md', '导出契约'],
  ['references/background.md', '背景知识'],
]

function frontmatterDescription(skillMd: string): string {
  const m = skillMd.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) return ''
  const block = m[1]
  const dm = block.match(/description:\s*>?\s*\n?([\s\S]*?)(?:\n\w+:|\Z)/)
  if (dm) return dm[1].replace(/\s+/g, ' ').trim()
  return ''
}

function firstHeading(md: string): string {
  for (const line of md.split('\n')) {
    if (line.startsWith('# ')) return line.slice(2).trim()
  }
  return ''
}

let cachedRef: { ref: string; syncedAt?: string } | null = null

function skillRef(): { ref: string; syncedAt?: string } {
  if (!cachedRef) {
    cachedRef = {
      ref: (skillRefMeta as { ref?: string }).ref || 'v1.1.0',
      syncedAt: (skillRefMeta as { syncedAt?: string }).syncedAt,
    }
  }
  return cachedRef
}

export async function buildForgeSkillOverview() {
  const skillMd = readForgeSkillText('SKILL.md') || ''
  const meta = skillRef()
  const refs = REF_ORDER.flatMap(([file, label]) => {
    const text = readForgeSkillText(file)
    if (!text) return []
    return [{ file: file.replace(/^references\//, ''), label, title: firstHeading(text), bytes: text.length }]
  })
  const stylePresets = Object.keys(FORGE_SKILL_FILES)
    .filter((k) => k.includes('/assets/style-presets/') && k.endsWith('.json'))
    .map((k) => k.split('/').pop()?.replace('.json', '') || '')
    .filter(Boolean)
    .sort()

  return {
    name: 'ai-slide-producer',
    version: meta.ref.replace(/^v/, ''),
    skill_ref: meta.ref,
    synced_at: meta.syncedAt,
    description:
      frontmatterDescription(skillMd) ||
      '厚内容 + 模型自由设计版式的幻灯 skill。九步管线、人在环门禁、HTML 直写渲染。',
    pipeline:
      'Intake → Context Pack → Outline → Slide Plan → Narrative Review → Design Spec → Render → Quality Check → Delivery',
    references: refs,
    style_presets: stylePresets,
    download_note: '与 Lite 内置 skill 同一份（pnpm sync:skill）',
  }
}

export function readForgeReference(name: string): string | null {
  const safe = name.replace(/^references\//, '')
  if (!/^[A-Za-z0-9_-]+\.md$/.test(safe)) return null
  return readForgeSkillText(`references/${safe}`)
}

export async function exportForgeSkillZip(): Promise<Blob> {
  const zip = new JSZip()
  for (const [vpath, fd] of Object.entries(FORGE_SKILL_FILES)) {
    const rel = vpath.replace(/^\/skills\/ai-slide-producer\/?/, '')
    if (!rel || !fd.content) continue
    zip.file(rel, typeof fd.content === 'string' ? fd.content : String(fd.content))
  }
  return zip.generateAsync({ type: 'blob' })
}

export { FORGE_SKILL_FILES }
