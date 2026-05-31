// 样式库：查看当前配方可用风格（内置 + 从参考图导入）。右上角入口打开。
import React from 'react'

export function StyleLibrary({ onClose }) {
  const [styles, setStyles] = React.useState(null)
  React.useEffect(() => {
    fetch('/api/styles').then(r => r.ok ? r.json() : null)
      .then(d => setStyles((d && d.styles) || [])).catch(() => setStyles([]))
  }, [])
  const builtin = (styles || []).filter(s => !s.imported)
  const imported = (styles || []).filter(s => s.imported)

  const Card = (s) => (
    <div className="sl-card" key={s.style_name}>
      <div className="sl-swatch">
        <span style={{ background: s.background_color }} />
        <span style={{ background: s.primary_color }} />
        <span style={{ background: s.accent_color }} />
      </div>
      <div className="sl-meta">
        <b>{s.display_name || s.style_name}</b>
        <div className="sl-sub">{s.mood || s.style_name}</div>
      </div>
      {s.imported && <span className="sl-badge">导入</span>}
    </div>
  )

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div><b>样式库</b><span className="sheet-sub">当前配方可用的视觉风格 · 生成时可选</span></div>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>
        {styles === null ? <div className="sl-empty">加载中…</div> : (
          <div className="sheet-body">
            <div className="sl-sec">内置风格</div>
            <div className="sl-grid">{builtin.map(Card)}</div>
            <div className="sl-sec">从参考图导入 {imported.length ? '' : '（还没有 · 在输入页「样式导入」上传一张参考图）'}</div>
            {imported.length > 0 && <div className="sl-grid">{imported.map(Card)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
