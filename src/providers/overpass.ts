import { cached, DAY_MS } from '../lib/cache'
import { haversine } from '../lib/geo'
import { fetchJson } from '../lib/http'
import { RateLimitedQueue } from '../lib/queue'
import { hashKey } from '../lib/text'
import type { BoundingBox, PlaceSource } from '../types'
import { classifyOsm, rawTypeLabel } from './osmClassify'
import type { DiscoveredPlace, DiscoveryProvider } from './types'

/**
 * Overpass is a shared community resource with no key and a strict fair-use
 * policy: one query at a time, a hard timeout, a bounded result set and a
 * long cache. Discovery is always user-initiated, never automatic.
 */
const ENDPOINT = 'https://overpass-api.de/api/interpreter'
const MIN_INTERVAL_MS = 3000
const CACHE_TTL = 7 * DAY_MS
const QUERY_TIMEOUT_S = 25

const queue = new RateLimitedQueue(MIN_INTERVAL_MS, 'overpass')

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

/** Which OSM tags each of our categories maps onto when discovering places. */
const CATEGORY_FILTERS: Record<string, string[]> = {
  attractions: ['tourism~"^(attraction|viewpoint|artwork|theme_park|zoo|aquarium)$"', 'man_made~"^(tower|lighthouse|bridge)$"'],
  museums: ['tourism~"^(museum|gallery)$"'],
  historic: ['historic', 'amenity="place_of_worship"'],
  nature: ['leisure~"^(park|garden|nature_reserve)$"', 'natural~"^(beach|peak|wood|water)$"'],
  restaurants: ['amenity~"^(restaurant|food_court)$"'],
  cafes: ['amenity~"^(cafe|ice_cream)$"'],
  bars: ['amenity~"^(bar|pub|biergarten)$"'],
  shopping: ['shop~"^(department_store|mall|supermarket|books|clothes|gift)$"', 'amenity="marketplace"'],
  entertainment: ['amenity~"^(theatre|cinema|arts_centre|nightclub)$"'],
  accommodation: ['tourism~"^(hotel|hostel|guest_house|apartment)$"'],
  transport: ['railway="station"', 'amenity="ferry_terminal"'],
}

const DEFAULT_CATEGORIES = ['attractions', 'museums', 'historic', 'nature']

function buildQuery(box: BoundingBox, categories: string[]): string {
  const bbox = `${box.south.toFixed(5)},${box.west.toFixed(5)},${box.north.toFixed(5)},${box.east.toFixed(5)}`
  const clauses: string[] = []
  for (const category of categories) {
    for (const filter of CATEGORY_FILTERS[category] ?? []) {
      // Only named features: unnamed nodes are noise in a travel planner.
      clauses.push(`  node["name"][${filter}](${bbox});`)
      clauses.push(`  way["name"][${filter}](${bbox});`)
    }
  }
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];\n(\n${clauses.join('\n')}\n);\nout center tags 120;`
}

export class OverpassDiscoveryProvider implements DiscoveryProvider {
  readonly id = 'overpass'
  readonly name = 'Overpass API (OpenStreetMap)'
  readonly attribution = '© OpenStreetMap contributors — data via Overpass API'

  async discover(options: {
    boundingBox: BoundingBox
    categories?: string[]
    limit?: number
    signal?: AbortSignal
  }): Promise<DiscoveredPlace[]> {
    const categories = options.categories?.length ? options.categories : DEFAULT_CATEGORIES
    const body = buildQuery(options.boundingBox, categories)
    const key = `overpass:${hashKey(body)}`

    const data = await cached(key, CACHE_TTL, () =>
      queue.add(() =>
        fetchJson<OverpassResponse>(`${ENDPOINT}?data=${encodeURIComponent(body)}`, {
          signal: options.signal,
          timeoutMs: (QUERY_TIMEOUT_S + 10) * 1000,
          retries: 0,
        }),
      ),
    )

    const retrievedAt = new Date().toISOString()
    const centre = {
      latitude: (options.boundingBox.north + options.boundingBox.south) / 2,
      longitude: (options.boundingBox.east + options.boundingBox.west) / 2,
    }

    const results: DiscoveredPlace[] = []
    for (const element of data.elements ?? []) {
      const lat = element.lat ?? element.center?.lat
      const lon = element.lon ?? element.center?.lon
      const name = element.tags?.name
      if (lat === undefined || lon === undefined || !name) continue

      const tags = element.tags ?? {}
      const osmClass = ['tourism', 'historic', 'amenity', 'leisure', 'natural', 'shop', 'man_made', 'railway'].find(
        (k) => tags[k],
      )
      const osmType = osmClass ? tags[osmClass] : undefined
      const { placeType, category } = classifyOsm(osmClass, osmType)

      const source: PlaceSource = {
        provider: 'overpass',
        label: 'OpenStreetMap (Overpass)',
        url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        ref: `${element.type}/${element.id}`,
        license: 'ODbL 1.0 — © OpenStreetMap contributors',
        retrievedAt,
      }

      results.push({
        id: `overpass:${element.type}/${element.id}`,
        providerId: 'overpass',
        name,
        displayName: name,
        latitude: lat,
        longitude: lon,
        placeType,
        rawType: rawTypeLabel(osmClass, osmType),
        rawClass: osmClass,
        website: tags.website ?? tags['contact:website'],
        wikidata: tags.wikidata,
        wikipedia: tags.wikipedia,
        suggestedCategory: category,
        sources: [source],
        distanceMeters: haversine(centre, { latitude: lat, longitude: lon }),
      })
    }

    results.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    return results.slice(0, options.limit ?? 60)
  }
}

export const overpass = new OverpassDiscoveryProvider()
export const OVERPASS_CATEGORIES = Object.keys(CATEGORY_FILTERS)
