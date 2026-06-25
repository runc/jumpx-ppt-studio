import { loadImageCfg, IMAGE_DEFAULTS, type ImageProviderCfg } from './imageConfig.js'

function resolveOutPath(outPath: string): string {
  const norm = outPath.replace(/\\/g, '/')
  if (norm.startsWith('/runs/')) return norm
  if (norm.startsWith('runs/')) return '/' + norm
  return `/runs/${norm.replace(/^\/+/, '')}`
}

async function fetchOpenAICompatibleImage(
  prompt: string,
  cfg: ImageProviderCfg,
  provider: 'openai' | 'jimeng',
): Promise<Uint8Array> {
  const d = IMAGE_DEFAULTS[provider]
  const base = (cfg.base_url || d.base_url).replace(/\/$/, '')
  const model = cfg.model || d.model
  const body: Record<string, unknown> = {
    model,
    prompt,
    size: d.size,
    n: 1,
  }
  if (provider === 'jimeng') body.response_format = 'b64_json'

  const r = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`)
  }
  const j = (await r.json()) as { data?: { b64_json?: string; url?: string }[] }
  const d0 = j.data?.[0]
  if (d0?.b64_json) {
    return Uint8Array.from(atob(d0.b64_json), (c) => c.charCodeAt(0))
  }
  if (d0?.url) {
    const ir = await fetch(d0.url)
    if (!ir.ok) throw new Error(`image url fetch ${ir.status}`)
    return new Uint8Array(await ir.arrayBuffer())
  }
  throw new Error('图片响应既无 b64_json 也无 url')
}

async function fetchGeminiImage(prompt: string, cfg: ImageProviderCfg): Promise<Uint8Array> {
  const d = IMAGE_DEFAULTS.gemini
  const base = (cfg.base_url || d.base_url).replace(/\/$/, '')
  const model = cfg.model || d.model
  const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(cfg.api_key)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`)
  }
  const j = (await r.json()) as {
    candidates?: { content?: { parts?: { inline_data?: { data?: string }; inlineData?: { data?: string } }[] } }[]
  }
  const parts = j.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    const inl = p.inline_data || p.inlineData
    if (inl?.data) {
      return Uint8Array.from(atob(inl.data), (c) => c.charCodeAt(0))
    }
  }
  throw new Error('Gemini 响应无 inline image data')
}

/** Canvas 品牌占位 PNG（mock provider，无需 key） */
async function renderMockPlaceholder(prompt: string, pageLabel = ''): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  ctx.fillStyle = '#F3F2EC'
  ctx.fillRect(0, 0, 1280, 720)
  ctx.strokeStyle = '#DAD6CB'
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, 1200, 640)

  ctx.fillStyle = '#128A45'
  ctx.font = 'bold 48px system-ui, sans-serif'
  ctx.fillText('JX · MOCK', 80, 120)
  ctx.fillStyle = '#56534C'
  ctx.font = '24px system-ui, sans-serif'
  ctx.fillText(pageLabel || 'AI 配图占位', 80, 170)

  const lines = prompt.slice(0, 180).match(/.{1,42}/g) || [prompt.slice(0, 42)]
  ctx.fillStyle = '#1A1917'
  ctx.font = '20px system-ui, sans-serif'
  lines.slice(0, 8).forEach((ln, i) => ctx.fillText(ln, 80, 230 + i * 32))

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('mock PNG 生成失败')
  return new Uint8Array(await blob.arrayBuffer())
}

export type GenerateImageResult =
  | { ok: true; path: string; bytes: Uint8Array; message: string }
  | { ok: false; message: string }

export async function generateImageInBrowser(
  prompt: string,
  outPath: string,
): Promise<GenerateImageResult> {
  const path = resolveOutPath(outPath)
  if (!path.includes('/runs/')) {
    return { ok: false, message: `image-error：out_path 必须位于 runs/ 之下，收到 ${outPath}` }
  }

  const cfg = loadImageCfg()
  const provider = (cfg.provider || 'none').toLowerCase()
  const pageLabel = path.split('/').pop()?.replace(/\.[^.]+$/, '') || ''

  try {
    let bytes: Uint8Array
    if (provider === 'mock') {
      bytes = await renderMockPlaceholder(prompt, pageLabel)
      return {
        ok: true,
        path,
        bytes,
        message: `image-rendered (mock 占位图)：${path}`,
      }
    }
    if (provider === 'none' || !provider) {
      return {
        ok: false,
        message:
          'image-backend-unavailable：未配置图片 provider。请在「模型能力」配置 image key，或选 mock 占位图测试。',
      }
    }
    if (!cfg.api_key?.trim()) {
      return {
        ok: false,
        message: 'image-backend-unavailable：已选 provider 但未配 key。',
      }
    }
    if (provider === 'openai' || provider === 'jimeng') {
      bytes = await fetchOpenAICompatibleImage(prompt, cfg, provider)
    } else if (provider === 'gemini') {
      bytes = await fetchGeminiImage(prompt, cfg)
    } else {
      return { ok: false, message: `image-backend-unavailable：未知 provider ${provider}` }
    }
    return { ok: true, path, bytes, message: `image-rendered (${provider})：${path}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/failed to fetch|cors|network/i.test(msg)) {
      return {
        ok: false,
        message: `image-backend-error：浏览器 CORS 拦截（${msg.slice(0, 120)}）。请配置反代或 Extension。`,
      }
    }
    return {
      ok: false,
      message: `image-backend-error：${msg.slice(0, 180)}。请回退到 HTML 路径（build_slides_html）。`,
    }
  }
}

/** 供 StateBackend 存储：PNG bytes → base64 文本 + 标记 */
export function pngBytesToFileContent(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `__binary_png_b64:${btoa(bin)}`
}
