/** UI 层消费的 agent 流最小集合（Studio useStream / Lite useBrowserAgent 均适配到此形状） */

export type Todo = {
  id?: string
  content?: string
  title?: string
  status?: 'pending' | 'in_progress' | 'completed' | string
}

export type FileEntry = {
  content?: string | string[]
}

export type AgentStream = {
  messages: unknown[]
  values: { todos?: Todo[]; files?: Record<string, FileEntry> }
  interrupt: unknown | null
  isLoading: boolean
  error: string | null
  awaitingUser: boolean
  htmlPreview?: string | null
  markOutlineGateResolved?: () => void
  resetSession?: () => void
  stop?: () => void
  submit: (
    input: { messages?: { type?: string; role?: string; content: string }[] } | null,
    opts?: { command?: { resume?: unknown } },
  ) => Promise<void>
}

export type InterruptInfo = {
  name: string
  args: Record<string, unknown>
  description?: string
}

export type StartRunOpts = {
  len?: string
  aud?: string
  tone?: string
  style?: string
  material?: string
}

export type SlidePlanPage = {
  page_title?: string
  title?: string
  key_message?: string
  on_slide_text?: {
    headline?: string
    sub_headline?: string
    body?: string[]
    caption?: string
  }
  speaker_notes?: string
  layout_type?: string
}

export type PresetMeta = {
  id: string
  display_name: string
  mood: string
  thumbs: string[]
}

export type ProviderKind = 'text' | 'image'
export type ImageProvider = 'none' | 'mock' | 'openai' | 'gemini' | 'jimeng' | string

export type ProvidersState = {
  text: {
    provider: string
    base_url: string
    model: string
    api_key_set: boolean
  }
  image: {
    provider: ImageProvider
    base_url: string
    model: string
    api_key_set: boolean
  }
  tenancy: 'local' | 'shared'
}

export type RecipeManifest = {
  id: string
  name?: string
  version?: string
  author?: string
  contract_version?: string
  [key: string]: unknown
}

export type ValidateResult = {
  ok?: boolean
  errors?: string[]
  warnings?: string[]
  [key: string]: unknown
}

export type ExportFormat = 'pdf' | 'png' | 'pptx' | 'html'

export type SkillOverview = {
  name?: string
  version?: string
  files?: { path: string; title?: string }[]
  [key: string]: unknown
}

export type StyleEntry = {
  id: string
  name?: string
  label?: string
  [key: string]: unknown
}
