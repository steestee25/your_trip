import { haversine, pathLength, type LatLng } from '../lib/geo'
import { routingProvider } from '../providers'
import type { RouteResult } from '../providers/types'
import type { ItineraryItem, Place } from '../types'

export interface OptimizableStop {
  item: ItineraryItem
  coords: LatLng | null
}

export interface OptimizeResult {
  /** New ordering of item ids for the whole day, including pinned rows. */
  orderedIds: string[]
  beforeMeters: number
  afterMeters: number
  savedMeters: number
  /** Real routed distances when a routing provider answered. */
  routed: boolean
  beforeSeconds?: number
  afterSeconds?: number
  changed: boolean
  /** Stops that were left where they are because they have no coordinates. */
  pinnedCount: number
  note: string
}

/** Nearest-neighbour construction: greedy, deterministic, good enough as a seed. */
function nearestNeighbour(points: LatLng[]): number[] {
  const order: number[] = [0]
  const remaining = new Set(points.map((_, i) => i))
  remaining.delete(0)
  let current = 0
  while (remaining.size > 0) {
    let best = -1
    let bestDistance = Infinity
    for (const index of remaining) {
      const distance = haversine(points[current], points[index])
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    order.push(best)
    remaining.delete(best)
    current = best
  }
  return order
}

/** 2-opt refinement. The first stop stays fixed: it is usually where you start. */
function twoOpt(order: number[], points: LatLng[], maxRounds = 60): number[] {
  const result = [...order]
  const distance = (a: number, b: number) => haversine(points[result[a]], points[result[b]])
  let improved = true
  let rounds = 0
  while (improved && rounds < maxRounds) {
    improved = false
    rounds++
    for (let i = 1; i < result.length - 1; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const before =
          distance(i - 1, i) + (j + 1 < result.length ? distance(j, j + 1) : 0)
        const after =
          haversine(points[result[i - 1]], points[result[j]]) +
          (j + 1 < result.length ? haversine(points[result[i]], points[result[j + 1]]) : 0)
        if (after + 1e-6 < before) {
          const slice = result.slice(i, j + 1).reverse()
          result.splice(i, slice.length, ...slice)
          improved = true
        }
      }
    }
  }
  return result
}

/**
 * Proposes a geographically tighter order for one day.
 * Rows without coordinates (Lunch, Travel, ...) keep their original slot so the
 * day's rhythm is preserved; only located stops are permuted among themselves.
 */
export async function optimizeDay(
  stops: OptimizableStop[],
  options: { useRouting?: boolean; signal?: AbortSignal } = {},
): Promise<OptimizeResult> {
  const locatedIndexes: number[] = []
  const points: LatLng[] = []
  stops.forEach((stop, index) => {
    if (stop.coords) {
      locatedIndexes.push(index)
      points.push(stop.coords)
    }
  })

  const pinnedCount = stops.length - points.length
  const baseIds = stops.map((s) => s.item.id)

  if (points.length < 3) {
    return {
      orderedIds: baseIds,
      beforeMeters: pathLength(points),
      afterMeters: pathLength(points),
      savedMeters: 0,
      routed: false,
      changed: false,
      pinnedCount,
      note:
        points.length < 2
          ? 'Add at least three located stops to optimise this day.'
          : 'With two located stops there is only one possible order.',
    }
  }

  const seeded = nearestNeighbour(points)
  const refined = twoOpt(seeded, points)

  const beforePoints = points
  const afterPoints = refined.map((i) => points[i])

  let beforeMeters = pathLength(beforePoints)
  let afterMeters = pathLength(afterPoints)
  let beforeSeconds: number | undefined
  let afterSeconds: number | undefined
  let routed = false

  if (options.useRouting && routingProvider.isAvailable()) {
    const [beforeRoute, afterRoute] = await Promise.all([
      safeRoute(beforePoints, options.signal),
      safeRoute(afterPoints, options.signal),
    ])
    if (beforeRoute && afterRoute && !beforeRoute.estimated && !afterRoute.estimated) {
      beforeMeters = beforeRoute.distanceMeters
      afterMeters = afterRoute.distanceMeters
      beforeSeconds = beforeRoute.durationSeconds
      afterSeconds = afterRoute.durationSeconds
      routed = true
    }
  }

  // If routing says the "optimised" order is actually worse, keep the original.
  const improved = afterMeters + 1 < beforeMeters
  const orderedIds = [...baseIds]
  if (improved) {
    refined.forEach((sourceIdx, position) => {
      orderedIds[locatedIndexes[position]] = stops[locatedIndexes[sourceIdx]].item.id
    })
  }

  return {
    orderedIds,
    beforeMeters,
    afterMeters: improved ? afterMeters : beforeMeters,
    savedMeters: improved ? beforeMeters - afterMeters : 0,
    routed,
    beforeSeconds,
    afterSeconds: improved ? afterSeconds : beforeSeconds,
    changed: improved && orderedIds.some((id, i) => id !== baseIds[i]),
    pinnedCount,
    note: routed
      ? 'Distances come from the OSRM routing service (road distance).'
      : 'Distances are straight-line estimates, not road distances.',
  }
}

async function safeRoute(points: LatLng[], signal?: AbortSignal): Promise<RouteResult | null> {
  try {
    return await routingProvider.route(points, { signal })
  } catch {
    return null
  }
}

export function stopsFromItems(items: ItineraryItem[], places: Map<string, Place>): OptimizableStop[] {
  return items.map((item) => {
    const place = item.placeId ? places.get(item.placeId) : undefined
    const coords =
      place && typeof place.latitude === 'number' && typeof place.longitude === 'number'
        ? { latitude: place.latitude, longitude: place.longitude }
        : null
    return { item, coords }
  })
}
