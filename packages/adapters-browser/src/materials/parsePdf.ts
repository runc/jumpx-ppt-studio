import * as pdfjs from 'pdfjs-dist'
import { truncateMaterial, type ExtractResult } from './constants.js'

let workerReady = false

function ensurePdfWorker() {
  if (workerReady) return
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href
  workerReady = true
}

export async function parsePdfFile(file: File): Promise<ExtractResult> {
  ensurePdfWorker()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true })
  try {
    const doc = await loadingTask.promise
    const parts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const line = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (line) parts.push(line)
      page.cleanup?.()
    }
    const joined = parts.join('\n\n').trim()
    if (!joined) {
      return {
        text: '',
        chars: 0,
        truncated: false,
        error: '未能从 PDF 抽出文本（可能是扫描件/纯图片，暂不支持 OCR）',
      }
    }
    return truncateMaterial(joined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/password|encrypted/i.test(msg)) {
      return { text: '', chars: 0, truncated: false, error: 'PDF 已加密，请先解密后再上传' }
    }
    return { text: '', chars: 0, truncated: false, error: `PDF 解析失败：${msg}` }
  } finally {
    await loadingTask.destroy().catch(() => {})
  }
}
