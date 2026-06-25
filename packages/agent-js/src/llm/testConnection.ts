import { resolveProvider, type LlmConfig } from '../providers.js'

export async function testLlmConnection(cfg: Pick<LlmConfig, 'apiKey' | 'baseURL' | 'model' | 'provider'>): Promise<{
  ok: boolean
  message: string
}> {
  if (!cfg.apiKey?.trim()) {
    return { ok: false, message: '请填写 API Key' }
  }
  const provider = resolveProvider({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    model: cfg.model || 'test',
    provider: cfg.provider,
  })
  const base = (cfg.baseURL || '').replace(/\/$/, '')

  try {
    if (provider === 'anthropic') {
      const root = base.replace(/\/v1$/, '') || 'https://api.anthropic.com'
      const r = await fetch(`${root}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model || 'claude-sonnet-4-20250514',
          max_tokens: 8,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      })
      if (r.ok) return { ok: true, message: 'Anthropic · 连接成功' }
      const t = await r.text()
      return { ok: false, message: `Anthropic HTTP ${r.status}: ${t.slice(0, 120)}` }
    }

    const url = base ? `${base}/chat/completions` : 'https://api.openai.com/v1/chat/completions'
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini',
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    if (r.ok) return { ok: true, message: 'OpenAI 兼容 · 连接成功' }
    const t = await r.text()
    return { ok: false, message: `HTTP ${r.status}: ${t.slice(0, 120)}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/failed to fetch|cors|network/i.test(msg)) {
      return {
        ok: false,
        message: '浏览器 CORS 拦截。请使用支持跨域的网关、自建反代，或等待 Extension 版本。',
      }
    }
    return { ok: false, message: msg }
  }
}
