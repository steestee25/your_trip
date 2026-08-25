import type { Geometry } from 'geojson'
import { cached, DAY_MS } from '../lib/cache'
import { geometrySize } from '../lib/geo'
import { fetchJson, HttpError } from '../lib/http'
import { RateLimitedQueue } from '../lib/queue'
import { hashKey } from '../lib/text'
import type { BoundingBox, PlaceSource } from '../types'
import { classifyOsm, rawTypeLabel } from './osmClassify'
import type { GeocodeQuery, GeocodeResult, GeocodingProvider } from './types'

const ENDPOINT = 'https://nominatim.openstreetmap.org'

/**
 * Nominatim's usage policy allows at most 1 request per second and asks for
 * caching. Both are enforced here rather than left to callers.
 */
const MIN_INTERVAL_MS = 1200
const CACHE_TTL = 30 * DAY_MS

/** Polygons above this many points are dropped: they freeze Leaflet for no benefit. */
const MAX_GEOMETRY_POINTS = 4000

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  suburb?: string
  neighbourhood?: string
  quarter?: string
  county?: string
  state?: string
  country?: string
  country_code?: string
  postcode?: string
  road?: string
  house_number?: string
}

interface NominatimPlace {
  place_id: number
  osm_type?: 'node' | 'way' | 'relation'
  osm_id?: number
  lat: string
  lon: string
  display_name: string
  name?: string
  class?: string
  type?: string
  importance?: number
  boundingbox?: [string, string, string, string]
  address?: NominatimAddress
  geojson?: Geometry
  extratags?: Record<string, string> | null
  namedetails?: Record<string, string> | null
}

function toBoundingBox(bbox: NominatimPlace['boundingbox']): BoundingBox | undefined {
  if (!bbox || bbox.length !== 4) return undefined
  const [south, north, west, east] = bbox.map(Number)
  if (![south, north, west, east].every(Number.isFinite)) return undefined
  return { south, north, west, east }
}

function primaryName(place: NominatimPlace): string {
  const fromDetails = place.namedetails?.name ?? place.namedetails?.['name:en']
  return place.name || fromDetails || place.display_name.split(',')[0].trim()
}

function shortAddress(place: NominatimPlace): string | undefined {
  const parts = place.display_name.split(',').map((p) => p.trim())
  // Drop the leading name and the trailing country/postcode noise.
  const trimmed = parts.slice(1)
  if (trimmed.length === 0) return undefined
  return trimmed.slice(0, 4).join(', ')
}

function cityOf(address: NominatimAddress | undefined): string | undefined {
  if (!address) return undefined
  return address.city ?? address.town ?? address.village ?? address.municipality
}

function normalizeWebsite(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim().split(';')[0].trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function osmUrl(place: NominatimPlace): string | undefined {
  if (!place.osm_type || !place.osm_id) return undefined
  return `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`
}

function toResult(place: NominatimPlace, retrievedAt: string): GeocodeResult | null {
  const latitude = Number(place.lat)
  const longitude = Number(place.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const { placeType, category } = classifyOsm(place.class, place.type)
  const extratags = place.extratags ?? {}
  const geometry =
    place.geojson && place.geojson.type !== 'Point' && geometrySize(place.geojson) <= MAX_GEOMETRY_POINTS
      ? place.geojson
      : undefined

  const source: PlaceSource = {
    provider: 'nominatim',
    label: 'OpenStreetMap / Nominatim',
    url: osmUrl(place) ?? `${ENDPOINT}/details?place_id=${place.place_id}`,
    ref: place.osm_type && place.osm_id ? `${place.osm_type}/${place.osm_id}` : String(place.place_id),
    license: 'ODbL 1.0 — © OpenStreetMap contributors',
    retrievedAt,
  }

  return {
    id: `nominatim:${place.osm_type ?? 'place'}/${place.osm_id ?? place.place_id}`,
    providerId: 'nominatim',
    name: primaryName(place),
    displayName: place.display_name,
    latitude,
    longitude,
    placeType,
    rawType: rawTypeLabel(place.class, place.type),
    rawClass: place.class,
    address: shortAddress(place),
    city: cityOf(place.address),
    country: place.address?.country,
    countryCode: place.address?.country_code?.toUpperCase(),
    boundingBox: toBoundingBox(place.boundingbox),
    geometry,
    website: normalizeWebsite(extratags.website ?? extratags['contact:website'] ?? extratags.url),
    wikidata: extratags.wikidata,
    wikipedia: extratags.wikipedia,
    suggestedCategory: category,
    importance: place.importance,
    sources: [source],
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Smallest rectangle we are willing to send, in degrees (~33 km).
 * A single saved place yields a zero-area box, which Nominatim rejects with
 * `400 Bad Request`, so degenerate boxes are widened into a real rectangle.
 */
const MIN_VIEWBOX_SPAN = 0.3

function viewboxParam(box: BoundingBox): string | null {
  let south = Math.min(box.south, box.north)
  let north = Math.max(box.south, box.north)
  let west = Math.min(box.west, box.east)
  let east = Math.max(box.west, box.east)
  if (![south, north, west, east].every(Number.isFinite)) return null

  const latPad = Math.max(0, MIN_VIEWBOX_SPAN - (north - south)) / 2
  const lonPad = Math.max(0, MIN_VIEWBOX_SPAN - (east - west)) / 2
  south = clamp(south - latPad, -85, 85)
  north = clamp(north + latPad, -85, 85)
  west = clamp(west - lonPad, -180, 180)
  east = clamp(east + lonPad, -180, 180)
  if (north - south <= 0 || east - west <= 0) return null

  // Nominatim wants left,top,right,bottom.
  return `${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)},${south.toFixed(5)}`
}

export class NominatimProvider implements GeocodingProvider {
  readonly id = 'nominatim'
  readonly name = 'Nominatim (OpenStreetMap)'
  readonly attribution = '© OpenStreetMap contributors — geocoding by Nominatim'
  readonly minIntervalMs = MIN_INTERVAL_MS

  private readonly queue = new RateLimitedQueue(MIN_INTERVAL_MS, 'nominatim')

  get pending(): number {
    return this.queue.pending
  }

  async search(query: GeocodeQuery): Promise<GeocodeResult[]> {
    const text = query.query.trim()
    if (text.length < 2) return []

    const params = new URLSearchParams({
      q: text,
      format: 'jsonv2',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      polygon_geojson: '1',
      limit: String(Math.min(query.limit ?? 8, 20)),
      'accept-language': query.language ?? 'en',
    })
    if (query.countryCodes?.length) params.set('countrycodes', query.countryCodes.join(',').toLowerCase())

    const viewbox = query.viewbox ? viewboxParam(query.viewbox) : null
    if (viewbox) {
      params.set('viewbox', viewbox)
      // Soft bias only: results outside the box are still returned.
      params.set('bounded', '0')
    }

    try {
      return await this.runSearch(params, query.signal)
    } catch (error) {
      // The location bias is a nicety, never a reason to fail in the user's
      // face: if the service rejects the request, retry it unbiased once.
      if (viewbox && error instanceof HttpError && error.status === 400) {
        params.delete('viewbox')
        params.delete('bounded')
        return await this.runSearch(params, query.signal)
      }
      throw error
    }
  }

  private async runSearch(params: URLSearchParams, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const url = `${ENDPOINT}/search?${params.toString()}`
    const key = `nominatim:search:${hashKey(url)}`

    const raw = await cached(key, CACHE_TTL, () =>
      this.queue.add(() => fetchJson<NominatimPlace[]>(url, { signal, timeoutMs: 20000 })),
    )

    const retrievedAt = new Date().toISOString()
    const results = raw
      .map((place) => toResult(place, retrievedAt))
      .filter((r): r is GeocodeResult => r !== null)

    // Nominatim can return the same OSM object twice for fuzzy queries.
    const seen = new Set<string>()
    return results.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
  }

  async reverse(latitude: number, longitude: number, signal?: AbortSignal): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      zoom: '17',
      'accept-language': 'en',
    })
    const url = `${ENDPOINT}/reverse?${params.toString()}`
    const key = `nominatim:reverse:${hashKey(url)}`
    const raw = await cached(key, CACHE_TTL, () =>
      this.queue.add(() => fetchJson<NominatimPlace>(url, { signal, timeoutMs: 20000 })),
    )
    if (!raw || !('lat' in raw)) return null
    return toResult(raw, new Date().toISOString())
  }
}

export const nominatim = new NominatimProvider()
