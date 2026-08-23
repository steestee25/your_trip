import { nowIso, uid } from '../lib/id'
import type { AppData, Category, Day, ItineraryItem, Place, Trip } from '../types'
import { DEFAULT_CATEGORIES } from './categories'
import { DATA_VERSION, DEFAULT_SETTINGS, createInitialData, makeDays } from './factory'

/**
 * Defensive normalisation for anything coming from disk or an imported file.
 * Unknown fields are dropped, broken references are repaired, and the app
 * always ends up with a structurally valid document.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

function sanitizeCategory(raw: unknown): Category | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id)
  const name = str(raw.name)
  if (!id || !name) return null
  return {
    id,
    name,
    emoji: str(raw.emoji) ?? '📍',
    color: str(raw.color) ?? '#64748b',
    builtIn: raw.builtIn === true,
  }
}

function sanitizePlace(raw: unknown): Place | null {
  if (!isRecord(raw)) return null
  const name = str(raw.name)
  if (!name) return null
  const type = raw.type
  const placeType =
    type === 'poi' || type === 'area' || type === 'city' || type === 'activity' ? type : 'poi'
  const priority = raw.priority
  const bbox = isRecord(raw.boundingBox) ? raw.boundingBox : undefined
  return {
    id: str(raw.id) ?? uid('place'),
    name,
    type: placeType,
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    geometry: isRecord(raw.geometry) && typeof raw.geometry.type === 'string' ? (raw.geometry as unknown as Place['geometry']) : undefined,
    boundingBox:
      bbox &&
      num(bbox.south) !== undefined &&
      num(bbox.north) !== undefined &&
      num(bbox.west) !== undefined &&
      num(bbox.east) !== undefined
        ? { south: bbox.south as number, north: bbox.north as number, west: bbox.west as number, east: bbox.east as number }
        : undefined,
    address: str(raw.address),
    city: str(raw.city),
    country: str(raw.country),
    countryCode: str(raw.countryCode),
    category: str(raw.category),
    parentPlaceId: str(raw.parentPlaceId),
    description: str(raw.description),
    website: str(raw.website),
    wikipedia: str(raw.wikipedia),
    wikidata: str(raw.wikidata),
    imageUrl: str(raw.imageUrl),
    notes: str(raw.notes),
    priority: priority === 'high' || priority === 'medium' || priority === 'low' ? priority : undefined,
    durationMinutes: num(raw.durationMinutes),
    visited: raw.visited === true,
    rawType: str(raw.rawType),
    sources: Array.isArray(raw.sources)
      ? raw.sources.filter(isRecord).map((s) => ({
          provider: str(s.provider) ?? 'unknown',
          label: str(s.label) ?? 'Unknown source',
          url: str(s.url),
          ref: str(s.ref),
          license: str(s.license),
          retrievedAt: str(s.retrievedAt) ?? nowIso(),
        }))
      : [],
    createdAt: str(raw.createdAt) ?? nowIso(),
    updatedAt: str(raw.updatedAt) ?? nowIso(),
  }
}

function sanitizeDay(raw: unknown, index: number): Day | null {
  if (!isRecord(raw)) return null
  return {
    id: str(raw.id) ?? uid('day'),
    index,
    date: str(raw.date),
    title: str(raw.title),
    notes: str(raw.notes),
  }
}

function sanitizeItem(raw: unknown, order: number): ItineraryItem | null {
  if (!isRecord(raw)) return null
  const dayId = str(raw.dayId)
  if (!dayId) return null
  const type = raw.type
  return {
    id: str(raw.id) ?? uid('item'),
    dayId,
    placeId: str(raw.placeId),
    type: type === 'place' || type === 'activity' || type === 'transport' ? type : 'activity',
    title: str(raw.title),
    startTime: str(raw.startTime),
    endTime: str(raw.endTime),
    durationMinutes: num(raw.durationMinutes),
    notes: str(raw.notes),
    transportMode: str(raw.transportMode) as ItineraryItem['transportMode'],
    order: num(raw.order) ?? order,
  }
}

export function sanitizeTrip(raw: unknown): Trip | null {
  if (!isRecord(raw)) return null
  const name = str(raw.name) ?? 'Imported trip'

  const days = (Array.isArray(raw.days) ? raw.days : [])
    .map((d, i) => sanitizeDay(d, i))
    .filter((d): d is Day => d !== null)
  const safeDays = days.length > 0 ? days : makeDays(3, str(raw.startDate))
  const dayIds = new Set(safeDays.map((d) => d.id))

  const places = (Array.isArray(raw.places) ? raw.places : [])
    .map(sanitizePlace)
    .filter((p): p is Place => p !== null)
  const placeIds = new Set(places.map((p) => p.id))

  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((it, i) => sanitizeItem(it, i))
    .filter((i): i is ItineraryItem => i !== null)
    // Drop references to days/places that did not survive the import.
    .filter((i) => dayIds.has(i.dayId) && (!i.placeId || placeIds.has(i.placeId)))

  const categories = (Array.isArray(raw.categories) ? raw.categories : [])
    .map(sanitizeCategory)
    .filter((c): c is Category => c !== null)

  const merged = categories.length > 0 ? categories : DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  // Guarantee the built-ins exist so places never point at a missing category.
  for (const builtIn of DEFAULT_CATEGORIES) {
    if (!merged.some((c) => c.id === builtIn.id)) merged.push({ ...builtIn })
  }

  const destinations = (Array.isArray(raw.destinations) ? raw.destinations : [])
    .filter(isRecord)
    .map((d) => ({
      id: str(d.id) ?? uid('dest'),
      name: str(d.name) ?? 'Destination',
      latitude: num(d.latitude),
      longitude: num(d.longitude),
      country: str(d.country),
    }))

  // Re-number items per day so order is always dense and unique.
  const byDay = new Map<string, ItineraryItem[]>()
  for (const item of items.sort((a, b) => a.order - b.order)) {
    const list = byDay.get(item.dayId) ?? []
    list.push(item)
    byDay.set(item.dayId, list)
  }
  const normalizedItems: ItineraryItem[] = []
  for (const [, list] of byDay) {
    list.forEach((item, index) => normalizedItems.push({ ...item, order: index }))
  }

  return {
    id: str(raw.id) ?? uid('trip'),
    name,
    startDate: str(raw.startDate),
    notes: str(raw.notes),
    days: safeDays,
    places,
    items: normalizedItems,
    categories: merged,
    destinations,
    createdAt: str(raw.createdAt) ?? nowIso(),
    updatedAt: str(raw.updatedAt) ?? nowIso(),
  }
}

export function sanitizeAppData(raw: unknown): AppData | null {
  if (!isRecord(raw)) return null

  // A file containing a single trip is a valid import too.
  if (!Array.isArray(raw.trips) && Array.isArray(raw.days)) {
    const trip = sanitizeTrip(raw)
    if (!trip) return null
    return { version: DATA_VERSION, trips: [trip], activeTripId: trip.id, settings: { ...DEFAULT_SETTINGS } }
  }

  const trips = (Array.isArray(raw.trips) ? raw.trips : [])
    .map(sanitizeTrip)
    .filter((t): t is Trip => t !== null)
  if (trips.length === 0) return null

  const settings = isRecord(raw.settings) ? raw.settings : {}
  const activeTripId = str(raw.activeTripId)

  return {
    version: DATA_VERSION,
    trips,
    activeTripId: activeTripId && trips.some((t) => t.id === activeTripId) ? activeTripId : trips[0].id,
    settings: {
      useRouting: settings.useRouting !== false,
      useEnrichment: settings.useEnrichment !== false,
      useOverpass: settings.useOverpass !== false,
      language: 'en',
      units: settings.units === 'imperial' ? 'imperial' : 'metric',
    },
  }
}

export function sanitizeOrInitial(raw: unknown): AppData {
  return sanitizeAppData(raw) ?? createInitialData()
}
