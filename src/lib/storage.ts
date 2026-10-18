/**
 * Browser storage helpers. Never throw (private mode, blocked storage, bad JSON).
 *
 * localStorage is the primary store (synchronous, simple). Every write is also
 * mirrored to IndexedDB. If the browser clears localStorage but keeps IndexedDB,
 * restoreFromMirror() puts the data back on the next start.
 */
const PREFIX = 'pl300.v1.'

export const KEYS = {
  session: 'session',
  history: 'history',
  stats: 'stats',
  setup: 'setup',
  theme: 'theme',
} as const

/* ---------- localStorage ---------- */

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    const raw = JSON.stringify(value)
    localStorage.setItem(PREFIX + key, raw)
    scheduleMirror(key, raw)
  } catch {
    /* storage unavailable or full: the app keeps working in memory */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
  cancelMirror(key)
  void mirrorDelete(key)
}

export function clearAll(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) doomed.push(k)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  Object.keys(pending).forEach(cancelMirror)
  void mirrorClear()
}

/** True when this browser lets us write to localStorage (false in some private modes). */
export function storageAvailable(): boolean {
  try {
    const probe = `${PREFIX}probe`
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/* ---------- IndexedDB mirror ---------- */

const DB_NAME = 'pl300-backup'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await openDb()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
      tx.onabort = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

const pending: Record<string, ReturnType<typeof setTimeout>> = {}

/** Debounced so the per-second quiz timer does not hammer IndexedDB. */
function scheduleMirror(key: string, raw: string): void {
  cancelMirror(key)
  pending[key] = setTimeout(() => {
    delete pending[key]
    void withStore('readwrite', (s) => s.put(raw, key))
  }, 400)
}

function cancelMirror(key: string): void {
  if (pending[key] !== undefined) {
    clearTimeout(pending[key])
    delete pending[key]
  }
}

function mirrorDelete(key: string) {
  return withStore('readwrite', (s) => s.delete(key))
}

function mirrorClear() {
  return withStore('readwrite', (s) => s.clear())
}

async function mirrorGetAll(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const key of Object.values(KEYS)) {
    const raw = await withStore<string>('readonly', (s) => s.get(key) as IDBRequest<string>)
    if (typeof raw === 'string') out[key] = raw
  }
  return out
}

/**
 * Run once at startup, before the app reads anything. Copies mirrored values back
 * into localStorage when the browser dropped them, and seeds the mirror with
 * anything that exists only in localStorage (data saved before the mirror existed).
 */
export async function restoreFromMirror(): Promise<{ restored: string[] }> {
  const restored: string[] = []
  try {
    const mirror = await mirrorGetAll()
    for (const key of Object.values(KEYS)) {
      const local = localStorage.getItem(PREFIX + key)
      if (local === null && key in mirror) {
        localStorage.setItem(PREFIX + key, mirror[key])
        restored.push(key)
      } else if (local !== null && !(key in mirror)) {
        void withStore('readwrite', (s) => s.put(local, key))
      }
    }
  } catch {
    /* ignore: the app still works from localStorage alone */
  }
  return { restored }
}

/* ---------- persistence ---------- */

export interface StorageStatus {
  available: boolean
  /** true: browser promised not to evict; false: may evict under pressure; null: unknown */
  persisted: boolean | null
  mirror: boolean
}

/** Ask the browser not to evict our data. Safe to call repeatedly. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  let persisted: boolean | null = null
  try {
    persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null
  } catch {
    /* ignore */
  }
  return { available: storageAvailable(), persisted, mirror: (await openDb()) !== null }
}

/** Browsers embedded in chat/social apps keep separate, easily wiped storage. */
export function isInAppBrowser(): boolean {
  return typeof navigator !== 'undefined' && /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|Telegram|WhatsApp/i.test(navigator.userAgent)
}
