import { useCallback, useRef, useState } from 'react'
import { enrichPlace } from '../../features/enrich'
import { placeInputFromResult } from '../../features/placeFromResult'
import { boundsOf, hasCoords } from '../../lib/geo'
import { describeError } from '../../lib/http'
import { uid } from '../../lib/id'
import { geocodingProvider } from '../../providers'
import type { GeocodeResult } from '../../providers/types'
import { createPlace } from '../../state/factory'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { PlaceType } from '../../types'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Chip'
import { Spinner } from '../ui/Spinner'

export const TYPE_LABEL: Record<PlaceType, string> = {
  poi: 'POI',
  area: 'Area',
  city: 'City',
  activity: 'Activity',
}

export const TYPE_TONE: Record<PlaceType, 'slate' | 'brand' | 'sky' | 'amber'> = {
  poi: 'slate',
  area: 'sky',
  city: 'brand',
  activity: 'amber',
}

export function SearchPanel() {
  const { trip, data, dispatch } = useStore()
  const { pushToast, focusOn, openModal } = useUi()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  /** Bias results towards where the trip already is, without excluding anything. */
  const viewbox = useCallback(() => {
    const points = [
      ...trip.places.filter(hasCoords).map((p) => ({ latitude: p.latitude!, longitude: p.longitude! })),
      ...trip.destinations
        .filter(hasCoords)
        .map((d) => ({ latitude: d.latitude!, longitude: d.longitude! })),
    ]
    return points.length > 0 ? (boundsOf(points) ?? undefined) : undefined
  }, [trip.places, trip.destinations])

  const runSearch = useCallback(async () => {
    const text = query.trim()
    if (text.length < 2) {
      setError('Type at least two characters.')
      return
    }
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    setError(null)
    try {
      const found = await geocodingProvider.search({
        query: text,
        limit: 8,
        viewbox: viewbox(),
        signal: controller.signal,
      })
      setResults(found)
      if (found.length === 0) {
        setError(`No result for “${text}”. Try adding the city, for example “${text}, London”.`)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setError(describeError(err))
      setResults(null)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [query, viewbox])

  const addResult = useCallback(
    (result: GeocodeResult) => {
      // Mint the id up-front so enrichment can patch exactly this place.
      const placeId = uid('place')
      const input = placeInputFromResult(result, { id: placeId })
      dispatch({ type: 'places/add', input })
      pushToast(`${result.name} added to your Inbox`, 'success')
      focusOn({
        bounds: result.boundingBox,
        latitude: result.latitude,
        longitude: result.longitude,
        zoom: result.placeType === 'poi' ? 16 : 13,
      })
      setResults(null)
      setQuery('')

      if (!data.settings.useEnrichment) return
      void enrichPlace(createPlace(input)).then((patch) => {
        if (patch) dispatch({ type: 'places/patch', placeId, patch })
      })
    },
    [dispatch, pushToast, focusOn, data.settings.useEnrichment],
  )

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch()
              if (e.key === 'Escape') {
                setResults(null)
                setError(null)
              }
            }}
            placeholder="British Museum, Richmond, Dover…"
            aria-label="Search for a place"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-8.5 text-sm placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
          />
        </div>
        <Button variant="primary" onClick={() => void runSearch()} disabled={loading} aria-label="Search">
          {loading ? <Spinner /> : 'Search'}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>Press Enter to search — data from OpenStreetMap.</span>
        <button
          type="button"
          onClick={() => openModal({ kind: 'import-list' })}
          className="font-semibold text-brand-700 hover:underline"
        >
          Import a list
        </button>
      </div>

      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-800">{error}</p>}

      {results && results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {results.length} {results.length === 1 ? 'match' : 'matches'} — pick one
            </span>
            <button
              type="button"
              onClick={() => setResults(null)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
            >
              Dismiss
            </button>
          </div>
          <ul className="scroll-thin max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => addResult(result)}
                  onMouseEnter={() =>
                    focusOn({ latitude: result.latitude, longitude: result.longitude, zoom: 13 })
                  }
                  className="w-full px-3 py-2.5 text-left transition-colors hover:bg-brand-50/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-slate-800">{result.name}</span>
                    <Badge tone={TYPE_TONE[result.placeType]}>{TYPE_LABEL[result.placeType]}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">{result.displayName}</div>
                  {result.rawType && (
                    <div className="mt-0.5 text-[10px] tracking-wide text-slate-400 uppercase">{result.rawType}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
