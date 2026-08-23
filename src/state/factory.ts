import { nowIso, uid } from '../lib/id'
import { addDaysIso } from '../lib/time'
import type { AppData, AppSettings, Day, GeoPlaceInput, Place, Trip } from '../types'
import { DEFAULT_CATEGORIES } from './categories'

export const DATA_VERSION = 1

export const DEFAULT_SETTINGS: AppSettings = {
  useRouting: true,
  useEnrichment: true,
  useOverpass: true,
  language: 'en',
  units: 'metric',
}

export function makeDays(count: number, startDate?: string): Day[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: uid('day'),
    index,
    date: startDate ? addDaysIso(startDate, index) : undefined,
  }))
}

export function createTrip(options: { name?: string; days?: number; startDate?: string } = {}): Trip {
  const timestamp = nowIso()
  return {
    id: uid('trip'),
    name: options.name?.trim() || 'My trip',
    startDate: options.startDate,
    days: makeDays(options.days ?? 3, options.startDate),
    places: [],
    items: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    destinations: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createInitialData(): AppData {
  const trip = createTrip({ name: 'My trip', days: 3 })
  return {
    version: DATA_VERSION,
    trips: [trip],
    activeTripId: trip.id,
    settings: { ...DEFAULT_SETTINGS },
  }
}

/** Builds a Place from a raw input shape, filling only fields we actually have. */
export function createPlace(input: GeoPlaceInput): Place {
  const timestamp = nowIso()
  return {
    id: input.id ?? uid('place'),
    name: input.name.trim(),
    type: input.type,
    latitude: input.latitude,
    longitude: input.longitude,
    geometry: input.geometry,
    boundingBox: input.boundingBox,
    address: input.address,
    city: input.city,
    country: input.country,
    countryCode: input.countryCode,
    category: input.category,
    parentPlaceId: input.parentPlaceId,
    description: input.description,
    website: input.website,
    wikipedia: input.wikipedia,
    wikidata: input.wikidata,
    imageUrl: input.imageUrl,
    notes: input.notes,
    priority: input.priority,
    durationMinutes: input.durationMinutes,
    visited: false,
    rawType: input.rawType,
    sources: input.sources ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
