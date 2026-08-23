/**
 * Tiny persistent response cache. Public geocoding endpoints ask us not to
 * repeat identical queries, so every provider result lands here first.
 * localStorage is used on purpose: it is synchronous, tiny and survives reloads.
 */
const PREFIX = 'utp.cache.'
const INDEX_KEY = 'utp.cache.index'
const MAX_ENTRIES = 500

interface Entry<T> {
  value: T
  expiresAt: number
}

const memory = new Map<string, Entry<unknown>>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readIndex(): string[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(INDEX_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeIndex(keys: string[]): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(INDEX_KEY, JSON.stringify(keys))
  } catch {
    /* quota — ignore */
  }
}

function touchIndex(key: string): void {
  const keys = readIndex().filter((k) => k !== key)
  keys.push(key)
  while (keys.length > MAX_ENTRIES) {
    const oldest = keys.shift()
    if (oldest) {
      memory.delete(oldest)
      storage()?.removeItem(PREFIX + oldest)
    }
  }
  writeIndex(keys)
}

export function cacheGet<T>(key: string): T | undefined {
  const hit = memory.get(key) as Entry<T> | undefined
  if (hit) {
    if (hit.expiresAt > Date.now()) return hit.value
    memory.delete(key)
  }
  const s = storage()
  if (!s) return undefined
  try {
    const raw = s.getItem(PREFIX + key)
    if (!raw) return undefined
    const entry = JSON.parse(raw) as Entry<T>
    if (entry.expiresAt <= Date.now()) {
      s.removeItem(PREFIX + key)
      return undefined
    }
    memory.set(key, entry)
    return entry.value
  } catch {
    return undefined
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const entry: Entry<T> = { value, expiresAt: Date.now() + ttlMs }
  memory.set(key, entry)
  const s = storage()
  if (!s) return
  try {
    s.setItem(PREFIX + key, JSON.stringify(entry))
    touchIndex(key)
  } catch {
    // Out of quota: drop the oldest half and give up silently on failure.
    const keys = readIndex()
    for (const k of keys.slice(0, Math.ceil(keys.length / 2))) {
      s.removeItem(PREFIX + k)
      memory.delete(k)
    }
    writeIndex(keys.slice(Math.ceil(keys.length / 2)))
    try {
      s.setItem(PREFIX + key, JSON.stringify(entry))
      touchIndex(key)
    } catch {
      /* still no room — memory cache only */
    }
  }
}

/** Cache-aside helper: identical in-flight requests share one promise. */
const inflight = new Map<string, Promise<unknown>>()

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== undefined) return hit
  const running = inflight.get(key) as Promise<T> | undefined
  if (running) return running
  const promise = load()
    .then((value) => {
      cacheSet(key, value, ttlMs)
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, promise)
  return promise
}

export function clearCache(): void {
  memory.clear()
  const s = storage()
  if (!s) return
  for (const key of readIndex()) s.removeItem(PREFIX + key)
  s.removeItem(INDEX_KEY)
}

export function cacheSize(): number {
  return readIndex().length
}

export const DAY_MS = 24 * 60 * 60 * 1000
