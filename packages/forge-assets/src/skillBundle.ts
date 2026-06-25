import { skillGlobToFiles, type SkillFileData } from './index.js'

const modules = import.meta.glob(
  '../ai-slide-producer/**/*.{md,json}',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

/** Vite 打包时从 sync:skill 目录注入的 skill 文件树 */
export const FORGE_SKILL_FILES: Record<string, SkillFileData> = skillGlobToFiles(modules)

export function forgeSkillPath(rel: string): string {
  const clean = rel.replace(/^\/+/, '').replace(/^skills\/ai-slide-producer\/?/, '')
  return `/skills/ai-slide-producer/${clean}`
}

export function readForgeSkillText(rel: string): string | null {
  const key = forgeSkillPath(rel)
  const fd = FORGE_SKILL_FILES[key]
  if (!fd?.content) return null
  return typeof fd.content === 'string' ? fd.content : null
}
