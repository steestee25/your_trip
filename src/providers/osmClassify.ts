import type { PlaceType } from '../types'

/**
 * Maps an OSM class/type pair onto our four place types and a seed category.
 * Everything here is a best-effort presentation hint: the raw values are kept
 * on the Place and the user can always override the result.
 */

const CITY_PLACES = new Set([
  'city', 'town', 'village', 'hamlet', 'municipality', 'borough', 'island', 'archipelago',
])

const AREA_PLACES = new Set([
  'suburb', 'quarter', 'neighbourhood', 'city_block', 'district', 'region', 'county',
  'state', 'province', 'locality', 'isolated_dwelling', 'square', 'residential',
])

const CATEGORY_BY_CLASS: Record<string, string> = {
  tourism: 'attractions',
  historic: 'historic',
  leisure: 'nature',
  natural: 'nature',
  amenity: 'other',
  shop: 'shopping',
  railway: 'transport',
  aeroway: 'transport',
  public_transport: 'transport',
  highway: 'transport',
  building: 'other',
  man_made: 'attractions',
  place: 'neighborhoods',
  boundary: 'neighborhoods',
  landuse: 'nature',
  waterway: 'nature',
  club: 'entertainment',
  craft: 'shopping',
  office: 'other',
  healthcare: 'other',
}

const CATEGORY_BY_TYPE: Record<string, string> = {
  // tourism
  museum: 'museums',
  gallery: 'museums',
  artwork: 'photography',
  viewpoint: 'photography',
  attraction: 'attractions',
  theme_park: 'entertainment',
  zoo: 'entertainment',
  aquarium: 'entertainment',
  hotel: 'accommodation',
  hostel: 'accommodation',
  guest_house: 'accommodation',
  apartment: 'accommodation',
  motel: 'accommodation',
  camp_site: 'accommodation',
  information: 'other',
  // amenity
  restaurant: 'restaurants',
  fast_food: 'restaurants',
  food_court: 'restaurants',
  cafe: 'cafes',
  ice_cream: 'cafes',
  bar: 'bars',
  pub: 'bars',
  biergarten: 'bars',
  nightclub: 'entertainment',
  theatre: 'entertainment',
  cinema: 'entertainment',
  arts_centre: 'entertainment',
  casino: 'entertainment',
  marketplace: 'shopping',
  place_of_worship: 'historic',
  library: 'museums',
  university: 'historic',
  college: 'historic',
  townhall: 'historic',
  fountain: 'attractions',
  bus_station: 'transport',
  ferry_terminal: 'transport',
  taxi: 'transport',
  parking: 'transport',
  bicycle_rental: 'transport',
  // historic
  castle: 'historic',
  monument: 'historic',
  memorial: 'historic',
  ruins: 'historic',
  archaeological_site: 'historic',
  city_gate: 'historic',
  fort: 'historic',
  church: 'historic',
  cathedral: 'historic',
  // leisure / natural
  park: 'nature',
  garden: 'nature',
  nature_reserve: 'nature',
  beach: 'nature',
  beach_resort: 'nature',
  wood: 'nature',
  forest: 'nature',
  water: 'nature',
  peak: 'nature',
  cliff: 'nature',
  volcano: 'nature',
  common: 'nature',
  stadium: 'entertainment',
  sports_centre: 'entertainment',
  // railway / aeroway
  station: 'transport',
  halt: 'transport',
  subway_entrance: 'transport',
  tram_stop: 'transport',
  aerodrome: 'transport',
  terminal: 'transport',
  // shop
  department_store: 'shopping',
  mall: 'shopping',
  supermarket: 'shopping',
  bakery: 'cafes',
  // man_made
  bridge: 'attractions',
  tower: 'attractions',
  lighthouse: 'attractions',
  obelisk: 'historic',
}

export interface Classification {
  placeType: PlaceType
  category: string
}

export function classifyOsm(osmClass: string | undefined, osmType: string | undefined): Classification {
  const cls = (osmClass ?? '').toLowerCase()
  const type = (osmType ?? '').toLowerCase()

  let placeType: PlaceType = 'poi'
  if (cls === 'place') {
    if (CITY_PLACES.has(type)) placeType = 'city'
    else if (AREA_PLACES.has(type)) placeType = 'area'
  } else if (cls === 'boundary') {
    // administrative boundaries are areas unless they are clearly a settlement
    placeType = 'area'
  } else if (cls === 'landuse' && (type === 'residential' || type === 'commercial' || type === 'retail')) {
    placeType = 'area'
  }

  const category =
    CATEGORY_BY_TYPE[type] ??
    (placeType === 'city' ? 'other' : undefined) ??
    (placeType === 'area' ? 'neighborhoods' : undefined) ??
    CATEGORY_BY_CLASS[cls] ??
    'other'

  return { placeType, category }
}

/** Human label for the raw OSM tagging, e.g. `tourism · museum`. */
export function rawTypeLabel(osmClass?: string, osmType?: string): string | undefined {
  const parts = [osmClass, osmType].filter(Boolean) as string[]
  if (parts.length === 0) return undefined
  return parts.map((p) => p.replace(/_/g, ' ')).join(' · ')
}
