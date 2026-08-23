import {
  boxContains,
  boxRadius,
  haversine,
  hasCoords,
  maxPairwiseDistance,
  padBox,
  pathLength,
  type LatLng,
} from '../lib/geo'
import { formatDistance } from '../lib/geo'
import type { Place, Trip } from '../types'
import { itemsForDay, placeMap, plannedPlaceIds } from '../state/selectors'

export type SuggestionKind = 'nearby-area' | 'dispersed-day' | 'cluster' | 'empty-day' | 'no-coords' | 'time-clash'

export interface Suggestion {
  id: string
  kind: SuggestionKind
  tone: 'info' | 'warning'
  icon: string
  title: string
  detail: string
  /** Places the user may want to act on. Nothing is ever applied automatically. */
  placeIds?: string[]
  dayId?: string
}

/** A day whose stops sprawl further than this is worth flagging. */
const DISPERSED_PATH_METERS = 25000
const DISPERSED_SPREAD_METERS = 15000
/** Unplanned places within this radius of each other are a plausible single day. */
const CLUSTER_RADIUS_METERS = 1200
const MIN_CLUSTER_SIZE = 3

function coordsOf(place: Place): LatLng | null {
  return hasCoords(place) ? { latitude: place.latitude, longitude: place.longitude } : null
}

/** Unplanned places that fall inside (or just outside) an area/city already in the trip. */
function nearbyAreaSuggestions(trip: Trip): Suggestion[] {
  const planned = plannedPlaceIds(trip)
  const unplanned = trip.places.filter((p) => !planned.has(p.id) && !p.visited && hasCoords(p))
  if (unplanned.length === 0) return []

  const containers = trip.places.filter((p) => (p.type === 'area' || p.type === 'city') && hasCoords(p))
  const suggestions: Suggestion[] = []

  for (const container of containers) {
    const centre = coordsOf(container)
    if (!centre) continue
    // Use the real bounding box when the source gave us one, otherwise a radius.
    const radius = container.boundingBox
      ? Math.max(600, boxRadius(container.boundingBox))
      : container.type === 'city'
        ? 6000
        : 1500
    const box = container.boundingBox ? padBox(container.boundingBox, 300) : null

    const matches = unplanned.filter((place) => {
      if (place.id === container.id) return false
      const point = coordsOf(place)
      if (!point) return false
      if (box) return boxContains(box, point)
      return haversine(centre, point) <= radius
    })

    if (matches.length >= 2) {
      suggestions.push({
        id: `nearby:${container.id}`,
        kind: 'nearby-area',
        tone: 'info',
        icon: '💡',
        title: `You have ${matches.length} saved places near ${container.name}`,
        detail: 'They are not planned yet. Add them to a day whenever you want — nothing is added automatically.',
        placeIds: matches.map((p) => p.id),
      })
    }
  }
  return suggestions
}

function dispersedDaySuggestions(trip: Trip): Suggestion[] {
  const places = placeMap(trip)
  const suggestions: Suggestion[] = []
  for (const day of trip.days) {
    const points = itemsForDay(trip, day.id)
      .map((item) => (item.placeId ? places.get(item.placeId) : undefined))
      .map((place) => (place ? coordsOf(place) : null))
      .filter((p): p is LatLng => p !== null)
    if (points.length < 3) continue
    const total = pathLength(points)
    const spread = maxPairwiseDistance(points)
    if (total > DISPERSED_PATH_METERS || spread > DISPERSED_SPREAD_METERS) {
      suggestions.push({
        id: `dispersed:${day.id}`,
        kind: 'dispersed-day',
        tone: 'warning',
        icon: '⚠️',
        title: `Day ${day.index + 1} is geographically spread out`,
        detail: `About ${formatDistance(total)} between stops in a straight line (widest gap ${formatDistance(
          spread,
        )}). Try "Optimise day", or move a stop to another day.`,
        dayId: day.id,
      })
    }
  }
  return suggestions
}

/** Greedy single-link clustering over unplanned places. */
function clusterSuggestions(trip: Trip): Suggestion[] {
  const planned = plannedPlaceIds(trip)
  const pool = trip.places.filter(
    (p) => !planned.has(p.id) && !p.visited && hasCoords(p) && p.type !== 'city',
  )
  if (pool.length < MIN_CLUSTER_SIZE) return []

  const used = new Set<string>()
  const clusters: Place[][] = []
  for (const seed of pool) {
    if (used.has(seed.id)) continue
    const seedPoint = coordsOf(seed)
    if (!seedPoint) continue
    const cluster = [seed]
    used.add(seed.id)
    for (const candidate of pool) {
      if (used.has(candidate.id)) continue
      const point = coordsOf(candidate)
      if (!point) continue
      if (cluster.some((member) => {
        const memberPoint = coordsOf(member)
        return memberPoint ? haversine(memberPoint, point) <= CLUSTER_RADIUS_METERS : false
      })) {
        cluster.push(candidate)
        used.add(candidate.id)
      }
    }
    if (cluster.length >= MIN_CLUSTER_SIZE) clusters.push(cluster)
  }

  return clusters.slice(0, 3).map((cluster) => ({
    id: `cluster:${cluster[0].id}`,
    kind: 'cluster' as const,
    tone: 'info' as const,
    icon: '💡',
    title: `These ${cluster.length} places are close together`,
    detail: `${cluster
      .slice(0, 4)
      .map((p) => p.name)
      .join(', ')}${cluster.length > 4 ? `, +${cluster.length - 4} more` : ''} — they would fit in one day.`,
    placeIds: cluster.map((p) => p.id),
  }))
}

function emptyDaySuggestions(trip: Trip): Suggestion[] {
  const empty = trip.days.filter((day) => itemsForDay(trip, day.id).length === 0)
  if (empty.length === 0 || empty.length === trip.days.length) return []
  return [
    {
      id: 'empty-days',
      kind: 'empty-day',
      tone: 'info',
      icon: '📅',
      title: `${empty.length} ${empty.length === 1 ? 'day is' : 'days are'} still empty`,
      detail: `Nothing planned for ${empty.map((d) => `Day ${d.index + 1}`).join(', ')}.`,
      dayId: empty[0].id,
    },
  ]
}

function missingCoordsSuggestions(trip: Trip): Suggestion[] {
  const missing = trip.places.filter((p) => p.type !== 'activity' && !hasCoords(p))
  if (missing.length === 0) return []
  return [
    {
      id: 'no-coords',
      kind: 'no-coords',
      tone: 'warning',
      icon: '📍',
      title: `${missing.length} ${missing.length === 1 ? 'place has' : 'places have'} no location`,
      detail: 'They cannot appear on the map or be optimised. Open one to search for its position.',
      placeIds: missing.map((p) => p.id),
    },
  ]
}

/** Overlapping time slots inside the same day. */
function timeClashSuggestions(trip: Trip): Suggestion[] {
  const suggestions: Suggestion[] = []
  for (const day of trip.days) {
    const timed = itemsForDay(trip, day.id)
      .map((item) => {
        const start = toMinutes(item.startTime)
        const end = toMinutes(item.endTime) ?? (start !== null ? start + (item.durationMinutes ?? 0) : null)
        return start !== null && end !== null ? { start, end } : null
      })
      .filter((x): x is { start: number; end: number } => x !== null)
    let clashes = 0
    for (let i = 1; i < timed.length; i++) {
      if (timed[i].start < timed[i - 1].end) clashes++
    }
    if (clashes > 0) {
      suggestions.push({
        id: `clash:${day.id}`,
        kind: 'time-clash',
        tone: 'warning',
        icon: '⏱️',
        title: `Day ${day.index + 1} has ${clashes} overlapping time ${clashes === 1 ? 'slot' : 'slots'}`,
        detail: 'Two stops are scheduled at the same time. Use "Auto-schedule" or adjust the times.',
        dayId: day.id,
      })
    }
  }
  return suggestions
}

function toMinutes(value: string | undefined): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/**
 * All suggestions are computed locally from the trip itself — no AI, no API.
 * They are advisory: the app never edits the itinerary on their behalf.
 */
export function buildSuggestions(trip: Trip): Suggestion[] {
  return [
    ...nearbyAreaSuggestions(trip),
    ...dispersedDaySuggestions(trip),
    ...clusterSuggestions(trip),
    ...timeClashSuggestions(trip),
    ...emptyDaySuggestions(trip),
    ...missingCoordsSuggestions(trip),
  ]
}

/** Saved places sitting inside/near an area or city, used by the place detail panel. */
export function placesNear(
  trip: Trip,
  target: Place,
  options: { onlyUnplanned?: boolean } = {},
): Place[] {
  const centre = coordsOf(target)
  if (!centre) return []
  const planned = plannedPlaceIds(trip)
  const radius = target.boundingBox
    ? Math.max(600, boxRadius(target.boundingBox))
    : target.type === 'city'
      ? 6000
      : target.type === 'area'
        ? 1500
        : 800
  const box = target.boundingBox ? padBox(target.boundingBox, 300) : null

  return trip.places
    .filter((place) => {
      if (place.id === target.id) return false
      if (options.onlyUnplanned && planned.has(place.id)) return false
      const point = coordsOf(place)
      if (!point) return false
      return box ? boxContains(box, point) : haversine(centre, point) <= radius
    })
    .sort((a, b) => {
      const pa = coordsOf(a)
      const pb = coordsOf(b)
      if (!pa || !pb) return 0
      return haversine(centre, pa) - haversine(centre, pb)
    })
}
