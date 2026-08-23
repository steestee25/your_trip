import type { Geometry, Position } from 'geojson'
import type { BoundingBox } from '../types'

export interface LatLng {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_M = 6371008.8

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function hasCoords(p: Partial<LatLng> | undefined | null): p is LatLng {
  return !!p && typeof p.latitude === 'number' && typeof p.longitude === 'number' &&
    Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
}

/** Total straight-line length of an ordered path, in metres. */
export function pathLength(points: LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i])
  return total
}

export function centroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null
  let x = 0
  let y = 0
  let z = 0
  for (const p of points) {
    const lat = toRad(p.latitude)
    const lon = toRad(p.longitude)
    x += Math.cos(lat) * Math.cos(lon)
    y += Math.cos(lat) * Math.sin(lon)
    z += Math.sin(lat)
  }
  const n = points.length
  x /= n
  y /= n
  z /= n
  const lon = Math.atan2(y, x)
  const hyp = Math.sqrt(x * x + y * y)
  const lat = Math.atan2(z, hyp)
  return { latitude: (lat * 180) / Math.PI, longitude: (lon * 180) / Math.PI }
}

/** Largest distance between any two points, in metres. A crude "spread" metric. */
export function maxPairwiseDistance(points: LatLng[]): number {
  let max = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = haversine(points[i], points[j])
      if (d > max) max = d
    }
  }
  return max
}

export function boundsOf(points: LatLng[]): BoundingBox | null {
  if (points.length === 0) return null
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity
  for (const p of points) {
    south = Math.min(south, p.latitude)
    north = Math.max(north, p.latitude)
    west = Math.min(west, p.longitude)
    east = Math.max(east, p.longitude)
  }
  return { south, west, north, east }
}

export function boxContains(box: BoundingBox, p: LatLng): boolean {
  return (
    p.latitude >= box.south && p.latitude <= box.north &&
    p.longitude >= box.west && p.longitude <= box.east
  )
}

export function padBox(box: BoundingBox, metres: number): BoundingBox {
  const dLat = (metres / EARTH_RADIUS_M) * (180 / Math.PI)
  const midLat = (box.north + box.south) / 2
  const dLon = dLat / Math.max(0.01, Math.cos(toRad(midLat)))
  return {
    south: box.south - dLat,
    north: box.north + dLat,
    west: box.west - dLon,
    east: box.east + dLon,
  }
}

/** Approximate "radius" of a bounding box in metres (half the diagonal). */
export function boxRadius(box: BoundingBox): number {
  return (
    haversine(
      { latitude: box.south, longitude: box.west },
      { latitude: box.north, longitude: box.east },
    ) / 2
  )
}

export function formatDistance(metres: number, units: 'metric' | 'imperial' = 'metric'): string {
  if (!Number.isFinite(metres)) return '—'
  if (units === 'imperial') {
    const feet = metres * 3.28084
    if (feet < 1000) return `${Math.round(feet)} ft`
    return `${(metres / 1609.344).toFixed(1)} mi`
  }
  if (metres < 950) return `${Math.round(metres / 10) * 10} m`
  return `${(metres / 1000).toFixed(1)} km`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Rough walking time (4.5 km/h) — only used where it is labelled as an estimate. */
export function walkingSecondsFor(metres: number): number {
  return (metres / 1000 / 4.5) * 3600
}

function eachPosition(geometry: Geometry, visit: (pos: Position) => void): void {
  switch (geometry.type) {
    case 'Point':
      visit(geometry.coordinates)
      break
    case 'MultiPoint':
    case 'LineString':
      geometry.coordinates.forEach(visit)
      break
    case 'MultiLineString':
    case 'Polygon':
      geometry.coordinates.forEach((ring) => ring.forEach(visit))
      break
    case 'MultiPolygon':
      geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(visit)))
      break
    case 'GeometryCollection':
      geometry.geometries.forEach((g) => eachPosition(g, visit))
      break
  }
}

export function geometryBounds(geometry: Geometry): BoundingBox | null {
  const points: LatLng[] = []
  eachPosition(geometry, ([lon, lat]) => points.push({ latitude: lat, longitude: lon }))
  return boundsOf(points)
}

/** Number of coordinate pairs — used to drop absurdly heavy polygons. */
export function geometrySize(geometry: Geometry): number {
  let n = 0
  eachPosition(geometry, () => { n++ })
  return n
}
