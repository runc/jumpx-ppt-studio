export const REAL_PRESETS = [
  'teaching-clean',
  'editorial-magazine',
  'swiss-system',
  'blueprint',
  'sketch-notes',
  'corporate',
  'creator-social',
] as const

export const PRESET_DISPLAY: Record<string, { display_name: string; mood: string }> = {
  'teaching-clean': { display_name: '教学清爽', mood: '清晰、友好、课堂感' },
  'editorial-magazine': { display_name: '杂志编辑', mood: '观点、叙事、杂志排版' },
  'swiss-system': { display_name: '瑞士系统', mood: '网格、理性、极简' },
  'blueprint': { display_name: '蓝图', mood: '技术、结构、工程感' },
  'sketch-notes': { display_name: '手绘笔记', mood: '轻松、手绘、白板' },
  corporate: { display_name: '企业商务', mood: '稳重、汇报、商务' },
  'creator-social': { display_name: '创作者社交', mood: '活泼、社交、传播' },
}
