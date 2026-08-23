import { nominatim } from './nominatim'
import { osrm, estimateRoute } from './osrm'
import { overpass } from './overpass'
import { wikimedia } from './wikidata'
import type {
  DiscoveryProvider,
  EnrichmentProvider,
  GeocodingProvider,
  RoutingProvider,
} from './types'

/**
 * Single place where concrete providers are bound to the interfaces.
 * Swapping in a different geocoder/router only requires editing this file.
 */
export const geocodingProvider: GeocodingProvider = nominatim
export const enrichmentProvider: EnrichmentProvider = wikimedia
export const routingProvider: RoutingProvider = osrm
export const discoveryProvider: DiscoveryProvider = overpass

export { estimateRoute, nominatim, osrm, overpass, wikimedia }
export * from './types'

export const ATTRIBUTIONS = [
  { service: 'Map tiles & data', text: '© OpenStreetMap contributors (ODbL)', url: 'https://www.openstreetmap.org/copyright' },
  { service: 'Geocoding', text: 'Nominatim — max 1 request/second, results cached for 30 days', url: 'https://operations.osmfoundation.org/policies/nominatim/' },
  { service: 'Place details', text: 'Wikidata (CC0) and Wikipedia (CC BY-SA)', url: 'https://www.wikidata.org/' },
  { service: 'Nearby discovery', text: 'Overpass API — user-triggered only, cached for 7 days', url: 'https://wiki.openstreetmap.org/wiki/Overpass_API' },
  { service: 'Routing', text: 'OSRM public demo server — optional, falls back to straight-line estimates', url: 'https://project-osrm.org/' },
]
