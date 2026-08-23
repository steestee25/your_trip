import type { Geometry } from 'geojson'
import type { BoundingBox, Place, PlaceSource, PlaceType } from '../types'

/** A candidate returned by a geocoder, before the user confirms it. */
export interface GeocodeResult {
  /** Provider-scoped unique id, used for de-duplication and cache keys. */
  id: string
  providerId: string
  name: string
  /** Full human readable address line from the provider. */
  displayName: string
  latitude: number
  longitude: number
  /** Mapped to our domain vocabulary. */
  placeType: PlaceType
  /** The provider's own classification, kept verbatim for transparency. */
  rawType?: string
  rawClass?: string
  address?: string
  city?: string
  country?: string
  countryCode?: string
  boundingBox?: BoundingBox
  geometry?: Geometry
  website?: string
  wikidata?: string
  wikipedia?: string
  /** Suggested category id, best effort; the user can always change it. */
  suggestedCategory?: string
  /** Provider confidence 0..1 when exposed, used only for ordering. */
  importance?: number
  sources: PlaceSource[]
}

export interface GeocodeQuery {
  query: string
  limit?: number
  /** Bias results towards the trip's destinations. */
  viewbox?: BoundingBox
  countryCodes?: string[]
  language?: string
  signal?: AbortSignal
}

/**
 * Swappable geocoding backend. The app only ever talks to this interface,
 * so replacing Nominatim with another service is a one-line change in
 * `providers/index.ts`.
 */
export interface GeocodingProvider {
  readonly id: string
  readonly name: string
  readonly attribution: string
  /** Documented minimum interval between calls, in ms. */
  readonly minIntervalMs: number
  search(query: GeocodeQuery): Promise<GeocodeResult[]>
  reverse?(latitude: number, longitude: number, signal?: AbortSignal): Promise<GeocodeResult | null>
}

export interface EnrichmentResult {
  description?: string
  website?: string
  wikipedia?: string
  wikidata?: string
  imageUrl?: string
  sources: PlaceSource[]
}

/** Adds free descriptive metadata to an already geocoded place. */
export interface EnrichmentProvider {
  readonly id: string
  readonly name: string
  readonly attribution: string
  /** Cheap pre-check so the UI can skip hopeless calls. */
  canEnrich(place: Place): boolean
  enrich(place: Place, signal?: AbortSignal): Promise<EnrichmentResult | null>
}

export type RoutingProfile = 'driving' | 'walking' | 'cycling'

export interface RouteLeg {
  distanceMeters: number
  durationSeconds: number
}

export interface RouteResult {
  distanceMeters: number
  durationSeconds: number
  legs: RouteLeg[]
  geometry?: Geometry
  /** false => real routed values, true => straight-line fallback. */
  estimated: boolean
  provider: string
  attribution: string
}

export interface RoutingPoint {
  latitude: number
  longitude: number
}

/** Swappable routing backend. Implementations must degrade, never throw at the UI. */
export interface RoutingProvider {
  readonly id: string
  readonly name: string
  readonly attribution: string
  /** Whether real routing is reachable/allowed right now. */
  isAvailable(): boolean
  route(
    points: RoutingPoint[],
    options?: { profile?: RoutingProfile; withGeometry?: boolean; signal?: AbortSignal },
  ): Promise<RouteResult>
}

export interface DiscoveredPlace extends GeocodeResult {
  distanceMeters?: number
}

/** Optional: find real OSM places inside an area. Used by the "nearby" panel. */
export interface DiscoveryProvider {
  readonly id: string
  readonly name: string
  readonly attribution: string
  discover(options: {
    boundingBox: BoundingBox
    categories?: string[]
    limit?: number
    signal?: AbortSignal
  }): Promise<DiscoveredPlace[]>
}
