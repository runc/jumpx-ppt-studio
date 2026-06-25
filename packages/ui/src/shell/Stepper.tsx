import React from 'react'

const STEPS = ['输入', '大纲', '选模板', '渲染', '完成']

export function Stepper({ ai, pulseRender }: { ai: number; pulseRender?: boolean }) {
  const chk = (
    <svg viewBox="0 0 24 24" width="11" fill="none" stroke="#fff" strokeWidth="3">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
  return (
    <div className="steps">
      {STEPS.map((lb, i) => {
        const done = i < ai
        const cur = i === ai
        return (
          <React.Fragment key={lb}>
            {i > 0 && <span className={'bar' + (i <= ai ? ' fill' : '')} />}
            <div className={'step' + (done ? ' done' : cur ? ' cur' : '')}>
              <span className="num">
                {done ? chk : cur && pulseRender && lb === '渲染' ? <i className="live" /> : i + 1}
              </span>
              <span className="lb">{lb}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
