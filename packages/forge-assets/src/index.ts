/**
 * 把 forge-assets 目录打成 deepagents StateBackend 所需的 files 映射。
 * 路径虚拟根：/skills/ai-slide-producer/...
 */
export type SkillFileData = {
  content: string
  mimeType?: string
  created_at: string
  modified_at: string
}

export function createFileData(content: string, mimeType = 'text/plain'): SkillFileData {
  const now = new Date().toISOString()
  return { content, mimeType, created_at: now, modified_at: now }
}

/** Vite import.meta.glob 产物 → agent invoke files */
export function skillGlobToFiles(
  modules: Record<string, string>,
  baseDirMarker = '/ai-slide-producer/',
): Record<string, SkillFileData> {
  const out: Record<string, SkillFileData> = {}
  for (const [key, content] of Object.entries(modules)) {
    const idx = key.indexOf(baseDirMarker)
    if (idx < 0) continue
    const rel = key.slice(idx + baseDirMarker.length)
    const vpath = `/skills/ai-slide-producer/${rel}`
    const mime = rel.endsWith('.json') ? 'application/json' : 'text/markdown'
    out[vpath] = createFileData(content, mime)
  }
  return out
}

export const SKILL_MOUNT = '/skills/ai-slide-producer'
