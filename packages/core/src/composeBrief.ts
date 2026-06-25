/** 与 frontend/app/src/agent.js composeBrief 对齐 */
export function composeBrief(
  topic: string,
  opts: {
    len?: string
    aud?: string
    tone?: string
    style?: string
    material?: string
  } = {},
): string {
  const lines = [String(topic || '').trim()]
  const meta: string[] = []
  if (opts.len) meta.push('篇幅：' + opts.len)
  if (opts.aud) meta.push('受众：' + opts.aud)
  if (opts.tone) meta.push('语气：' + opts.tone)
  if (meta.length) lines.push(meta.join('　'))
  if (opts.style) {
    lines.push(
      `指定视觉风格：${opts.style}（已从参考图导入，请在 Design 阶段用此 style_name）`,
    )
  }
  const mat = (opts.material || '').trim()
  if (mat) {
    lines.push(
      '\n【参考资料 · 请吸收进 Context Pack 作为内容来源，引用其中的事实/数据/例子】\n' +
        mat,
    )
  }
  return lines.join('\n')
}
