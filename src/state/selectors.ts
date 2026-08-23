import { hasCoords, type LatLng } from '../lib/geo'
import type { Category, ItineraryItem, Place, PlaceStatus, Trip } from '../types'
import { categoryById } from './categories'

export interface DaySummary {
  dayId: string
  index: number
  label: string
  itemCount: number
}

export function placeMap(trip: Trip): Map<string, Place> {
  return new Map(trip.places.map((p) => [p.id, p]))
}

export function categoryMap(trip: Trip): Map<string, Category> {
  return new Map(trip.categories.map((c) => [c.id, c]))
}

/** Ids of every place that appears at least once in the itinerary. */
export function plannedPlaceIds(trip: Trip): Set<string> {
  const ids = new Set<string>()
  for (const item of trip.items) if (item.placeId) ids.add(item.placeId)
  return ids
}

/** Status is derived, never stored: only `visited` is user-owned state. */
export function statusOf(place: Place, planned: Set<string>): PlaceStatus {
  if (place.visited) return 'visited'
  return planned.has(place.id) ? 'planned' : 'inbox'
}

export function inboxPlaces(trip: Trip): Place[] {
  const planned = plannedPlaceIds(trip)
  return trip.places.filter((p) => !planned.has(p.id) && !p.visited)
}

export function itemsForDay(trip: Trip, dayId: string): ItineraryItem[] {
  return trip.items.filter((i) => i.dayId === dayId).sort((a, b) => a.order - b.order)
}

export function itemCountByDay(trip: Trip): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of trip.items) counts.set(item.dayId, (counts.get(item.dayId) ?? 0) + 1)
  return counts
}

export function dayLabel(trip: Trip, dayId: string): string {
  const day = trip.days.find((d) => d.id === dayId)
  if (!day) return 'Day'
  return day.title?.trim() || `Day ${day.index + 1}`
}

/** Display title for an itinerary row, whether or not it has a place. */
export function itemTitle(item: ItineraryItem, places: Map<string, Place>): string {
  if (item.placeId) {
    const place = places.get(item.placeId)
    if (place) return place.name
  }
  return item.title?.trim() || (item.type === 'transport' ? 'Travel' : 'Activity')
}

export function itemCoords(item: ItineraryItem, places: Map<string, Place>): LatLng | null {
  if (!item.placeId) return null
  const place = places.get(item.placeId)
  if (!place || !hasCoords(place)) return null
  return { latitude: place.latitude, longitude: place.longitude }
}

export function itemCategory(item: ItineraryItem, trip: Trip, places: Map<string, Place>): Category {
  const place = item.placeId ? places.get(item.placeId) : undefined
  if (place) return categoryById(trip.categories, place.category)
  if (item.type === 'transport') return categoryById(trip.categories, 'transport')
  return categoryById(trip.categories, 'other')
}

export interface TripStats {
  total: number
  priority: number
  planned: number
  inbox: number
  visited: number
  withoutCoords: number
  days: DaySummary[]
  totalItems: number
  emptyDays: number
}

export function tripStats(trip: Trip): TripStats {
  const planned = plannedPlaceIds(trip)
  const counts = itemCountByDay(trip)
  let priority = 0
  let visited = 0
  let inbox = 0
  let withoutCoords = 0
  for (const place of trip.places) {
    if (place.priority === 'high') priority++
    if (place.visited) visited++
    else if (!planned.has(place.id)) inbox++
    if (!hasCoords(place)) withoutCoords++
  }
  const days = trip.days.map((day) => ({
    dayId: day.id,
    index: day.index,
    label: day.title?.trim() || `Day ${day.index + 1}`,
    itemCount: counts.get(day.id) ?? 0,
  }))
  return {
    total: trip.places.length,
    priority,
    planned: planned.size,
    inbox,
    visited,
    withoutCoords,
    days,
    totalItems: trip.items.length,
    emptyDays: days.filter((d) => d.itemCount === 0).length,
  }
}

/** Coordinates the map should frame when nothing specific is selected. */
export function tripFocusPoints(trip: Trip): LatLng[] {
  const points: LatLng[] = []
  for (const place of trip.places) {
    if (hasCoords(place)) points.push({ latitude: place.latitude, longitude: place.longitude })
  }
  if (points.length === 0) {
    for (const destination of trip.destinations) {
      if (hasCoords(destination)) {
        points.push({ latitude: destination.latitude, longitude: destination.longitude })
      }
    }
  }
  return points
}

export type SortKey = 'recent' | 'name' | 'priority' | 'category' | 'distance'

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

export interface PlaceFilters {
  search: string
  categories: string[]
  types: string[]
  priorities: string[]
  status: 'all' | 'inbox' | 'planned' | 'visited'
  /** Explicit subset, set when a suggestion asks to show specific places. */
  ids: string[] | null
}

export const EMPTY_FILTERS: PlaceFilters = {
  search: '',
  categories: [],
  types: [],
  priorities: [],
  status: 'all',
  ids: null,
}

export function filterPlaces(trip: Trip, filters: PlaceFilters, sort: SortKey = 'recent'): Place[] {
  const planned = plannedPlaceIds(trip)
  const needle = filters.search.trim().toLowerCase()
  const result = trip.places.filter((place) => {
    if (filters.ids && !filters.ids.includes(place.id)) return false
    if (filters.categories.length && !filters.categories.includes(place.category ?? 'other')) return false
    if (filters.types.length && !filters.types.includes(place.type)) return false
    if (filters.priorities.length && !filters.priorities.includes(place.priority ?? 'none')) return false
    if (filters.status !== 'all' && statusOf(place, planned) !== filters.status) return false
    if (needle) {
      const haystack = [place.name, place.city, place.country, place.address, place.notes, place.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  const categories = categoryMap(trip)
  result.sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'priority':
        return (
          (PRIORITY_RANK[a.priority ?? ''] ?? 3) - (PRIORITY_RANK[b.priority ?? ''] ?? 3) ||
          a.name.localeCompare(b.name)
        )
      case 'category':
        return (
          (categories.get(a.category ?? 'other')?.name ?? '').localeCompare(
            categories.get(b.category ?? 'other')?.name ?? '',
          ) || a.name.localeCompare(b.name)
        )
      default:
        return b.createdAt.localeCompare(a.createdAt)
    }
  })
  return result
}
