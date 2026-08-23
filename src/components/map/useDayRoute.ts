import { useEffect, useState } from 'react'
import type { Geometry } from 'geojson'
import type { LatLng } from '../../lib/geo'
import { routingProvider } from '../../providers'

export interface DayRoute {
  geometry?: Geometry
  distanceMeters: number
  durationSeconds?: number
  estimated: boolean
  loading: boolean
}

const EMPTY: DayRoute = { distanceMeters: 0, estimated: true, loading: false }

/**
 * Asks the routing provider for the shape of a day's path. Any failure simply
 * yields `estimated: true` and the map falls back to dashed straight lines —
 * the UI never claims a road distance it did not get.
 */
export function useDayRoute(points: LatLng[], enabled: boolean): DayRoute {
  const [route, setRoute] = useState<DayRoute>(EMPTY)
  const key = enabled ? points.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|') : ''

  useEffect(() => {
    if (!enabled || points.length < 2) {
      setRoute(EMPTY)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setRoute((current) => ({ ...current, loading: true }))

    void routingProvider
      .route(points, { withGeometry: true, signal: controller.signal })
      .then((result) => {
        if (cancelled) return
        setRoute({
          geometry: result.estimated ? undefined : result.geometry,
          distanceMeters: result.distanceMeters,
          durationSeconds: result.estimated ? undefined : result.durationSeconds,
          estimated: result.estimated,
          loading: false,
        })
      })
      .catch(() => {
        if (!cancelled) setRoute({ ...EMPTY, loading: false })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
    // `key` captures the coordinate list; points identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return route
}
