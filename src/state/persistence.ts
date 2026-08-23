import { openDB, type IDBPDatabase } from 'idb'
import type { AppData } from '../types'

const DB_NAME = 'universal-trip-planner'
const DB_VERSION = 1
const STORE = 'state'
const KEY = 'app'
const LS_KEY = 'utp.state.v1'

let dbPromise: Promise<IDBPDatabase | null> | null = null

function getDb(): Promise<IDBPDatabase | null> {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        if (typeof indexedDB === 'undefined') return null
        return await openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
          },
        })
      } catch {
        // Private browsing modes can reject IndexedDB entirely.
        return null
      }
    })()
  }
  return dbPromise
}

/** Reads persisted state. IndexedDB first, localStorage as a fallback. */
export async function loadState(): Promise<AppData | null> {
  try {
    const db = await getDb()
    if (db) {
      const value = (await db.get(STORE, KEY)) as AppData | undefined
      if (value) return value
    }
  } catch {
    /* fall through to localStorage */
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as AppData
  } catch {
    /* corrupt or unavailable */
  }
  return null
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Writes to IndexedDB and mirrors into localStorage as a cheap backup. */
export async function saveState(data: AppData): Promise<void> {
  let stored = false
  try {
    const db = await getDb()
    if (db) {
      await db.put(STORE, data, KEY)
      stored = true
    }
  } catch {
    /* try localStorage below */
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    stored = true
  } catch {
    /* quota exceeded — IndexedDB may still have succeeded */
  }
  if (!stored) throw new Error('Could not save locally: browser storage is unavailable.')
}

export async function clearState(): Promise<void> {
  try {
    const db = await getDb()
    if (db) await db.delete(STORE, KEY)
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

/** Rough size of the persisted document, for the storage indicator. */
export function estimateSize(data: AppData): number {
  try {
    return new Blob([JSON.stringify(data)]).size
  } catch {
    return 0
  }
}
