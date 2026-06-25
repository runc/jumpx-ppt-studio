import type { SlidePlanPage } from '@jumpx/ports'
import { parseSlidePlanFromFiles } from '@jumpx/ports'

const DB_NAME = 'aiartifacts-slide-studio-runs'
const DB_VERSION = 1
const STORE = 'runs'

export type RunListItem = {
  id: string
  title: string
  pages: number
  has_html: boolean
  createdAt: number
  topic?: string
}

export type RunSnapshot = {
  id: string
  title: string
  topic?: string
  html: string | null
  plan: { pages: SlidePlanPage[] } | null
  createdAt: number
  updatedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' })
        os.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
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

export async function saveRunSnapshot(snapshot: RunSnapshot): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(snapshot)
  await txDone(tx)
}

export async function getStoredRun(id: string): Promise<RunSnapshot | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as RunSnapshot | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function listStoredRuns(): Promise<RunListItem[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const rows = (req.result as RunSnapshot[]) || []
      const out = rows.map((r) => ({
        id: r.id,
        title: r.title || r.id,
        pages: r.plan?.pages?.length ?? 0,
        has_html: Boolean(r.html),
        createdAt: r.createdAt,
        topic: r.topic,
      }))
      out.sort((a, b) => b.createdAt - a.createdAt)
      resolve(out)
    }
    req.onerror = () => reject(req.error)
  })
}

export function planFromFiles(
  files: Record<string, { content?: string | string[] }>,
  slug: string,
): { pages: SlidePlanPage[] } | null {
  const parsed = parseSlidePlanFromFiles(files)
  if (parsed) return parsed
  const planKey = Object.keys(files).find(
    (k) => k.includes(slug) && k.endsWith('slide_plan.json'),
  )
  if (planKey) return parseSlidePlanFromFiles({ [planKey]: files[planKey] })
  return null
}

export function titleFromPlan(
  plan: { pages: SlidePlanPage[] } | null,
  topic?: string,
  slug?: string,
): string {
  const meta = (plan as { deck_meta?: { deck_title?: string; title?: string } } | null)?.deck_meta
  return meta?.deck_title || meta?.title || topic?.split('——')[0]?.trim() || slug || '未命名演示'
}
