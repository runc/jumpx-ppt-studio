import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  useBrowserAgent,
  startRun,
  loadLlmConfig,
  llmConfigReady,
  readInterrupt,
  runFinished,
  findRunId,
  type BrowserAgentStream,
} from '@jumpx/agent-js'
import { usePorts, useActiveRecipeSkill, planFromFiles, titleFromPlan } from '@jumpx/adapters-browser'
import {
  BrandLink,
  InputScreen,
  LiveWorkbench,
  RecipeHub,
  StyleLibrary,
  SkillPage,
  ProvidersPanel,
  Stepper,
  PresentStage,
  PresenterView,
  RunHistory,
} from '@jumpx/ui'
import type { SlidePlanPage } from '@jumpx/ports'
import { SKILL_FILES } from './skillBundle'

function liveActiveIndex(stream: BrowserAgentStream) {
  const intr = readInterrupt(stream)
  const finished = runFinished(stream)
  if (finished) return 4
  if (intr) {
    if (intr.name === 'confirm_outline') return 1
    if (intr.name === 'choose_template') return 2
    if (intr.name === 'choose_render_mode') return 3
    return 1
  }
  return stream.isLoading ? 1 : 0
}

export function App() {
  const skillFilesBase = useMemo(() => SKILL_FILES, [])
  const { skillFiles, skillsMount, ready: recipeReady } = useActiveRecipeSkill(skillFilesBase)
  const stream = useBrowserAgent(skillFiles, skillsMount)
  const ports = usePorts()

  const [live, setLive] = useState(false)
  const [dark, setDark] = useState(false)
  const [topic, setTopic] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [styleLibOpen, setStyleLibOpen] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [presentKey, setPresentKey] = useState<string | null>(null)
  const [presentPages, setPresentPages] = useState<SlidePlanPage[]>([])
  const [storedPreviewHtml, setStoredPreviewHtml] = useState<string | null>(null)
  const startedOnce = useRef(false)
  const savedRunRef = useRef<string | null>(null)

  const _params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const presentParam = _params.get('present')
  const presenterRole = _params.get('role') === 'presenter'

  useEffect(() => {
    if (_params.get('skill') != null) setSkillOpen(true)
  }, [_params])

  const intr = live ? readInterrupt(stream) : null
  const finished = live ? runFinished(stream) : false
  const runId = live ? findRunId(stream) : null
  const ai = live ? liveActiveIndex(stream) : 0
  const pulseRender = live ? stream.isLoading && !intr && !finished : false
  const projTitle = live ? topic.split('——')[0].trim() || '新建演示' : '新建演示'
  const previewHtml = stream.htmlPreview || null

  useEffect(() => {
    if (!live) {
      startedOnce.current = false
      return
    }
    if (startedOnce.current) return
    startedOnce.current = true
  }, [live])

  useEffect(() => {
    if (!finished || !runId || !ports.run.saveSnapshot) return
    if (savedRunRef.current === runId) return
    const html = stream.htmlPreview || null
    const plan = planFromFiles(stream.values?.files || {}, runId)
    if (!html && !plan) return
    savedRunRef.current = runId
    void ports.run.saveSnapshot({
      id: runId,
      title: titleFromPlan(plan, topic, runId),
      topic,
      html,
      plan,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }, [finished, runId, stream.htmlPreview, stream.values?.files, topic, ports.run])

  async function resumeSession() {
    const ok = await stream.restorePersistedSession()
    if (!ok) {
      alert('无法恢复上次任务（可能已过期）')
      return
    }
    try {
      const t = localStorage.getItem('jumpx-lite-active-topic')
      if (t) setTopic(t)
    } catch {
      /* ignore */
    }
    setLive(true)
  }

  async function openStoredRun(id: string) {
    if (!ports.run.getStored) return
    const rec = await ports.run.getStored(id)
    if (!rec?.html) {
      alert('该记录尚无 HTML 预览')
      return
    }
    setTopic(rec.topic || rec.title)
    setStoredPreviewHtml(rec.html)
    setPresentPages(rec.plan?.pages || [])
    setPresentKey(id)
  }

  function startFromInput(
    t: string,
    opts: { len?: string; aud?: string; tone?: string; material?: string; style?: string } = {},
  ) {
    if (!llmConfigReady(loadLlmConfig())) {
      setProvidersOpen(true)
      return
    }
    setTopic(t)
    setLive(true)
    void startRun(stream, t, opts)
  }

  async function doExport(fmt: string) {
    if (exporting || !runId) return
    if (fmt !== 'HTML 网页') {
      const tip =
        'Lite 浏览器版不支持 Playwright 级 ' +
        fmt +
        ' 导出。\n\n建议：\n1. 先下载 HTML 网页\n2. 浏览器打开后「打印 → 另存为 PDF」\n\n或在 Studio（Docker）中使用完整导出。'
      if (!confirm(tip + '\n\n仍要尝试？')) return
    }
    setExporting(fmt)
    try {
      if (fmt === 'HTML 网页') {
        await ports.run.downloadHtml(runId, stream, `${runId}.html`)
        setExportOpen(false)
        return
      }
      const map: Record<string, 'pdf' | 'pptx' | 'png'> = {
        PDF: 'pdf',
        PPTX: 'pptx',
        '图片 PNG': 'png',
      }
      const format = map[fmt]
      if (!format) throw new Error('未知格式')
      await ports.export.exportRun(runId, format, stream)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(null)
    }
  }

  async function openPresent() {
    if (!runId) return
    const plan = await ports.run.getPlan(runId, stream)
    setPresentPages(plan?.pages || [])
    if (previewHtml) {
      try {
        sessionStorage.setItem(`jumpx-present-html-${runId}`, previewHtml)
      } catch {
        /* ignore */
      }
    }
    setPresentKey(runId)
  }

  const sun = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  )
  const moon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )

  function TopRight() {
    const darkBtn = (
      <button type="button" className="iconbtn" title="明 / 暗" onClick={() => setDark((d) => !d)}>
        {dark ? sun : moon}
      </button>
    )
    const providersBtn = (
      <button type="button" className="iconbtn" title="模型能力 / API" onClick={() => setProvidersOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h7M15 18h5" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="13" cy="18" r="2" />
        </svg>
      </button>
    )
    const skillsBtn = (
      <button type="button" className="iconbtn" title="配方 / Skills" onClick={() => setSkillsOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h10M4 12h7M4 17h10" />
          <circle cx="18" cy="7" r="2.2" />
          <circle cx="14" cy="12" r="2.2" />
          <circle cx="18" cy="17" r="2.2" />
        </svg>
      </button>
    )
    const styleLibBtn = (
      <button type="button" className="iconbtn" title="样式库" onClick={() => setStyleLibOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="13.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="12.5" r="2.5" />
          <circle cx="8.5" cy="7.5" r="2.5" />
          <circle cx="6.5" cy="13.5" r="2.5" />
          <path d="M12 22a10 10 0 1 1 10-10c0 2-2 3-4 3h-2a2 2 0 0 0-1 4 2 2 0 0 1-3 3z" />
        </svg>
      </button>
    )
    const skillBtn = (
      <button type="button" className="iconbtn" title="Skill 展示 / 下载" onClick={() => setSkillOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 3v18M4 7.5l8 4.5 8-4.5" />
        </svg>
      </button>
    )

    if (live) {
      return (
        <div className="tb-right" style={{ position: 'relative' }}>
          {skillsBtn}
          {styleLibBtn}
          {skillBtn}
          {providersBtn}
          {darkBtn}
          {finished && runId ? (
            <>
              <button type="button" className="btn" onClick={() => void openPresent()}>
                ▶ 演示
              </button>
              <button type="button" className="btn primary" onClick={() => setExportOpen((o) => !o)}>
                导出 ▾
              </button>
            </>
          ) : stream.isLoading ? (
            <button type="button" className="btn" onClick={() => stream.stop()}>
              停止
            </button>
          ) : null}
          {exportOpen && finished && runId && (
            <div className="export-pop">
              {[
                ['PDF', 'Lite：建议 HTML → 打印为 PDF'],
                ['PPTX', 'Lite：需 Studio 后端渲染'],
                ['图片 PNG', 'Lite：需 Studio 后端渲染'],
              ].map(([t, s]) => {
                const busy = exporting === t
                return (
                  <button
                    type="button"
                    className="ei"
                    key={t}
                    disabled={!!exporting}
                    onClick={() => void doExport(t)}
                  >
                    {busy ? (
                      <span className="ring" style={{ width: 15, height: 15 }} />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                      </svg>
                    )}
                    <div>
                      <b>{t}</b>
                      <div className="sub">{busy ? '生成中…' : s}</div>
                    </div>
                  </button>
                )
              })}
              <button
                type="button"
                className="ei"
                onClick={() => void doExport('HTML 网页')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                </svg>
                <div>
                  <b>HTML 网页</b>
                  <div className="sub">可翻页 · 下载到本地</div>
                </div>
              </button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="tb-right">
        {skillsBtn}
        {styleLibBtn}
        {skillBtn}
        {providersBtn}
        {darkBtn}
      </div>
    )
  }

  if (skillOpen) {
    return (
      <SkillPage
        onClose={() => {
          setSkillOpen(false)
          if (_params.get('skill') != null && typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname)
          }
        }}
      />
    )
  }

  if (presentParam && presenterRole) {
    const storedHtml =
      typeof window !== 'undefined'
        ? sessionStorage.getItem(`jumpx-present-html-${presentParam}`)
        : null
    return (
      <PresenterView
        presentKey={presentParam}
        previewHtml={storedHtml || previewHtml}
        pages={presentPages}
      />
    )
  }

  if (presentKey) {
    return (
      <PresentStage
        presentKey={presentKey}
        previewHtml={storedPreviewHtml || previewHtml}
        onExit={() => {
          setPresentKey(null)
          setStoredPreviewHtml(null)
          if (presentParam && typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname)
          }
        }}
      />
    )
  }

  return (
    <div className="app" data-mode={dark ? 'dark' : undefined}>
      <div className="topbar">
        <BrandLink sub="Lite" />
        <div className="tb-divline" />
        <div className="proj">
          <span className="t">{projTitle}</span>
        </div>
        <Stepper ai={ai} pulseRender={pulseRender} />
        <TopRight />
      </div>

      {live ? (
        <LiveWorkbench stream={stream} />
      ) : (
        <div className="screen home-screen">
          <InputScreen onStart={startFromInput} layout="section" />
          <div className="center-wrap home-history">
            <div className="center-col">
              <RunHistory
                canResume={stream.hasPersistedSession && !live}
                onResume={() => void resumeSession()}
                onOpenRun={(id) => void openStoredRun(id)}
              />
            </div>
          </div>
        </div>
      )}

      {skillsOpen && <RecipeHub onClose={() => setSkillsOpen(false)} />}
      {styleLibOpen && <StyleLibrary onClose={() => setStyleLibOpen(false)} />}
      {providersOpen && <ProvidersPanel onClose={() => setProvidersOpen(false)} />}

      {Object.keys(skillFilesBase).length === 0 && !live && (
        <div className="planning" style={{ background: 'rgba(0,0,0,.4)' }}>
          <p className="pt" style={{ color: 'var(--amber)' }}>
            未找到 skill 文件。请先运行 <code>pnpm sync:skill</code>。
          </p>
        </div>
      )}
    </div>
  )
}
