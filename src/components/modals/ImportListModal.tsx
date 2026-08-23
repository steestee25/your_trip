import { useCallback, useMemo, useRef, useState } from 'react'
import { enrichPlace } from '../../features/enrich'
import { parseImportList, runImport, STATUS_META, type ImportRow } from '../../features/importList'
import { placeInputFromResult } from '../../features/placeFromResult'
import { boundsOf, hasCoords } from '../../lib/geo'
import { cx } from '../../lib/cx'
import { uid } from '../../lib/id'
import { geocodingProvider } from '../../providers'
import type { GeocodeResult } from '../../providers/types'
import { createPlace } from '../../state/factory'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { TextArea } from '../ui/Field'

const SAMPLE = `Covent Garden
British Museum
Dishoom Covent Garden
Sky Garden
Notting Hill
Tower Bridge`

export function ImportListModal({ onClose }: { onClose: () => void }) {
  const { trip, data, dispatch } = useStore()
  const { pushToast } = useUi()
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [running, setRunning] = useState(false)
  const abort = useRef<AbortController | null>(null)

  const viewbox = useMemo(() => {
    const points = [
      ...trip.places.filter(hasCoords).map((p) => ({ latitude: p.latitude!, longitude: p.longitude! })),
      ...trip.destinations.filter(hasCoords).map((d) => ({ latitude: d.latitude!, longitude: d.longitude! })),
    ]
    return points.length > 0 ? (boundsOf(points) ?? undefined) : undefined
  }, [trip.places, trip.destinations])

  const start = useCallback(async () => {
    const queries = parseImportList(raw)
    if (queries.length === 0) {
      pushToast('Paste at least one place, one per line', 'warning')
      return
    }
    const initial: ImportRow[] = queries.map((query) => ({
      id: uid('row'),
      query,
      status: 'pending',
      candidates: [],
    }))
    setRows(initial)
    setRunning(true)
    const controller = new AbortController()
    abort.current = controller

    await runImport(initial, {
      viewbox,
      signal: controller.signal,
      onProgress: (row) => setRows((current) => (current ?? []).map((r) => (r.id === row.id ? row : r))),
    })
    setRunning(false)
  }, [raw, viewbox, pushToast])

  const cancel = () => {
    abort.current?.abort()
    setRunning(false)
  }

  const setRow = (id: string, patch: Partial<ImportRow>) =>
    setRows((current) => (current ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const importable = (rows ?? []).filter((r) => r.selected && r.status !== 'skipped')

  const commit = () => {
    if (importable.length === 0) return
    const inputs = importable.map((row) => placeInputFromResult(row.selected as GeocodeResult, { id: uid('place') }))
    dispatch({ type: 'places/addMany', inputs })
    pushToast(`${inputs.length} ${inputs.length === 1 ? 'place' : 'places'} added to your Inbox`, 'success')

    if (data.settings.useEnrichment) {
      // Enrichment is sequential inside the provider queue; failures are silent.
      void (async () => {
        for (const input of inputs) {
          const patch = await enrichPlace(createPlace(input))
          if (patch && input.id) dispatch({ type: 'places/patch', placeId: input.id, patch })
        }
      })()
    }
    onClose()
  }

  const counts = useMemo(() => {
    const list = rows ?? []
    return {
      found: list.filter((r) => r.status === 'found').length,
      ambiguous: list.filter((r) => r.status === 'ambiguous').length,
      missing: list.filter((r) => r.status === 'not-found' || r.status === 'error').length,
    }
  }, [rows])

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Import a list of places"
      description="Paste one place per line. Each line is looked up on OpenStreetMap, one request per second."
      footer={
        rows ? (
          <>
            <span className="mr-auto text-[12px] text-slate-500">
              {counts.found} found · {counts.ambiguous} ambiguous · {counts.missing} not found
            </span>
            {running ? (
              <Button onClick={cancel}>Stop</Button>
            ) : (
              <Button
                onClick={() => {
                  setRows(null)
                  setRaw('')
                }}
              >
                Start over
              </Button>
            )}
            <Button variant="primary" onClick={commit} disabled={running || importable.length === 0}>
              Add {importable.length || ''} {importable.length === 1 ? 'place' : 'places'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setRaw(SAMPLE)}>Use the example</Button>
            <Button variant="primary" onClick={() => void start()} disabled={raw.trim().length === 0}>
              Search all
            </Button>
          </>
        )
      }
    >
      {!rows ? (
        <div className="space-y-2">
          <TextArea
            rows={10}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={SAMPLE}
            className="font-mono text-[13px]"
          />
          <p className="text-[12px] leading-snug text-slate-500">
            Numbered lists and bullets are handled automatically. Duplicates are removed. A list of{' '}
            {parseImportList(raw).length || 'n'} places takes roughly{' '}
            {Math.max(1, Math.ceil(parseImportList(raw).length * 1.2))} seconds — we deliberately stay within
            Nominatim's one-request-per-second policy.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {rows.map((row) => (
            <ImportRowView key={row.id} row={row} onChange={(patch) => setRow(row.id, patch)} viewbox={viewbox} />
          ))}
        </ul>
      )}
    </Modal>
  )
}

function ImportRowView({
  row,
  onChange,
  viewbox,
}: {
  row: ImportRow
  onChange: (patch: Partial<ImportRow>) => void
  viewbox: ReturnType<typeof boundsOf> | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const [manual, setManual] = useState(row.query)
  const [searching, setSearching] = useState(false)
  const meta = STATUS_META[row.status]

  const retry = async () => {
    setSearching(true)
    try {
      const candidates = await geocodingProvider.search({ query: manual, limit: 6, viewbox: viewbox ?? undefined })
      onChange({
        candidates,
        status: candidates.length === 0 ? 'not-found' : candidates.length === 1 ? 'found' : 'ambiguous',
        selected: candidates[0],
        error: undefined,
      })
      setExpanded(true)
    } catch {
      onChange({ status: 'error', error: 'Search failed. Try again in a moment.' })
    } finally {
      setSearching(false)
    }
  }

  const needsAttention = row.status === 'ambiguous' || row.status === 'not-found' || row.status === 'error'

  return (
    <li className={cx('px-3 py-2', needsAttention && 'bg-amber-50/40')}>
      <div className="flex items-center gap-2">
        <span className={cx('w-4 shrink-0 text-center text-[13px] font-bold', meta.className)}>
          {row.status === 'searching' ? <Spinner className="h-3.5 w-3.5" /> : meta.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-slate-800">{row.query}</div>
          <div className="truncate text-[11px] text-slate-500">
            {row.selected ? row.selected.displayName : (row.error ?? meta.label)}
          </div>
        </div>

        {(row.candidates.length > 1 || needsAttention) && row.status !== 'searching' && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-md bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {expanded ? 'Close' : row.candidates.length > 1 ? `Choose (${row.candidates.length})` : 'Fix'}
          </button>
        )}

        {row.selected && (
          <button
            type="button"
            onClick={() => onChange({ status: row.status === 'skipped' ? 'found' : 'skipped' })}
            title={row.status === 'skipped' ? 'Include this place' : 'Skip this place'}
            className={cx(
              'shrink-0 rounded-md px-1.5 py-1 text-[11px] font-semibold',
              row.status === 'skipped'
                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
            )}
          >
            {row.status === 'skipped' ? 'Include' : 'Skip'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
          {row.candidates.length > 0 && (
            <ul className="space-y-1">
              {row.candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ selected: candidate, status: 'found' })}
                    className={cx(
                      'w-full rounded-lg border px-2 py-1.5 text-left transition-colors',
                      row.selected?.id === candidate.id
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold text-slate-800">{candidate.name}</span>
                      <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-500 uppercase">
                        {candidate.placeType}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-slate-500">{candidate.displayName}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-1.5">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void retry()}
              placeholder="Refine the search, e.g. “Dishoom, Covent Garden, London”"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[12px] focus:border-brand-600 focus:outline-none"
            />
            <Button size="sm" onClick={() => void retry()} disabled={searching}>
              {searching ? <Spinner className="h-3.5 w-3.5" /> : 'Search again'}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
