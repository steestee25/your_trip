import { useState } from 'react'
import { placeInputFromResult } from '../../features/placeFromResult'
import { cx } from '../../lib/cx'
import { boundsOf, boxRadius, formatDistance, hasCoords, padBox } from '../../lib/geo'
import { describeError } from '../../lib/http'
import { discoveryProvider } from '../../providers'
import { OVERPASS_CATEGORIES } from '../../providers/overpass'
import type { DiscoveredPlace } from '../../providers/types'
import { categoryById } from '../../state/categories'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { BoundingBox, Place } from '../../types'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Spinner } from '../ui/Spinner'

const DEFAULT_SELECTION = ['attractions', 'museums', 'historic', 'nature']

/**
 * Optional Overpass lookup for places that exist in OpenStreetMap but are not
 * in the user's list yet. Strictly user-triggered — one query per press.
 */
export function NearbyDiscovery({ place }: { place: Place }) {
  const { trip, data, dispatch } = useStore()
  const { pushToast } = useUi()
  const [categories, setCategories] = useState<string[]>(DEFAULT_SELECTION)
  const [results, setResults] = useState<DiscoveredPlace[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])

  if (!data.settings.useOverpass) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-slate-500">
        Overpass discovery is switched off in Trip settings.
      </p>
    )
  }
  if (!hasCoords(place)) return null

  const box = boxFor(place)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const found = await discoveryProvider.discover({ boundingBox: box, categories, limit: 60 })
      const existing = new Set(
        trip.places.map((p) => (p.sources ?? []).map((s) => s.ref).join('|')).filter(Boolean),
      )
      setResults(found.filter((r) => !existing.has(r.sources.map((s) => s.ref).join('|'))))
      if (found.length === 0) setError('Nothing matching those categories is mapped in this area.')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-2 border-t border-slate-100 pt-3">
      <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
        Discover places from OpenStreetMap
      </h3>
      <p className="text-[11.5px] leading-snug text-slate-500">
        Searches an area of about {formatDistance(boxRadius(box) * 2)} across. One request, results cached for a
        week.
      </p>

      <div className="flex flex-wrap gap-1">
        {OVERPASS_CATEGORIES.map((id) => {
          const category = categoryById(trip.categories, id)
          return (
            <Chip
              key={id}
              color={category.color}
              active={categories.includes(id)}
              onClick={() =>
                setCategories((current) =>
                  current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
                )
              }
            >
              {category.emoji} {category.name}
            </Chip>
          )
        })}
      </div>

      <Button size="sm" variant="primary" onClick={() => void run()} disabled={loading || categories.length === 0}>
        {loading ? <Spinner className="h-3.5 w-3.5" /> : 'Find nearby places'}
      </Button>

      {error && <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] text-amber-800">{error}</p>}

      {results && results.length > 0 && (
        <ul className="scroll-thin max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {results.map((result) => {
            const isAdded = added.includes(result.id)
            const category = categoryById(trip.categories, result.suggestedCategory)
            return (
              <li key={result.id} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="text-[13px]">{category.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-slate-700">{result.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {result.rawType}
                    {result.distanceMeters !== undefined && ` · ${formatDistance(result.distanceMeters)}`}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isAdded}
                  onClick={() => {
                    dispatch({
                      type: 'places/add',
                      input: placeInputFromResult(result, { parentPlaceId: place.id }),
                    })
                    setAdded((current) => [...current, result.id])
                    pushToast(`${result.name} added to your Inbox`, 'success')
                  }}
                  className={cx(
                    'shrink-0 rounded-md px-1.5 py-1 text-[10.5px] font-semibold transition-colors',
                    isAdded
                      ? 'text-emerald-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-brand-100 hover:text-brand-800',
                  )}
                >
                  {isAdded ? 'Added' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Use the real bounding box when OSM published one, otherwise a small square. */
function boxFor(place: Place): BoundingBox {
  if (place.boundingBox) return place.boundingBox
  const centre = { latitude: place.latitude as number, longitude: place.longitude as number }
  const fallback = boundsOf([centre]) as BoundingBox
  return padBox(fallback, place.type === 'city' ? 3000 : 1000)
}
