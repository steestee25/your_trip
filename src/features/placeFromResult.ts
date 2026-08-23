import type { GeocodeResult } from '../providers/types'
import type { GeoPlaceInput, PlaceType } from '../types'

/** Turns a geocoder candidate into the input for a saved Place. */
export function placeInputFromResult(
  result: GeocodeResult,
  overrides: Partial<GeoPlaceInput> = {},
): GeoPlaceInput {
  return {
    name: result.name,
    type: (overrides.type ?? result.placeType) as PlaceType,
    latitude: result.latitude,
    longitude: result.longitude,
    geometry: result.geometry,
    boundingBox: result.boundingBox,
    address: result.address,
    city: result.city,
    country: result.country,
    countryCode: result.countryCode,
    category: overrides.category ?? result.suggestedCategory,
    website: result.website,
    wikidata: result.wikidata,
    wikipedia: result.wikipedia,
    rawType: result.rawType,
    sources: result.sources,
    ...overrides,
  }
}

/** Activities have no geocoding at all — they are pure itinerary furniture. */
export const ACTIVITY_PRESETS: Array<{ name: string; category: string; durationMinutes: number; emoji: string }> = [
  { name: 'Breakfast', category: 'cafes', durationMinutes: 45, emoji: '🥐' },
  { name: 'Lunch', category: 'restaurants', durationMinutes: 60, emoji: '🍽️' },
  { name: 'Dinner', category: 'restaurants', durationMinutes: 90, emoji: '🍷' },
  { name: 'Coffee break', category: 'cafes', durationMinutes: 30, emoji: '☕' },
  { name: 'Hotel check-in', category: 'accommodation', durationMinutes: 30, emoji: '🏨' },
  { name: 'Hotel check-out', category: 'accommodation', durationMinutes: 30, emoji: '🧳' },
  { name: 'Shopping', category: 'shopping', durationMinutes: 90, emoji: '🛍️' },
  { name: 'Free time', category: 'other', durationMinutes: 120, emoji: '🌤️' },
  { name: 'Rest', category: 'other', durationMinutes: 60, emoji: '😌' },
]

export const TRANSPORT_PRESETS: Array<{ name: string; mode: string; durationMinutes: number; emoji: string }> = [
  { name: 'Walk', mode: 'walk', durationMinutes: 20, emoji: '🚶' },
  { name: 'Metro / Bus', mode: 'transit', durationMinutes: 30, emoji: '🚇' },
  { name: 'Train', mode: 'train', durationMinutes: 60, emoji: '🚆' },
  { name: 'Car', mode: 'car', durationMinutes: 45, emoji: '🚗' },
  { name: 'Ferry', mode: 'ferry', durationMinutes: 60, emoji: '⛴️' },
  { name: 'Flight', mode: 'plane', durationMinutes: 120, emoji: '✈️' },
]
