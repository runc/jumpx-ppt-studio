/** 与 Studio `data.js` RECIPES_FALLBACK 对齐 — browser adapter mock */
export const RECIPES_FALLBACK = [
  {
    id: 'plain',
    name: '素白 · 通用',
    tag: '内置 · 推荐',
    persona: '懂通用清单与图表 · 写得干练清晰 · 厚薄适中',
    domain: ['清单', '图表', '概念'],
    voice: '干练清晰',
    densityIdx: 1,
  },
  {
    id: 'invest',
    name: '投资复盘风',
    tag: '内置',
    persona: '懂财务/增长指标与复盘框架 · 先抛结论·麦肯锡式 · 偏厚',
    domain: ['财务指标', '增长', '复盘框架'],
    voice: '理性·结论先行',
    densityIdx: 2,
  },
  {
    id: 'teach',
    name: '教学递进',
    tag: '内置',
    persona: '懂概念拆解与举例 · 循循善诱 · 厚薄适中',
    domain: ['概念拆解', '举例', '练习'],
    voice: '亲切·循循善诱',
    densityIdx: 1,
  },
  {
    id: 'song',
    name: '宋代美学入门',
    tag: '已导入 · GitHub',
    persona: '懂宋代美学背景 · 故事化·温润 · 偏薄',
    domain: ['宋代美学', '器物', '审美'],
    voice: '温润·叙事',
    densityIdx: 0,
  },
] as const

export const MOCK_STYLES = [
  {
    style_name: 'teaching-clean',
    display_name: '教学清爽',
    mood: '清晰、友好、课堂感',
    background_color: '#FAF8F2',
    primary_color: '#2C5E48',
    accent_color: '#B07A2E',
    imported: false,
  },
  {
    style_name: 'editorial-magazine',
    display_name: '杂志编辑',
    mood: '观点、叙事、杂志排版',
    background_color: '#1a1a1a',
    primary_color: '#f5f5f5',
    accent_color: '#e63946',
    imported: false,
  },
  {
    style_name: 'swiss-system',
    display_name: '瑞士系统',
    mood: '网格、理性、极简',
    background_color: '#ffffff',
    primary_color: '#111111',
    accent_color: '#0066cc',
    imported: false,
  },
] as const

export const LITE_STUB_MSG =
  'Lite 浏览器版：此能力需后端或后续 Phase 实装。当前为占位，界面与 Slide Studio 完整版保持一致。'

export const MOCK_SKILL_OVERVIEW = {
  name: 'ai-slide-producer',
  version: '1.0',
  description:
    '厚内容 + 模型自由设计版式的幻灯 skill。九步管线、人在环门禁、HTML 直写渲染。',
  pipeline:
    'Intake → Context Pack → Outline → Slide Plan → Review → Design → Render → QA → Delivery',
  references: [
    { file: 'references/02-context-pack.md', label: '02 · 素材怎么吸收' },
    { file: 'references/03-strategist.md', label: '03 · 大纲 / 叙事弧' },
    { file: 'references/05-writer.md', label: '05 · 每页内容怎么构建' },
    { file: 'references/background.md', label: 'background · 背景知识' },
    { file: 'references/12-style-presets.md', label: '12 · 风格倾向' },
  ],
  download_url: '#',
  download_note: LITE_STUB_MSG,
}

export const SKILL_LOCKED_FILES = [
  {
    path: 'SKILL.md',
    label: 'SKILL.md',
    kind: 'locked' as const,
    why: '九步管线 + 6 道门禁 + 管线铁律。改了会破坏流程与产物有效性，故锁定。',
    body: `# ai-slide-producer\n主管线：Intake → Context Pack → Outline → Slide Plan → Review → Design → Render → QA → Delivery`,
  },
  {
    path: 'schemas/slide_plan.schema.json',
    label: 'slide_plan.schema.json',
    kind: 'locked' as const,
    why: '产物结构契约。layout_type 必须取自固定枚举，否则渲染器无法拼装。',
    body: '{ "deck_meta": { ... }, "pages": [ ... ] }',
  },
  {
    path: 'scripts/build_html.py',
    label: 'build_html.py · 渲染机制',
    kind: 'locked' as const,
    why: '模板 + 占位符替换 + layout 片段拼接。属执行机制，改了会破坏渲染。',
    body: '# 读 slide_plan.json + style_lock.json → 输出 index.html',
  },
]
