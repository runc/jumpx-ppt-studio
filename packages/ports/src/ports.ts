import type {
  AgentStream,
  ExportFormat,
  PresetMeta,
  ProvidersState,
  ProviderKind,
  RecipeManifest,
  SkillOverview,
  SlidePlanPage,
  StyleEntry,
  ValidateResult,
} from './types.js'

export interface RunListItem {
  id: string
  title: string
  pages: number
  has_html: boolean
  createdAt: number
  topic?: string
}

export interface RunSnapshot {
  id: string
  title: string
  topic?: string
  html: string | null
  plan: { pages: SlidePlanPage[] } | null
  createdAt: number
  updatedAt: number
}

export interface RunPreviewPort {
  getRunSlug(stream: AgentStream | null): string | null
  getPlan(slug: string, stream?: AgentStream | null): Promise<{ pages: SlidePlanPage[] } | null>
  getPreviewUrl(slug: string, stream?: AgentStream | null): Promise<string | null>
  downloadHtml(slug: string, stream?: AgentStream | null, filename?: string): Promise<void>
  /** Lite：IndexedDB 历史（Studio 无此能力） */
  list?(): Promise<RunListItem[]>
  getStored?(id: string): Promise<RunSnapshot | null>
  saveSnapshot?(snapshot: RunSnapshot): Promise<void>
}

export interface PresetCatalogPort {
  list(): Promise<PresetMeta[]>
}

export interface SettingsPort {
  get(): Promise<ProvidersState>
  save(
    partial: Partial<
      ProvidersState & {
        text?: { api_key?: string }
        image?: { api_key?: string }
      }
    >,
  ): Promise<ProvidersState>
  test(body: {
    kind: ProviderKind
    provider: string
    api_key: string
    base_url?: string
    model?: string
  }): Promise<{ ok: boolean; message: string }>
}

export interface RecipeStorePort {
  list(): Promise<{
    recipes: RecipeManifest[]
    active: string
    contract_version: string
    editable: string[]
  }>
  get(id: string): Promise<{
    manifest: RecipeManifest
    editable: Record<string, string>
    validate: ValidateResult
  }>
  save(
    id: string,
    body: { files?: Record<string, string>; name?: string; density?: number },
  ): Promise<{ validate: ValidateResult; rejected_locked?: string[]; manifest?: RecipeManifest }>
  fork(id: string, name?: string): Promise<{ id: string; manifest?: RecipeManifest }>
  setActive(id: string): Promise<void>
  importZip(bytes: ArrayBuffer, name?: string): Promise<{
    id: string
    manifest?: RecipeManifest
    ignored_locked?: string[]
    validate?: ValidateResult
  }>
  exportZip(id: string): Promise<Blob>
  revalidateAll?(): Promise<{ ok: boolean; results?: unknown[] }>
}

export interface MaterialParserPort {
  extractText(file: File): Promise<{
    text: string
    chars: number
    truncated: boolean
    error?: string
  }>
}

export interface StyleImportPort {
  list(): Promise<{ styles: StyleEntry[] }>
  importFromImages(
    images: { dataUrl: string }[],
    label: string,
  ): Promise<{ ok?: boolean; error?: string; style?: StyleEntry; [key: string]: unknown }>
}

export interface ExportPort {
  supported(): ExportFormat[]
  exportRun(slug: string, format: ExportFormat, stream?: AgentStream | null): Promise<Blob>
}

export interface SkillDocsPort {
  overview(): Promise<SkillOverview>
  readReference(name: string): Promise<string>
  /** Lite：导出 sync:skill 内置 zip */
  exportZip?(): Promise<Blob>
}

export interface HttpClientPort {
  fetch(input: string, init?: RequestInit): Promise<Response>
}

export type AppPorts = {
  run: RunPreviewPort
  presets: PresetCatalogPort
  settings: SettingsPort
  recipes: RecipeStorePort
  materials: MaterialParserPort
  styles: StyleImportPort
  export: ExportPort
  skill: SkillDocsPort
  http?: HttpClientPort
}
