import React from 'react'
import { usePorts } from '@jumpx/adapters-browser'
import { LITE_STUB_MSG } from '../data/mock-recipes.js'

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

type StartOpts = {
  len?: string
  aud?: string
  tone?: string
  material?: string
  style?: string
}

export function InputScreen({
  onStart,
  layout = 'page',
}: {
  onStart: (topic: string, opts: StartOpts) => void
  /** page：自带 .screen 外壳；section：仅内容区，由父级 .screen 统一滚动 */
  layout?: 'page' | 'section'
}) {
  const ports = usePorts()
  const [topic, setTopic] = React.useState('重新认识睡眠 —— 给训练营同学的 10 分钟分享')
  const [len, setLen] = React.useState('约 12 页')
  const [aud, setAud] = React.useState('同学')
  const [tone, setTone] = React.useState('干练')
  const [material, setMaterial] = React.useState('')
  const [files, setFiles] = React.useState<{ name: string; chars: number }[]>([])
  const [busy, setBusy] = React.useState(false)
  const [styleName, setStyleName] = React.useState('')
  const [styleLabel, setStyleLabel] = React.useState('')
  const [importingStyle, setImportingStyle] = React.useState(false)
  const [styleHelpOpen, setStyleHelpOpen] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const styleRef = React.useRef<HTMLInputElement>(null)
  const examples = ['15 分钟生活圈', '用户增长的第一性原理', '宋代美学入门', '我的产品复盘']

  function readAsDataURL(file: File) {
    return new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.onerror = rej
      fr.readAsDataURL(file)
    })
  }

  async function onPickStyle(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files || [])
    if (!fs.length) return
    setStyleHelpOpen(false)
    setImportingStyle(true)
    try {
      const label =
        (fs[0].name || '参考风格').replace(/\.[^.]+$/, '') +
        (fs.length > 1 ? ` 等${fs.length}图` : '')
      const images = await Promise.all(fs.slice(0, 4).map(readAsDataURL))
      const j = await ports.styles.importFromImages(
        images.map((dataUrl) => ({ dataUrl })),
        label,
      )
      if (j?.style?.id || (j as { style_name?: string }).style_name) {
        const sn = String(j.style?.id || (j as { style_name?: string }).style_name)
        setStyleName(sn)
        setStyleLabel(label)
      } else alert('风格识别失败：' + ((j as { error?: string }).error || '未知'))
    } catch (err) {
      alert('风格导入失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImportingStyle(false)
      if (styleRef.current) styleRef.current.value = ''
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    if (!picked.length) return
    setBusy(true)
    try {
      for (const f of picked) {
        const j = await ports.materials.extractText(f)
        const text = (j.text || '').trim()
        if (text) {
          setMaterial((m) => (m ? m + '\n\n' : '') + `# 来自 ${f.name}\n` + text)
          setFiles((fs) => [...fs, { name: f.name, chars: text.length }])
        } else {
          setFiles((fs) => [...fs, { name: f.name, chars: 0 }])
          if (j.error) alert(j.error)
        }
      }
    } catch (err) {
      alert('资料抽取失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const matChars = material.trim().length

  function Seg({
    label,
    val,
    set,
    opts,
  }: {
    label: string
    val: string
    set: (v: string) => void
    opts: string[]
  }) {
    return (
      <div className="optgrp">
        <span className="gl">{label}</span>
        <div className="seg">
          {opts.map((o) => (
            <button
              type="button"
              key={o}
              className={'s' + (val === o ? ' on' : '')}
              onClick={() => set(o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function handleStart() {
    onStart(topic, { len, aud, tone, material, style: styleName })
  }

  const body = (
    <div className="center-wrap">
      <div className="center-col">
        <h2 className="big">想讲点什么？</h2>
        <p className="lead">
          写下一个主题，副驾会先帮你规划大纲。几个关键选择，它会停下来问你的意见。
        </p>
        <div className="compose">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：重新认识睡眠 —— 给训练营同学的 10 分钟分享"
          />
          <textarea
            className="material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="可选 · 粘贴参考资料（笔记 / 文章 / 数据），或上传 PDF —— 副驾会吸收进内容，生成得更有血肉"
          />
          <div className="foot">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.htm,.txt,.md"
              multiple
              style={{ display: 'none' }}
              onChange={onPickFiles}
            />
            <button
              type="button"
              className="attach"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {busy ? <span className="ring" style={{ width: 13, height: 13 }} /> : '＋'}{' '}
              {busy ? '解析中…' : '上传资料'}
            </button>
            <input
              ref={styleRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={onPickStyle}
            />
            <button
              type="button"
              className="attach"
              onClick={() => setStyleHelpOpen(true)}
              disabled={importingStyle}
              title="上传参考图，AI 识别它的视觉风格用于本次生成"
            >
              {importingStyle ? (
                <span className="ring" style={{ width: 13, height: 13 }} />
              ) : (
                '🎨'
              )}{' '}
              {importingStyle ? '识别风格…' : '样式导入'}
            </button>
            {matChars > 0 && <span className="hintn">已附资料 {matChars} 字</span>}
            {files.some((f) => f.chars === 0) && (
              <span className="hintn" style={{ color: 'var(--amber)' }}>
                部分文件未解析（pptx/xlsx 等请转 PDF 或粘贴文本）
              </span>
            )}
            {styleName && (
              <span className="style-chip">
                风格 · {styleLabel}
                <i
                  onClick={() => {
                    setStyleName('')
                    setStyleLabel('')
                  }}
                >
                  ✕
                </i>
              </span>
            )}
            <span className="spacer" />
            <button type="button" className="cta" onClick={handleStart}>
              开始生成 {ARROW}
            </button>
          </div>
        </div>
        <div className="ex">
          <span className="lab">试：</span>
          {examples.map((x) => (
            <span key={x} className="chip" onClick={() => setTopic(x)}>
              {x}
            </span>
          ))}
        </div>
        <div className="opts">
          <Seg label="篇幅" val={len} set={setLen} opts={['精简', '约 12 页', '详尽']} />
          <Seg label="受众" val={aud} set={setAud} opts={['同学', '客户', '评委']} />
          <Seg label="语气" val={tone} set={setTone} opts={['干练', '亲切', '学术']} />
        </div>
        <div className="reassure">
          <span className="pdot" />
          整个过程约 1–2 分钟，你随时可以打断或修改。
        </div>
      </div>
    </div>
  )

  const dialog = styleHelpOpen ? (
    <div className="dlg-mask" onClick={() => setStyleHelpOpen(false)}>
      <div className="dlg" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-h">🎨 样式导入 · 上传参考图</div>
        <p className="dlg-lead">
          AI 会“看”你的图，提取它的<b>配色、字体气质、信息密度、版式倾向</b>
          ，作为本次生成的视觉风格（并存入样式库）。
        </p>
        <p className="dlg-lead" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {LITE_STUB_MSG}
        </p>
        <div className="dlg-acts">
          <button type="button" className="btn" onClick={() => setStyleHelpOpen(false)}>
            取消
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setStyleHelpOpen(false)
              styleRef.current?.click()
            }}
          >
            选择图片
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (layout === 'section') {
    return (
      <>
        {body}
        {dialog}
      </>
    )
  }

  return (
    <div className="screen">
      {body}
      {dialog}
    </div>
  )
}
