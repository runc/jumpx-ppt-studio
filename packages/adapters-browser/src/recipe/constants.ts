/** 与 backend/recipes.py 对齐 */
export const CONTRACT_VERSION = '1'

export const EDITABLE = [
  'references/02-context-pack.md',
  'references/03-strategist.md',
  'references/05-writer.md',
  'references/background.md',
  'references/12-style-presets.md',
] as const

export const META_FIELDS = [
  'name',
  'persona',
  'domain',
  'voice',
  'tag',
  'density',
  'narrative',
  'absorb',
] as const

export const RECIPE_CHANGED_EVENT = 'aiartifacts-slide-studio-recipe-changed'

export const BG_TEMPLATE = `# 这个配方懂什么
（配方自带、可复用的领域知识；与用户每次输入的素材不同。）
`
