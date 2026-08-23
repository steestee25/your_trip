import { useMemo, useState } from 'react'
import { enrichPlace } from '../../features/enrich'
import { placesNear } from '../../features/suggestions'
import { cx } from '../../lib/cx'
import { formatDistance, haversine, hasCoords } from '../../lib/geo'
import { describeError } from '../../lib/http'
import { formatDurationMinutes } from '../../lib/time'
import { geocodingProvider } from '../../providers'
import { categoryById } from '../../state/categories'
import { plannedPlaceIds } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { Place, PlacePatch, PlaceType, Priority } from '../../types'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Chip'
import { TextArea } from '../ui/Field'
import { Spinner } from '../ui/Spinner'
import { NearbyDiscovery } from './NearbyDiscovery'

const TYPES: Array<{ id: PlaceType; label: string; hint: string }> = [
  { id: 'poi', label: 'POI', hint: 'A specific point: a museum, a restaurant, a bridge.' },
  { id: 'area', label: 'Area', hint: 'A neighbourhood or district you spend time in.' },
  { id: 'city', label: 'City', hint: 'A whole town or city, e.g. a day trip.' },
  { id: 'activity', label: 'Activity', hint: 'Lunch, shopping, free time — no fixed point needed.' },
]

const PRIORITIES: Array<{ id: Priority; label: string; className: string }> = [
  { id: 'high', label: 'High', className: 'bg-rose-500' },
  { id: 'medium', label: 'Medium', className: 'bg-amber-500' },
  { id: 'low', label: 'Low', className: 'bg-slate-400' },
]

const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 360, 480]

export function PlaceDetail() {
  const { trip, data, dispatch } = useStore()
  const { selectedPlaceId, selectPlace, focusOn, pushToast } = useUi()
  const [tab, setTab] = useState<'details' | 'nearby'>('details')
  const [busy, setBusy] = useState<string | null>(null)

  const place = trip.places.find((p) => p.id === selectedPlaceId)
  const planned = useMemo(() => plannedPlaceIds(trip), [trip])
  const nearby = useMemo(
    () => (place && (place.type === 'area' || place.type === 'city') ? placesNear(trip, place) : []),
    [trip, place],
  )

  if (!place) return null

  const category = categoryById(trip.categories, place.category)
  const patch = (changes: PlacePatch) => dispatch({ type: 'places/patch', placeId: place.id, patch: changes })

  const dayItems = trip.items.filter((item) => item.placeId === place.id)

  const locate = async () => {
    setBusy('locate')
    try {
      const results = await geocodingProvider.search({ query: place.name, limit: 1 })
      if (results.length === 0) {
        pushToast(`No location found for “${place.name}”. Try renaming it with the city.`, 'warning')
        return
      }
      const found = results[0]
      patch({
        latitude: found.latitude,
        longitude: found.longitude,
        address: found.address,
        city: found.city,
        country: found.country,
        boundingBox: found.boundingBox,
        geometry: found.geometry,
        sources: [...(place.sources ?? []), ...found.sources],
      })
      focusOn({ latitude: found.latitude, longitude: found.longitude, zoom: 15 })
      pushToast('Location found', 'success')
    } catch (error) {
      pushToast(describeError(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const enrich = async () => {
    setBusy('enrich')
    const result = await enrichPlace(place)
    setBusy(null)
    if (result) {
      dispatch({ type: 'places/patch', placeId: place.id, patch: result })
      pushToast('Details updated from Wikipedia / Wikidata', 'success')
    } else {
      pushToast('No extra information is published for this place.', 'info')
    }
  }

  return (
    <aside className="pointer-events-auto flex h-full w-full flex-col overflow-hidden bg-white shadow-panel md:w-96 md:rounded-2xl md:border md:border-slate-200">
      {/* ------------------------------------------------------------ header */}
      <header className="relative shrink-0">
        {place.imageUrl && (
          <div className="h-32 w-full overflow-hidden bg-slate-100">
            <img
              src={place.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.parentElement?.remove()
              }}
            />
          </div>
        )}
        <div className="flex items-start gap-2 px-3 pt-3 pb-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[18px]"
            style={{ background: `${category.color}1f` }}
          >
            {category.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <input
              value={place.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="w-full rounded-md border border-transparent px-1 py-0.5 text-[15px] leading-tight font-bold text-slate-900 hover:border-slate-200 focus:border-brand-600 focus:outline-none"
            />
            <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1">
              <Badge tone={place.type === 'poi' ? 'slate' : place.type === 'city' ? 'brand' : 'sky'}>
                {place.type}
              </Badge>
              {place.rawType && <span className="text-[10px] text-slate-400 uppercase">{place.rawType}</span>}
              {planned.has(place.id) && <Badge tone="emerald">planned</Badge>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectPlace(null)}
            aria-label="Close"
            className="-mt-0.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {(place.type === 'area' || place.type === 'city') && (
          <div className="flex border-b border-slate-200 px-3">
            <TabButton active={tab === 'details'} onClick={() => setTab('details')}>
              Details
            </TabButton>
            <TabButton active={tab === 'nearby'} onClick={() => setTab('nearby')}>
              Nearby ({nearby.length})
            </TabButton>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- body */}
      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {tab === 'nearby' && (place.type === 'area' || place.type === 'city') ? (
          <NearbyPanel place={place} nearby={nearby} />
        ) : (
          <>
            {/* location ------------------------------------------------- */}
            <section className="space-y-1 text-[12px] leading-relaxed text-slate-600">
              {place.address && <div>{place.address}</div>}
              {(place.city || place.country) && (
                <div className="text-slate-500">{[place.city, place.country].filter(Boolean).join(', ')}</div>
              )}
              {hasCoords(place) ? (
                <button
                  type="button"
                  onClick={() =>
                    focusOn({
                      latitude: place.latitude,
                      longitude: place.longitude,
                      bounds: place.type === 'poi' ? undefined : place.boundingBox,
                      zoom: place.type === 'poi' ? 16 : 13,
                    })
                  }
                  className="font-mono text-[11px] text-brand-700 hover:underline"
                >
                  {place.latitude!.toFixed(5)}, {place.longitude!.toFixed(5)} — centre map
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] text-amber-800">
                  <span className="flex-1">No coordinates — this place cannot appear on the map.</span>
                  {place.type !== 'activity' && (
                    <Button size="sm" onClick={() => void locate()} disabled={busy === 'locate'}>
                      {busy === 'locate' ? <Spinner className="h-3.5 w-3.5" /> : 'Find'}
                    </Button>
                  )}
                </div>
              )}
              {place.geometry && (
                <div className="text-[11px] text-slate-400">Shape from OpenStreetMap is drawn on the map.</div>
              )}
            </section>

            {/* description ---------------------------------------------- */}
            <section>
              {place.description ? (
                <p className="text-[12.5px] leading-relaxed text-slate-600">{place.description}</p>
              ) : (
                <p className="text-[12px] text-slate-400 italic">
                  No description available from the open sources.
                </p>
              )}
              {data.settings.useEnrichment && !place.description && place.type !== 'activity' && (
                <Button size="sm" className="mt-1.5" onClick={() => void enrich()} disabled={busy === 'enrich'}>
                  {busy === 'enrich' ? <Spinner className="h-3.5 w-3.5" /> : 'Look up description'}
                </Button>
              )}
            </section>

            {/* links ----------------------------------------------------- */}
            {(place.website || place.wikipedia || place.wikidata) && (
              <section className="flex flex-wrap gap-1.5">
                {place.website && <LinkChip href={place.website} label="Website" />}
                {place.wikipedia && <LinkChip href={wikipediaUrl(place.wikipedia)} label="Wikipedia" />}
                {place.wikidata && (
                  <LinkChip href={`https://www.wikidata.org/wiki/${place.wikidata}`} label={place.wikidata} />
                )}
              </section>
            )}

            {/* planning -------------------------------------------------- */}
            <Section label="Add to a day">
              <div className="flex flex-wrap gap-1">
                {trip.days.map((day) => {
                  const count = dayItems.filter((item) => item.dayId === day.id).length
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() =>
                        dispatch({ type: 'items/addPlaces', dayId: day.id, placeIds: [place.id] })
                      }
                      className={cx(
                        'rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
                        count > 0
                          ? 'border-brand-600 bg-brand-50 text-brand-800'
                          : 'border-slate-200 text-slate-600 hover:border-brand-500 hover:bg-brand-50/50',
                      )}
                      title={count > 0 ? `Already in this day ${count}×` : 'Add to this day'}
                    >
                      Day {day.index + 1}
                      {count > 0 && <span className="ml-1 opacity-70">×{count}</span>}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                The same place can appear in several days — it is never duplicated in your list.
              </p>
            </Section>

            <Section label="Category">
              <select
                value={place.category ?? 'other'}
                onChange={(e) => patch({ category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] focus:border-brand-600 focus:outline-none"
              >
                {trip.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </Section>

            <Section label="Type">
              <div className="flex flex-wrap gap-1">
                {TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    title={type.hint}
                    onClick={() => patch({ type: type.id })}
                    className={cx(
                      'rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
                      place.type === type.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-400',
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Priority">
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((priority) => (
                  <button
                    key={priority.id}
                    type="button"
                    onClick={() =>
                      patch({ priority: place.priority === priority.id ? undefined : priority.id })
                    }
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
                      place.priority === priority.id
                        ? 'border-slate-900 bg-slate-50 text-slate-900'
                        : 'border-slate-200 text-slate-600 hover:border-slate-400',
                    )}
                  >
                    <span className={cx('h-2 w-2 rounded-full', priority.className)} />
                    {priority.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Expected duration">
              <div className="flex flex-wrap gap-1">
                {DURATIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => patch({ durationMinutes: place.durationMinutes === minutes ? undefined : minutes })}
                    className={cx(
                      'rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
                      place.durationMinutes === minutes
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-400',
                    )}
                  >
                    {formatDurationMinutes(minutes)}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Your notes">
              <TextArea
                rows={3}
                value={place.notes ?? ''}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Opening hours you looked up, what to order, who recommended it…"
                className="text-[12.5px]"
              />
            </Section>

            <Section label="Status">
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700">
                <input
                  type="checkbox"
                  checked={place.visited ?? false}
                  onChange={(e) => patch({ visited: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 accent-teal-700"
                />
                Mark as visited
              </label>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Inbox / Planned is worked out from your itinerary automatically.
              </p>
            </Section>

            {/* sources --------------------------------------------------- */}
            {place.sources && place.sources.length > 0 && (
              <Section label="Sources">
                <ul className="space-y-1">
                  {place.sources.map((source, index) => (
                    <li key={`${source.provider}-${index}`} className="text-[11px] leading-snug text-slate-500">
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                          {source.label}
                        </a>
                      ) : (
                        source.label
                      )}
                      {source.license && <span className="text-slate-400"> · {source.license}</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {place.type === 'city' && hasCoords(place) && (
                <Button
                  size="sm"
                  onClick={() => {
                    dispatch({
                      type: 'destinations/add',
                      destination: {
                        name: place.name,
                        latitude: place.latitude,
                        longitude: place.longitude,
                        country: place.country,
                      },
                    })
                    pushToast(`${place.name} set as a destination`, 'success')
                  }}
                >
                  Set as destination
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (window.confirm(`Delete “${place.name}”? It will also be removed from every day.`)) {
                    dispatch({ type: 'places/remove', placeId: place.id })
                    selectPlace(null)
                    pushToast('Place deleted')
                  }
                }}
              >
                Delete place
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  )

  function NearbyPanel({ place: target, nearby: list }: { place: Place; nearby: Place[] }) {
    const unplanned = list.filter((p) => !planned.has(p.id))
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-[12.5px] leading-snug text-brand-900">
          {list.length === 0 ? (
            <>No saved place falls inside {target.name} yet.</>
          ) : (
            <>
              You have <strong>{list.length}</strong> saved {list.length === 1 ? 'place' : 'places'} near{' '}
              {target.name}
              {unplanned.length > 0 && <> — {unplanned.length} not planned yet</>}. Add them yourself: nothing is
              added automatically.
            </>
          )}
        </div>

        {list.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {list.map((item) => {
              const itemCategory = categoryById(trip.categories, item.category)
              const distance =
                hasCoords(target) && hasCoords(item)
                  ? haversine(
                      { latitude: target.latitude!, longitude: target.longitude! },
                      { latitude: item.latitude!, longitude: item.longitude! },
                    )
                  : null
              return (
                <li key={item.id} className="flex items-center gap-2 px-2.5 py-2">
                  <span className="text-[13px]">{itemCategory.emoji}</span>
                  <button
                    type="button"
                    onClick={() => selectPlace(item.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[12.5px] font-medium text-slate-700">{item.name}</span>
                    <span className="block text-[10.5px] text-slate-400">
                      {distance !== null ? formatDistance(distance) : ''}
                      {planned.has(item.id) ? ' · planned' : ''}
                    </span>
                  </button>
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      dispatch({ type: 'items/addPlaces', dayId: e.target.value, placeIds: [item.id] })
                      pushToast(`${item.name} added`, 'success')
                    }}
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-1 py-1 text-[10.5px] text-slate-600 focus:outline-none"
                  >
                    <option value="">Add to…</option>
                    {trip.days.map((day) => (
                      <option key={day.id} value={day.id}>
                        Day {day.index + 1}
                      </option>
                    ))}
                  </select>
                </li>
              )
            })}
          </ul>
        )}

        <NearbyDiscovery place={target} />
      </div>
    )
  }
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</h3>
      {children}
    </section>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        '-mb-px border-b-2 px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
        active ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-700',
      )}
    >
      {children}
    </button>
  )
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200"
    >
      {label}
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 4h8v8M16 4 8 12M12 6H4v10h10v-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}

function wikipediaUrl(tag: string): string {
  const [lang, ...rest] = tag.includes(':') ? tag.split(':') : ['en', tag]
  const title = rest.join(':') || tag
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}
