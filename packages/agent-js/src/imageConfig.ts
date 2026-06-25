/** 图片 provider 配置（与 adapters-browser browser-ports 共用 localStorage key） */
export type ImageProviderCfg = {
  provider: string
  base_url: string
  model: string
  api_key: string
}

const IMAGE_STORAGE_KEY = 'jumpx-lite-image-provider'

export const IMAGE_DEFAULTS: Record<string, { model: string; base_url: string; size: string }> = {
  openai: { model: 'gpt-image-2', base_url: 'https://api.openai.com/v1', size: '1024x1024' },
  jimeng: {
    model: 'doubao-seedream-4-0-250828',
    base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    size: '1024x1024',
  },
  gemini: {
    model: 'gemini-2.0-flash-preview-image-generation',
    base_url: 'https://generativelanguage.googleapis.com/v1',
    size: '1024x1024',
  },
}

export function loadImageCfg(): ImageProviderCfg {
  try {
    const raw = localStorage.getItem(IMAGE_STORAGE_KEY)
    if (!raw) return { provider: 'none', base_url: '', model: '', api_key: '' }
    return { provider: 'none', base_url: '', model: '', api_key: '', ...JSON.parse(raw) }
  } catch {
    return { provider: 'none', base_url: '', model: '', api_key: '' }
  }
}

export function saveImageCfg(partial: Partial<ImageProviderCfg>): ImageProviderCfg {
  const next = { ...loadImageCfg(), ...partial }
  localStorage.setItem(IMAGE_STORAGE_KEY, JSON.stringify(next))
  return next
}
