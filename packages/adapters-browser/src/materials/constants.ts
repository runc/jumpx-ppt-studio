/** 与 Studio `backend/recipe_api.py` MAX_MATERIAL 对齐 */
export const MAX_MATERIAL_CHARS = 20000

export type ExtractResult = {
  text: string
  chars: number
  truncated: boolean
  error?: string
}

export function truncateMaterial(text: string): ExtractResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { text: '', chars: 0, truncated: false, error: '未能从文件抽出文本' }
  }
  const truncated = trimmed.length > MAX_MATERIAL_CHARS
  return {
    text: trimmed.slice(0, MAX_MATERIAL_CHARS),
    chars: trimmed.length,
    truncated,
  }
}
