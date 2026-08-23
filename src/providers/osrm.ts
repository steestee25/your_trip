import type { Geometry } from 'geojson'
import { cached, DAY_MS } from '../lib/cache'
import { haversine, pathLength, walkingSecondsFor } from '../lib/geo'
import { fetchJson } from '../lib/http'
import { RateLimitedQueue } from '../lib/queue'
import { hashKey } from '../lib/text'
import type { RouteResult, RoutingPoint, RoutingProfile, RoutingProvider } from './types'

/**
 * Public OSRM demo server. It is free and key-less but explicitly not meant
 * for heavy traffic, so requests are throttled, cached and capped in size.
 * When it is unavailable the provider falls back to straight-line estimates
 * and flags them with `estimated: true` — the UI must say so out loud.
 */
const ENDPOINT = 'https://router.project-osrm.org'
const MIN_INTERVAL_MS = 1100
const CACHE_TTL = 7 * DAY_MS
const MAX_POINTS = 25

interface OsrmLeg {
  distance: number
  duration: number
}

interface OsrmRoute {
  distance: number
  duration: number
  legs: OsrmLeg[]
  geometry?: Geometry
}

interface OsrmResponse {
  code: string
  routes?: OsrmRoute[]
  message?: string
}

/** Straight-line fallback. Always marked as an estimate. */
export function estimateRoute(points: RoutingPoint[]): RouteResult {
  const legs = []
  for (let i = 1; i < points.length; i++) {
    const distance = haversine(points[i - 1], points[i])
    legs.push({ distanceMeters: distance, durationSeconds: walkingSecondsFor(distance) })
  }
  const distanceMeters = pathLength(points)
  return {
    distanceMeters,
    durationSeconds: walkingSecondsFor(distanceMeters),
    legs,
    estimated: true,
    provider: 'straight-line',
    attribution: 'Straight-line estimate (no routing service used)',
  }
}

export class OsrmRoutingProvider implements RoutingProvider {
  readonly id = 'osrm'
  readonly name = 'OSRM (public demo server)'
  readonly attribution = 'Routing by OSRM demo server — © OpenStreetMap contributors'

  private readonly queue = new RateLimitedQueue(MIN_INTERVAL_MS, 'osrm')
  private enabled = true
  /** After a failure we stop hammering the demo server for a while. */
  private cooldownUntil = 0

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isAvailable(): boolean {
    return this.enabled && Date.now() >= this.cooldownUntil && navigatorOnline()
  }

  async route(
    points: RoutingPoint[],
    options: { profile?: RoutingProfile; withGeometry?: boolean; signal?: AbortSignal } = {},
  ): Promise<RouteResult> {
    if (points.length < 2) {
      return {
        distanceMeters: 0,
        durationSeconds: 0,
        legs: [],
        estimated: false,
        provider: this.id,
        attribution: this.attribution,
      }
    }
    if (!this.isAvailable() || points.length > MAX_POINTS) return estimateRoute(points)

    // The demo server only serves the `driving` profile reliably.
    const profile = 'driving'
    const coords = points.map((p) => `${p.longitude.toFixed(5)},${p.latitude.toFixed(5)}`).join(';')
    const params = new URLSearchParams({
      overview: options.withGeometry ? 'full' : 'false',
      geometries: 'geojson',
      steps: 'false',
    })
    const url = `${ENDPOINT}/route/v1/${profile}/${coords}?${params.toString()}`
    const key = `osrm:${hashKey(url)}`

    try {
      const data = await cached(key, CACHE_TTL, () =>
        this.queue.add(() => fetchJson<OsrmResponse>(url, { signal: options.signal, timeoutMs: 20000, retries: 0 })),
      )
      const route = data.routes?.[0]
      if (data.code !== 'Ok' || !route) return estimateRoute(points)
      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        legs: (route.legs ?? []).map((leg) => ({
          distanceMeters: leg.distance,
          durationSeconds: leg.duration,
        })),
        geometry: route.geometry,
        estimated: false,
        provider: this.id,
        attribution: this.attribution,
      }
    } catch {
      // Back off for five minutes, then let the app try again.
      this.cooldownUntil = Date.now() + 5 * 60 * 1000
      return estimateRoute(points)
    }
  }
}

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export const osrm = new OsrmRoutingProvider()
