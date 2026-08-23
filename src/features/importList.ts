import { describeError } from '../lib/http'
import { normalizeName } from '../lib/text'
import { geocodingProvider } from '../providers'
import type { GeocodeResult } from '../providers/types'
import type { BoundingBox } from '../types'

export type ImportStatus = 'pending' | 'searching' | 'found' | 'ambiguous' | 'not-found' | 'error' | 'skipped'

export interface ImportRow {
  id: string
  /** The raw line the user pasted. */
  query: string
  status: ImportStatus
  candidates: GeocodeResult[]
  /** The candidate that will be imported, if any. */
  selected?: GeocodeResult
  error?: string
}

export function parseImportList(raw: string): string[] {
  return raw
    .split(/\r?\n|;/)
    .map((line) =>
      line
        // tolerate "1. Place", "- Place", "* Place"
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
        .trim(),
    )
    .filter((line) => line.length > 1)
    .filter((line, index, all) => all.findIndex((l) => normalizeName(l) === normalizeName(line)) === index)
}

/**
 * Decides whether a set of candidates is unambiguous.
 * A single result, or an exact name match that no other candidate shares,
 * counts as found; anything else is handed back to the user to resolve.
 */
export function classify(query: string, candidates: GeocodeResult[]): {
  status: ImportStatus
  selected?: GeocodeResult
} {
  if (candidates.length === 0) return { status: 'not-found' }
  if (candidates.length === 1) return { status: 'found', selected: candidates[0] }

  const target = normalizeName(query)
  const exact = candidates.filter((c) => normalizeName(c.name) === target)
  if (exact.length === 1) return { status: 'found', selected: exact[0] }

  // A clearly dominant result (Nominatim importance) is good enough.
  const [first, second] = candidates
  if (
    first.importance !== undefined &&
    second.importance !== undefined &&
    first.importance - second.importance > 0.15 &&
    normalizeName(first.name).includes(target.split(' ')[0])
  ) {
    return { status: 'found', selected: first }
  }

  return { status: 'ambiguous', selected: candidates[0] }
}

export interface RunImportOptions {
  viewbox?: BoundingBox
  signal?: AbortSignal
  onProgress: (row: ImportRow) => void
}

/**
 * Resolves each pasted line one at a time. Requests are serialised by the
 * provider's own rate-limited queue, so a 40-line list is polite by design.
 */
export async function runImport(rows: ImportRow[], options: RunImportOptions): Promise<void> {
  for (const row of rows) {
    if (options.signal?.aborted) return
    if (row.status !== 'pending') continue
    options.onProgress({ ...row, status: 'searching' })
    try {
      const candidates = await geocodingProvider.search({
        query: row.query,
        limit: 6,
        viewbox: options.viewbox,
        signal: options.signal,
      })
      const { status, selected } = classify(row.query, candidates)
      options.onProgress({ ...row, status, candidates, selected })
    } catch (error) {
      if (options.signal?.aborted) return
      options.onProgress({
        ...row,
        status: 'error',
        candidates: [],
        error: describeError(error),
      })
    }
  }
}

export const STATUS_META: Record<ImportStatus, { icon: string; label: string; className: string }> = {
  pending: { icon: '•', label: 'Queued', className: 'text-slate-400' },
  searching: { icon: '⋯', label: 'Searching', className: 'text-sky-600' },
  found: { icon: '✓', label: 'Found', className: 'text-emerald-600' },
  ambiguous: { icon: '⚠️', label: 'Ambiguous', className: 'text-amber-600' },
  'not-found': { icon: '✕', label: 'Not found', className: 'text-rose-600' },
  error: { icon: '!', label: 'Error', className: 'text-rose-600' },
  skipped: { icon: '–', label: 'Skipped', className: 'text-slate-400' },
}
