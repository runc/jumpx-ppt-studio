import React from 'react'
import { usePorts } from '@jumpx/adapters-browser'
import { BrandLink } from '../shell/Brand.js'

type SkillData = {
  name?: string
  version?: string
  skill_ref?: string
  description?: string
  pipeline?: string
  references?: { file: string; label: string }[]
  download_note?: string
}

export function SkillPage({ onClose }: { onClose?: () => void }) {
  const ports = usePorts()
  const [data, setData] = React.useState<SkillData | null | false>(null)
  const [openRef, setOpenRef] = React.useState<{ file: string; title: string } | null>(null)
  const [refText, setRefText] = React.useState('')
  const [downloading, setDownloading] = React.useState(false)

  async function downloadSkill() {
    if (!ports.skill.exportZip) {
      alert('当前环境不支持 Skill 下载')
      return
    }
    setDownloading(true)
    try {
      const blob = await ports.skill.exportZip()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ai-slide-producer.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setDownloading(false)
    }
  }

  React.useEffect(() => {
    void ports.skill
      .overview()
      .then((d) => setData(d as SkillData))
      .catch(() => setData(false))
  }, [ports])

  React.useEffect(() => {
    if (!openRef) return
    setRefText('加载中…')
    void ports.skill
      .readReference(openRef.file)
      .then(setRefText)
      .catch(() => setRefText('（读取失败）'))
  }, [openRef, ports])

  if (data === null)
    return (
      <div className="skp">
        <div className="skp-loading">加载 Skill…</div>
      </div>
    )
  if (data === false)
    return (
      <div className="skp">
        <div className="skp-loading">Skill 接口未就绪</div>
      </div>
    )

  const pipeline = (data.pipeline || '').split('→').map((s) => s.trim()).filter(Boolean)

  return (
    <div className="skp">
      <div className="skp-top">
        <BrandLink />
        {onClose && (
          <button type="button" className="btn" onClick={onClose}>
            ← 返回
          </button>
        )}
      </div>

      <div className="skp-wrap">
        <div className="skp-hero">
          <div className="skp-tag">SKILL · 可装进任意 Agent</div>
          <h1>
            {data.name}{' '}
            <span className="skp-ver">v{data.version}</span>
            {data.skill_ref && (
              <span className="skp-ver" style={{ opacity: 0.65, marginLeft: 8 }}>
                ({data.skill_ref})
              </span>
            )}
          </h1>
          <p className="skp-desc">{data.description}</p>
          <div className="skp-cta">
            <button
              type="button"
              className="btn primary lg"
              disabled={downloading}
              onClick={() => void downloadSkill()}
            >
              {downloading ? '打包中…' : '⬇ 下载 Skill（.zip）'}
            </button>
            <span className="skp-assure">
              ✓ 这份 = 展示的 = Web App 正在跑的，<b>同一份文件</b>
            </span>
          </div>
          <p className="skp-pitch">
            把它丢进 Claude / 其它 agent，就能复现这里的同款效果——厚内容 + 模型自由设计的版式。
          </p>
        </div>

        <div className="skp-fixes">
          <div className="skp-fix">
            <div className="skp-fix-h">🩻 内容有血肉</div>
            <p>
              每个要点带支撑层（为什么/数据/例子），讲稿写成 ≥150 字逐字口播稿；资料少也按机制/对比/可执行收束展开，不写薄。
            </p>
          </div>
          <div className="skp-fix">
            <div className="skp-fix-h">🎨 版式有自主性</div>
            <p>
              渲染主路径 = 模型按设计 token 直接写 HTML（可自绘图表/示意图），不是填死模板；模板降级为确定性回退。
            </p>
          </div>
        </div>

        <div className="skp-sec-h">生产管线</div>
        <div className="skp-pipe">
          {pipeline.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="skp-arrow">→</span>}
              <span className="skp-step">{s}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="skp-sec-h">内部角色（点开看指令原文）</div>
        <div className="skp-refs">
          {(data.references || []).map((r) => (
            <button
              key={r.file}
              type="button"
              className="skp-ref"
              onClick={() => setOpenRef({ file: r.file, title: r.label })}
            >
              <span className="skp-ref-label">{r.label}</span>
              <span className="skp-ref-file">{r.file}</span>
            </button>
          ))}
        </div>
      </div>

      {openRef && (
        <div className="skp-ref-modal" onClick={() => setOpenRef(null)}>
          <div className="skp-ref-panel" onClick={(e) => e.stopPropagation()}>
            <div className="skp-ref-head">
              <b>{openRef.title}</b>
              <button type="button" className="iconbtn" onClick={() => setOpenRef(null)}>
                ✕
              </button>
            </div>
            <pre className="skp-ref-body">{refText}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
