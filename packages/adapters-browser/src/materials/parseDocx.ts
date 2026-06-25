import mammoth from 'mammoth'
import { truncateMaterial, type ExtractResult } from './constants.js'

export async function parseDocxFile(file: File): Promise<ExtractResult> {
  try {
    const buf = await file.arrayBuffer()
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
    const text = (value || '').trim()
    if (!text) {
      return { text: '', chars: 0, truncated: false, error: '未能从 Word 文档抽出文本' }
    }
    return truncateMaterial(text)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { text: '', chars: 0, truncated: false, error: `Word 解析失败：${msg}` }
  }
}
