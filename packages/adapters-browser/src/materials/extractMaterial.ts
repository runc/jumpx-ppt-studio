import { truncateMaterial, type ExtractResult } from './constants.js'
import { parseDocxFile } from './parseDocx.js'
import { parsePdfFile } from './parsePdf.js'

const UNSUPPORTED_HINT =
  'Lite 暂不支持该格式，请转为 PDF 或粘贴文本（pptx/xlsx 等）'

export async function extractMaterialText(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')) {
    const text = await file.text()
    return truncateMaterial(text)
  }

  if (name.endsWith('.pdf')) {
    return parsePdfFile(file)
  }

  if (name.endsWith('.docx')) {
    return parseDocxFile(file)
  }

  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const raw = await file.text()
    const stripped = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!stripped) {
      return { text: '', chars: 0, truncated: false, error: 'HTML 中未找到可读文本' }
    }
    return truncateMaterial(stripped)
  }

  if (name.endsWith('.csv')) {
    return truncateMaterial(await file.text())
  }

  const ext = name.split('.').pop() || 'unknown'
  return { text: '', chars: 0, truncated: false, error: `${UNSUPPORTED_HINT}（.${ext}）` }
}
