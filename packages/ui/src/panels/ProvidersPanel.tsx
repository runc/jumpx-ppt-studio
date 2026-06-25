import React from 'react'
import { usePorts } from '@jumpx/adapters-browser'
import { loadImageCfg, saveImageCfg, loadLlmConfig, saveLlmConfig, LLM_TEXT_DEFAULTS } from '@jumpx/agent-js'
import type { ProvidersState } from '@jumpx/ports'

const IMG = [
  { id: 'openai', name: 'OpenAI · GPT Image 2', model: 'gpt-image-2', sub: 'images.generate' },
  { id: 'jimeng', name: '即梦 · Seedream 4.0', model: 'doubao-seedream-4-0-250828', sub: '火山方舟 ARK · OpenAI 兼容' },
  { id: 'gemini', name: 'Gemini · Nano Banana 2', model: 'gemini-3.1-flash-image', sub: ':generateContent' },
]
const imgDefault = (id: string) => IMG.find((p) => p.id === id)?.model || ''

function Cap({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={'pv-cap' + (on ? ' on' : '')}>
      <i />
      {label}
      <b>{on ? '可用' : '未配置'}</b>
    </span>
  )
}

export function ProvidersPanel({ onClose }: { onClose: () => void }) {
  const ports = usePorts()
  const [state, setState] = React.useState<ProvidersState | null>(null)
  const [draft, setDraft] = React.useState(() => {
    const llm = loadLlmConfig()
    const img = loadImageCfg()
    return {
      text: {
        provider: llm.provider || 'auto',
        base_url: llm.baseURL || '',
        model: llm.model || '',
        api_key: llm.apiKey || '',
      },
      image: {
        provider: img.provider || 'none',
        base_url: img.base_url || '',
        model: img.model || '',
        api_key: img.api_key || '',
      },
    }
  })
  const [busy, setBusy] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null)

  React.useEffect(() => {
    let alive = true
    void ports.settings.get().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [ports])

  const text = draft.text || {}
  const image = draft.image || { provider: 'openai' }

  function persistDraft(next: typeof draft) {
    setDraft(next)
    saveLlmConfig({
      apiKey: next.text.api_key,
      baseURL: next.text.base_url,
      model: next.text.model,
      provider: next.text.provider as 'openai' | 'anthropic' | 'auto' | undefined,
    })
    saveImageCfg({
      provider: next.image.provider,
      base_url: next.image.base_url,
      model: next.image.model,
      api_key: next.image.api_key,
    })
  }

  function setText(k: string, v: string) {
    persistDraft({ ...draft, text: { ...text, [k]: v } })
  }
  function setImage(k: string, v: string) {
    persistDraft({ ...draft, image: { ...image, [k]: v } })
  }

  const tenancy = state?.tenancy || 'local'
  const textReady = Boolean(text.api_key?.trim())
  const isReal = ['openai', 'jimeng', 'gemini'].includes(image.provider)
  const imageReady = image.provider === 'mock' || (isReal && Boolean(image.api_key?.trim()))

  async function test(kind: 'text' | 'image') {
    setBusy(kind)
    setMsg(null)
    if (kind === 'text') {
      const r = await ports.settings.test({
        kind: 'text',
        provider: text.provider || 'auto',
        api_key: text.api_key || '',
        base_url: text.base_url,
        model: text.model,
      })
      setBusy('')
      setMsg({ ok: r.ok, text: '文本模型 · ' + r.message })
    } else {
      const r = await ports.settings.test({
        kind: 'image',
        provider: image.provider,
        api_key: image.api_key || '',
        model: image.model,
      })
      setBusy('')
      setMsg({ ok: r.ok, text: '图片 · ' + r.message })
    }
  }

  async function saveLocal() {
    setSaving(true)
    setMsg(null)
    try {
      const s = await ports.settings.save({
        text: { ...text, api_key: text.api_key },
        image: { ...image, api_key: image.api_key },
      })
      setState(s)
      setMsg({ ok: true, text: '已保存到浏览器 localStorage' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    }
    setSaving(false)
  }

  return (
    <div className="pv-back" onClick={onClose}>
      <div className="pv-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pv-head">
          <div className="pv-title">
            模型能力{' '}
            <span className={'pv-mode pv-mode-' + tenancy}>
              {tenancy === 'local' ? '本机模式 · Lite' : '公开 / 多租户'}
            </span>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="pv-caps">
          <Cap on label="HTML 生成" />
          <Cap on={textReady} label="文本模型" />
          <Cap on={imageReady} label="AI 图片" />
        </div>

        <p className="pv-note">key 存在你的浏览器 localStorage，不经任何后端。XSS 可窃取密钥，请勿在不可信环境使用。</p>

        <div className="pv-cors">
          <b>浏览器 CORS 说明</b>
          <p>
            Lite 从页面直连 LLM / 图片 API 时，若网关未返回 <code>Access-Control-Allow-Origin</code>，测试连接会失败。
            可选方案：① 使用支持浏览器跨域的 OpenAI 兼容网关；② 自建 Cloudflare Worker / nginx 反代；③ 等待 Extension 版（background 代发请求）。
            火山方舟等国内端点通常需反代。详见仓库根目录 <code>RUN.md</code>「方式 C · Lite」。
          </p>
        </div>

        <section className="pv-sec">
          <div className="pv-sec-h">
            文本模型 <span>（OpenAI 兼容或 Anthropic · 按 Base URL / 模型名自动路由）</span>
          </div>
          <label className="pv-f">
            <span>Base URL</span>
            <input
              value={text.base_url || ''}
              placeholder={LLM_TEXT_DEFAULTS.baseURL}
              onChange={(e) => setText('base_url', e.target.value)}
            />
          </label>
          <label className="pv-f">
            <span>API Key</span>
            <input
              type="password"
              value={text.api_key || ''}
              placeholder="sk-…"
              onChange={(e) => setText('api_key', e.target.value)}
            />
          </label>
          <label className="pv-f">
            <span>Model</span>
            <input
              value={text.model || ''}
              placeholder={LLM_TEXT_DEFAULTS.model}
              onChange={(e) => setText('model', e.target.value)}
            />
          </label>
          <div className="pv-row">
            <button type="button" className="btn" disabled={busy === 'text'} onClick={() => void test('text')}>
              {busy === 'text' ? '测试中…' : '测试连接 · 拉模型'}
            </button>
          </div>
        </section>

        <section className="pv-sec">
          <div className="pv-sec-h">
            图片模型 <span>（出图能力 · 不配则只出 HTML）</span>
          </div>
          <div className="pv-providers">
            {IMG.map((p) => (
              <button
                key={p.id}
                type="button"
                className={'pv-prov' + (image.provider === p.id ? ' on' : '')}
                onClick={() => setImage('provider', p.id)}
              >
                <b>{p.name}</b>
                <span>{p.sub}</span>
              </button>
            ))}
          </div>
          {isReal && (
            <>
              <label className="pv-f">
                <span>API Key</span>
                <input
                  type="password"
                  value={image.api_key || ''}
                  placeholder="sk-… / ARK key / Gemini key"
                  onChange={(e) => setImage('api_key', e.target.value)}
                />
              </label>
              <label className="pv-f">
                <span>Model</span>
                <input
                  value={image.model || ''}
                  placeholder={imgDefault(image.provider) + '（留空用默认）'}
                  onChange={(e) => setImage('model', e.target.value)}
                />
              </label>
              <div className="pv-row">
                <button
                  type="button"
                  className="btn"
                  disabled={busy === 'image'}
                  onClick={() => void test('image')}
                >
                  {busy === 'image' ? '测试中…' : '测试连接'}
                </button>
              </div>
            </>
          )}
          <div className="pv-mockrow">
            <button
              type="button"
              className={'pv-mock' + (image.provider === 'mock' ? ' on' : '')}
              onClick={() => setImage('provider', image.provider === 'mock' ? 'none' : 'mock')}
            >
              {image.provider === 'mock' ? '✓ ' : ''}用占位图测试（无需 key）
            </button>
          </div>
        </section>

        {msg && <div className={'pv-msg' + (msg.ok ? ' ok' : ' err')}>{msg.text}</div>}

        <div className="pv-foot">
          <button type="button" className="btn primary" disabled={saving} onClick={() => void saveLocal()}>
            {saving ? '保存中…' : '保存配置'}
          </button>
          <span className="pv-foot-note">改动已自动存浏览器</span>
        </div>
      </div>
    </div>
  )
}
