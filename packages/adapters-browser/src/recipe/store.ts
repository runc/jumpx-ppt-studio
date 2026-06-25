import type { SkillFileData } from '@jumpx/forge-assets'
import type { RecipeManifest } from '@jumpx/ports'
import JSZip from 'jszip'
import { BG_TEMPLATE, CONTRACT_VERSION, EDITABLE, META_FIELDS, RECIPE_CHANGED_EVENT } from './constants.js'
import {
  buildSeedRecipes,
  cloneFiles,
  ensureBackground,
  mergeManifestMeta,
  recipeToSkillFiles,
  activeSkillMount,
  type RecipeRecord,
  uniqueId,
} from './skill-bridge.js'
import { assertEditablePath, validateRecipeFiles } from './validate.js'

const DB_NAME = 'aiartifacts-slide-studio-recipes'
const DB_VERSION = 1
const STORE = 'recipes'
const META_STORE = 'meta'
const ACTIVE_KEY = 'active'
const SEEDED_KEY = 'seeded'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
    }
    req.onsuccess = () => resolve(req.result)
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB tx failed'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB tx aborted'))
  })
}

async function getMeta(key: string): Promise<string | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const req = tx.objectStore(META_STORE).get(key)
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(META_STORE, 'readwrite')
  tx.objectStore(META_STORE).put(value, key)
  await txDone(tx)
}

async function putRecipe(rec: RecipeRecord): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(rec)
  await txDone(tx)
}

async function getRecipe(id: string): Promise<RecipeRecord | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as RecipeRecord | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function listAllRecipes(): Promise<RecipeRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as RecipeRecord[]) || [])
    req.onerror = () => reject(req.error)
  })
}

export function notifyRecipeChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RECIPE_CHANGED_EVENT))
  }
}

export async function ensureRecipeStoreSeeded(
  baseSkillFiles: Record<string, SkillFileData>,
): Promise<void> {
  const seeded = await getMeta(SEEDED_KEY)
  if (seeded === '1') return
  const seeds = buildSeedRecipes(baseSkillFiles)
  for (const rec of seeds) {
    await putRecipe(rec)
  }
  await setMeta(ACTIVE_KEY, 'default')
  await setMeta(SEEDED_KEY, '1')
}

export async function getActiveRecipeId(): Promise<string> {
  return (await getMeta(ACTIVE_KEY)) || 'default'
}

export async function setActiveRecipeId(id: string): Promise<void> {
  const rec = await getRecipe(id)
  if (!rec?.files['SKILL.md']) throw new Error(`配方不存在或无效: ${id}`)
  await setMeta(ACTIVE_KEY, id)
  notifyRecipeChanged()
}

export async function listRecipeManifests(): Promise<{
  recipes: RecipeManifest[]
  active: string
  contract_version: string
  editable: string[]
}> {
  const all = await listAllRecipes()
  const active = await getActiveRecipeId()
  return {
    recipes: all.map((r) => r.manifest).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    active,
    contract_version: CONTRACT_VERSION,
    editable: [...EDITABLE],
  }
}

export async function getRecipeDetail(id: string) {
  const rec = await getRecipe(id)
  if (!rec) throw new Error(`未知配方：${id}`)
  const editable: Record<string, string> = {}
  for (const p of EDITABLE) {
    editable[p] = rec.files[p] ?? ''
  }
  const validate = validateRecipeFiles(rec.files, rec.manifest)
  return { manifest: rec.manifest, editable, validate }
}

export async function saveRecipe(
  id: string,
  body: {
    files?: Record<string, string>
    name?: string
    density?: number
    narrative?: string
    voice?: string
    absorb?: string[]
  },
) {
  const rec = await getRecipe(id)
  if (!rec) throw new Error(`未知配方：${id}`)

  if (body.files) {
    for (const [rel, content] of Object.entries(body.files)) {
      assertEditablePath(rel)
      rec.files[rel] = content
    }
  }
  rec.manifest = mergeManifestMeta(rec.manifest, body)
  ensureBackground(rec.files)

  const validate = validateRecipeFiles(rec.files, rec.manifest)
  if (!validate.ok) {
    return { validate, rejected_locked: [], manifest: rec.manifest }
  }
  await putRecipe(rec)
  notifyRecipeChanged()
  return { validate, manifest: rec.manifest }
}

export async function forkRecipe(id: string, name?: string) {
  const src = await getRecipe(id)
  if (!src) throw new Error(`源配方无效: ${id}`)
  const all = await listAllRecipes()
  const taken = new Set(all.map((r) => r.id))
  const newId = uniqueId((name || src.manifest.name || id) + '-fork', taken)
  const files = cloneFiles(src.files)
  ensureBackground(files)
  const manifest: RecipeManifest = {
    ...src.manifest,
    id: newId,
    name: (name || String(src.manifest.name || id)) + ' · 副本',
    author: 'user',
    tag: '我的',
    contract_version: CONTRACT_VERSION,
  }
  await putRecipe({ id: newId, manifest, files })
  notifyRecipeChanged()
  return { id: newId, manifest }
}

function findRecipeRoot(paths: string[]): string {
  if (paths.some((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md'))) {
    const skill = paths.find((p) => p.endsWith('SKILL.md'))
    if (skill === 'SKILL.md') return ''
    if (skill) return skill.slice(0, -'SKILL.md'.length).replace(/\/$/, '')
  }
  return ''
}

export async function importRecipeZip(bytes: ArrayBuffer, name?: string) {
  const zip = await JSZip.loadAsync(bytes)
  const entries: { path: string; content: string }[] = []
  await Promise.all(
    Object.keys(zip.files).map(async (path) => {
      const ent = zip.files[path]
      if (!ent.dir) {
        entries.push({ path: path.replace(/\\/g, '/'), content: await ent.async('string') })
      }
    }),
  )
  const paths = entries.map((e) => e.path)
  const root = findRecipeRoot(paths)
  const prefix = root ? root + '/' : ''

  const all = await listAllRecipes()
  const taken = new Set(all.map((r) => r.id))
  const newId = uniqueId(name || 'imported', taken)

  const base = await getRecipe('default')
  if (!base) throw new Error('内置配方未初始化')
  const files = cloneFiles(base.files)
  const ignored: string[] = []

  let um: RecipeManifest = {}
  for (const { path, content } of entries) {
    if (!path.startsWith(prefix)) continue
    const rel = path.slice(prefix.length)
    if (!rel || rel.startsWith('__MACOSX')) continue
    if (rel === 'manifest.json') {
      try {
        um = JSON.parse(content) as RecipeManifest
      } catch {
        um = {}
      }
      continue
    }
    if ((EDITABLE as readonly string[]).includes(rel)) {
      files[rel] = content
    } else if (rel !== 'SKILL.md' && !rel.startsWith('schemas/')) {
      ignored.push(`${rel}（锁定区，已忽略）`)
    }
  }
  ensureBackground(files)
  const manifest: RecipeManifest = {
    id: newId,
    name: um.name || name || '导入的配方',
    version: um.version || '1',
    author: um.author || 'imported',
    contract_version: CONTRACT_VERSION,
    editable: [...EDITABLE],
    density: typeof um.density === 'number' ? um.density : 1,
    persona: um.persona || '导入的配方',
    domain: Array.isArray(um.domain) ? um.domain : [],
    voice: um.voice || '',
    tag: '已导入',
    narrative: um.narrative,
    absorb: um.absorb,
  }
  const validate = validateRecipeFiles(files, manifest)
  await putRecipe({ id: newId, manifest, files })
  notifyRecipeChanged()
  return { id: newId, manifest, ignored_locked: ignored, validate }
}

export async function exportRecipeZip(id: string): Promise<Blob> {
  const rec = await getRecipe(id)
  if (!rec) throw new Error(`配方无效: ${id}`)
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(rec.manifest, null, 2))
  for (const [rel, content] of Object.entries(rec.files)) {
    if (rel.startsWith('references/') || rel === 'SKILL.md' || rel.startsWith('schemas/')) {
      zip.file(rel, content)
    }
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function loadActiveRecipeSkillBundle(
  baseSkillFiles: Record<string, SkillFileData>,
): Promise<{ skillFiles: Record<string, SkillFileData>; skillsMount: string; recipeId: string }> {
  await ensureRecipeStoreSeeded(baseSkillFiles)
  const id = await getActiveRecipeId()
  const rec = await getRecipe(id)
  if (!rec) {
    return {
      skillFiles: baseSkillFiles,
      skillsMount: '/skills/ai-slide-producer',
      recipeId: 'default',
    }
  }
  return {
    skillFiles: recipeToSkillFiles(id, rec.files),
    skillsMount: activeSkillMount(id),
    recipeId: id,
  }
}