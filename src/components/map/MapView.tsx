import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { cx } from '../../lib/cx'
import { formatDistance, formatDuration, hasCoords, pathLength, type LatLng } from '../../lib/geo'
import { categoryById } from '../../state/categories'
import { itemsForDay, placeMap } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { Place } from '../../types'
import { Button } from '../ui/Button'
import { placeIcon } from './icons'
import { useDayRoute } from './useDayRoute'

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

interface VisiblePlace {
  place: Place
  order?: number
  coords: LatLng
}

/** Reacts to focus requests and to changes in what is being shown. */
function MapEffects({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
  const map = useMap()
  const { focus } = useUi()
  const lastFit = useRef<string>('')
  const lastFocus = useRef(0)

  useEffect(() => {
    if (!focus || focus.nonce === lastFocus.current) return
    lastFocus.current = focus.nonce
    if (focus.bounds) {
      const bounds = L.latLngBounds(
        [focus.bounds.south, focus.bounds.west],
        [focus.bounds.north, focus.bounds.east],
      )
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 16, duration: 0.6 })
      return
    }
    if (focus.latitude !== undefined && focus.longitude !== undefined) {
      map.flyTo([focus.latitude, focus.longitude], focus.zoom ?? Math.max(map.getZoom(), 15), {
        duration: 0.6,
      })
    }
  }, [focus, map])

  // Auto-frame when the *selection* changes, never on every data tick,
  // so the map does not fight the user's own panning.
  useEffect(() => {
    if (points.length === 0 || lastFit.current === fitKey) return
    lastFit.current = fitKey
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]))
    if (!bounds.isValid()) return
    map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15, animate: true })
  }, [fitKey, points, map])

  // Keep Leaflet in sync when the surrounding panels resize.
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  return null
}

export function MapView({ className }: { className?: string }) {
  const { trip, data, dispatch } = useStore()
  const {
    selectedDay,
    setSelectedDay,
    selectedPlaceId,
    selectPlace,
    hoveredPlaceId,
    filters,
  } = useUi()

  const places = useMemo(() => placeMap(trip), [trip])

  const visible = useMemo<VisiblePlace[]>(() => {
    const collect = (list: Place[], ordered = false): VisiblePlace[] =>
      list
        .filter((p): p is Place & LatLng => hasCoords(p))
        .map((place, index) => ({
          place,
          coords: { latitude: place.latitude as number, longitude: place.longitude as number },
          order: ordered ? index + 1 : undefined,
        }))

    if (selectedDay === 'all') {
      const { categories, types, ids } = filters
      return collect(
        trip.places.filter(
          (p) =>
            (!ids || ids.includes(p.id)) &&
            (categories.length === 0 || categories.includes(p.category ?? 'other')) &&
            (types.length === 0 || types.includes(p.type)),
        ),
      )
    }

    if (selectedDay === 'inbox') {
      const planned = new Set(trip.items.map((i) => i.placeId).filter(Boolean) as string[])
      return collect(trip.places.filter((p) => !planned.has(p.id) && !p.visited))
    }

    // A specific day: only its stops, numbered by itinerary order.
    const dayPlaces = itemsForDay(trip, selectedDay)
      .map((item) => (item.placeId ? places.get(item.placeId) : undefined))
      .filter((p): p is Place => Boolean(p))
    return collect(dayPlaces, true)
  }, [trip, selectedDay, filters, places])

  const routePoints = useMemo(
    () => (selectedDay === 'all' || selectedDay === 'inbox' ? [] : visible.map((v) => v.coords)),
    [visible, selectedDay],
  )

  const route = useDayRoute(routePoints, data.settings.useRouting && routePoints.length > 1)

  const straightLine = useMemo(
    () => routePoints.map((p) => [p.latitude, p.longitude] as [number, number]),
    [routePoints],
  )

  const routedLine = useMemo(() => {
    const geometry = route.geometry
    if (!geometry || geometry.type !== 'LineString') return null
    return geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
  }, [route.geometry])

  const shapes = useMemo(
    () =>
      visible
        .filter((v) => v.place.geometry && (v.place.type === 'area' || v.place.type === 'city'))
        .map((v) => ({ place: v.place, geometry: v.place.geometry! })),
    [visible],
  )

  const points = useMemo(() => visible.map((v) => v.coords), [visible])
  const fitKey = `${trip.id}:${selectedDay}:${visible.length}`

  const initialCentre = useMemo<[number, number]>(() => {
    const first = visible[0]?.coords ?? trip.destinations.find((d) => hasCoords(d))
    if (first && hasCoords(first)) return [first.latitude, first.longitude]
    return [48.8566, 2.3522]
  }, [visible, trip.destinations])

  const straightDistance = routePoints.length > 1 ? pathLength(routePoints) : 0

  return (
    <div className={cx('relative h-full w-full', className)}>
      <MapContainer
        center={initialCentre}
        zoom={visible.length > 0 ? 12 : 4}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
        preferCanvas
      >
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} detectRetina />
        <MapEffects points={points} fitKey={fitKey} />

        {/* Real geometry only — boundaries are never invented. */}
        {shapes.map(({ place, geometry }) => {
          const category = categoryById(trip.categories, place.category)
          return (
            <GeoJSON
              key={`geo-${place.id}-${place.updatedAt}`}
              data={geometry}
              style={{
                color: category.color,
                weight: 2,
                fillColor: category.color,
                fillOpacity: place.id === selectedPlaceId ? 0.16 : 0.08,
                dashArray: '4 4',
              }}
            />
          )
        })}

        {routedLine ? (
          <Polyline positions={routedLine} pathOptions={{ color: '#0f766e', weight: 4, opacity: 0.75 }} />
        ) : (
          straightLine.length > 1 && (
            <Polyline
              positions={straightLine}
              pathOptions={{ color: '#0f766e', weight: 3, opacity: 0.6, dashArray: '6 8' }}
            />
          )
        )}

        {visible.map(({ place, coords, order }) => {
          const category = categoryById(trip.categories, place.category)
          const active = place.id === selectedPlaceId || place.id === hoveredPlaceId
          return (
            <Marker
              key={place.id}
              position={[coords.latitude, coords.longitude]}
              icon={placeIcon({
                emoji: category.emoji,
                color: category.color,
                order,
                active,
                dim: !!selectedPlaceId && !active,
              })}
              zIndexOffset={active ? 1000 : 0}
              eventHandlers={{ click: () => selectPlace(place.id) }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <span className="text-[12px] font-medium">
                  {order !== undefined ? `${order}. ` : ''}
                  {place.name}
                </span>
              </Tooltip>
              <Popup>
                <div className="space-y-1.5">
                  <div className="text-[13px] font-semibold text-slate-900">{place.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {[category.name, place.type !== 'poi' ? place.type : null, place.city]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {place.address && <div className="text-[11px] text-slate-500">{place.address}</div>}
                  <div className="flex gap-1.5 pt-1">
                    <Button size="sm" variant="primary" onClick={() => selectPlace(place.id)}>
                      Details
                    </Button>
                    {trip.days.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() =>
                          dispatch({
                            type: 'items/addPlaces',
                            dayId: selectedDay !== 'all' && selectedDay !== 'inbox' ? selectedDay : trip.days[0].id,
                            placeIds: [place.id],
                          })
                        }
                      >
                        Add to day
                      </Button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
        <MapControls points={points} />
      </MapContainer>

      {/* -------------------------------------------------------- overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-500 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedDay('all')}
            className={cx(
              'rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold shadow-sm transition-colors',
              selectedDay === 'all'
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-200 bg-white/95 text-slate-700 hover:bg-white',
            )}
          >
            Show all
          </button>
          {selectedDay !== 'all' && (
            <span className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm">
              {selectedDay === 'inbox'
                ? 'Inbox only'
                : `Day ${(trip.days.find((d) => d.id === selectedDay)?.index ?? 0) + 1} · ${visible.length} stops`}
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          {routePoints.length > 1 && (
            <div className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-600 shadow-sm">
              {route.loading ? (
                'Calculating route…'
              ) : route.estimated ? (
                <>
                  <strong className="font-semibold text-slate-800">{formatDistance(straightDistance)}</strong>{' '}
                  straight-line estimate
                </>
              ) : (
                <>
                  <strong className="font-semibold text-slate-800">{formatDistance(route.distanceMeters)}</strong>{' '}
                  by road
                  {route.durationSeconds ? ` · ${formatDuration(route.durationSeconds)} driving` : ''}
                </>
              )}
            </div>
          )}
          {visible.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-500 shadow-sm">
              Nothing to show here yet
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function MapControls({ points }: { points: LatLng[] }) {
  const map = useMap()
  const fit = () => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]))
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [70, 70], maxZoom: 15, duration: 0.5 })
  }
  return (
    <div className="absolute right-3 bottom-8 z-500 flex flex-col gap-1.5">
      <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-sm">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          title="Zoom in"
          className="grid h-9 w-9 place-items-center text-slate-600 transition-colors hover:bg-slate-50"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          title="Zoom out"
          className="grid h-9 w-9 place-items-center border-t border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 10h12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={fit}
        disabled={points.length === 0}
        title="Fit to visible places"
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition-colors hover:bg-white disabled:opacity-40"
      >
        <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
