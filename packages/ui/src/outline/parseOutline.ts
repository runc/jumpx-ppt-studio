export type OutlinePage = {
  n: number
  title: string
  role: string
  oneliner: string
  bullets: string[]
}

export type ParsedOutline = {
  strategy: string
  pages: OutlinePage[]
}

/** 解析 confirm_outline 的 outline_md → 结构化数据 */
export function parseOutline(md: string): ParsedOutline {
  if (!md) return { strategy: '', pages: [] }
  const lines = md.split('\n')
  let strategy = ''
  const pages: OutlinePage[] = []
  let cur: OutlinePage | null = null
  let inStrategy = false

  const SEP = '｜|·、：:．.\\-—–'
  const reP = new RegExp('^#{0,4}\\s*P(\\d{1,2})\\s*[' + SEP + ']\\s*(.+)$', 'i')
  const reNumRole = /^(\d{1,2})\.\s+\*{1,2}([^*]+)\*{1,2}\s*[—–-]+\s*(.+)$/
  const reNum = /^(\d{1,2})\.\s+\*{0,2}(.+?)\*{0,2}$/
  const isHeading = (l: string) => /^#{1,4}\s/.test(l)

  const flush = () => {
    if (cur) {
      pages.push(cur)
      cur = null
    }
  }

  for (const raw of lines) {
    const l = raw.trim()
    if (!l || /^[-—–]{3,}$/.test(l)) continue

    if (/^#{1,4}\s*(叙事策略|叙事弧|narrative|strategy)/i.test(l)) {
      inStrategy = true
      flush()
      continue
    }
    const inlineArc = l.match(/^\*{0,2}叙事[弧策略线]+\*{0,2}\s*[:：]\s*(.+)/)
    if (inlineArc) {
      strategy = inlineArc[1].replace(/\*+/g, '').trim()
      inStrategy = false
      continue
    }

    if (/^#{1,4}\s*(总页数|预计时长|时长|时间|节奏|pacing|页面规划|pages)\b/i.test(l)) {
      flush()
      inStrategy = false
      continue
    }

    const mP = l.match(reP)
    const mNR = !mP && l.match(reNumRole)
    const mN = !mP && !mNR && l.match(reNum)
    if (mP || mNR || mN) {
      flush()
      inStrategy = false
      let n: number
      let title: string
      let role = ''
      if (mP) {
        n = +mP[1]
        title = mP[2].replace(/\*+/g, '').trim()
      } else if (mNR) {
        n = +mNR[1]
        role = mNR[2].trim()
        title = mNR[3].trim()
      } else {
        n = +mN![1]
        title = mN![2].replace(/\*+/g, '').trim()
      }
      cur = { n, title, role, oneliner: '', bullets: [] }
      continue
    }

    if (isHeading(l)) {
      flush()
      inStrategy = false
      continue
    }

    if (inStrategy) {
      strategy += (strategy ? '\n' : '') + l
      continue
    }
    if (!cur) continue

    const roleM = l.match(/^\s*[-*•]?\s*\*{0,2}(?:角色|作用|role)\*{0,2}\s*[:：]\s*(.+)/i)
    if (roleM) {
      cur.role = cur.role || roleM[1].replace(/\*+/g, '').trim()
      continue
    }
    const oneM = l.match(
      /^\s*[-*•]?\s*\*{0,2}(?:一句话|核心|key ?message|oneliner)\*{0,2}\s*[:：]\s*(.+)/i,
    )
    if (oneM) {
      cur.oneliner = oneM[1].replace(/\*+/g, '').trim()
      continue
    }
    const bM = l.match(/^\s*[-*•]\s+(.+)/)
    if (bM) {
      cur.bullets.push(bM[1].replace(/\*+/g, '').trim())
      continue
    }
    if (/^\s{2,}\S/.test(raw)) cur.bullets.push(l.replace(/\*+/g, '').trim())
  }
  flush()
  return { strategy, pages }
}

const ROLE_LABEL: Record<string, string> = {
  hook: '钩子',
  cover: '封面',
  context: '背景',
  core: '核心',
  shift: '转折',
  takeaway: '收束',
  closing: '收束',
  evidence: '论据',
}

export function roleTag(r: string): string {
  const k = (r || '').toLowerCase().split('/')[0].trim()
  return ROLE_LABEL[k] || r || ''
}
