import type { Geometry } from 'geojson'

/** What kind of thing a saved place is. */
export type PlaceType = 'poi' | 'area' | 'city' | 'activity'

export type Priority = 'high' | 'medium' | 'low'

/**
 * Derived, never stored: `planned` is a function of the itinerary, so keeping it
 * on the Place would let the two drift apart. Only `visited` is user state.
 */
export type PlaceStatus = 'inbox' | 'planned' | 'visited'

/** Where a piece of information came from. Places always keep their provenance. */
export interface PlaceSource {
  /** Provider id, e.g. `nominatim`, `wikidata`, `wikipedia`, `overpass`, `manual`. */
  provider: string
  /** Human readable label shown in the UI. */
  label: string
  /** Canonical url for the record, when the provider exposes one. */
  url?: string
  /** Provider-side identifier (osm id, wikidata QID, ...). */
  ref?: string
  license?: string
  /** ISO timestamp of the moment the data was fetched. */
  retrievedAt: string
}

export interface BoundingBox {
  south: number
  west: number
  north: number
  east: number
}

export interface Place {
  id: string
  name: string
  type: PlaceType
  latitude?: number
  longitude?: number
  /** Real geometry when the source published one. Never synthesised. */
  geometry?: Geometry
  boundingBox?: BoundingBox
  address?: string
  city?: string
  country?: string
  countryCode?: string
  /** Category id, see `Category`. */
  category?: string
  /** Optional hierarchy: city -> area -> poi. Never required. */
  parentPlaceId?: string
  description?: string
  website?: string
  /** Stored as `lang:Title`, exactly like the OSM tag. */
  wikipedia?: string
  /** Wikidata QID. */
  wikidata?: string
  imageUrl?: string
  notes?: string
  priority?: Priority
  /** Default planned duration in minutes, used when dropping into a day. */
  durationMinutes?: number
  visited?: boolean
  /** Raw classification from the provider, kept for transparency. */
  rawType?: string
  sources?: PlaceSource[]
  createdAt: string
  updatedAt: string
}

export type ItineraryItemType = 'place' | 'activity' | 'transport'

export type TransportMode = 'walk' | 'transit' | 'car' | 'bike' | 'train' | 'ferry' | 'plane' | 'other'

export interface ItineraryItem {
  id: string
  dayId: string
  /** Optional: `Lunch`, `Travel`, ... do not need a place. */
  placeId?: string
  type: ItineraryItemType
  /** Used when there is no linked place (free-form activity / transport leg). */
  title?: string
  /** `HH:MM`, local to the destination. */
  startTime?: string
  endTime?: string
  durationMinutes?: number
  notes?: string
  transportMode?: TransportMode
  order: number
}

export interface Day {
  id: string
  /** 0-based position; `Day 1` is index 0. */
  index: number
  /** ISO date `YYYY-MM-DD`, optional. */
  date?: string
  title?: string
  notes?: string
}

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  /** Built-in categories cannot be deleted, only renamed/recoloured. */
  builtIn?: boolean
}

export interface Destination {
  id: string
  name: string
  latitude?: number
  longitude?: number
  country?: string
  boundingBox?: BoundingBox
}

export interface Trip {
  id: string
  name: string
  /** ISO date `YYYY-MM-DD`. When set, days get real dates. */
  startDate?: string
  notes?: string
  days: Day[]
  places: Place[]
  items: ItineraryItem[]
  categories: Category[]
  destinations: Destination[]
  createdAt: string
  updatedAt: string
}

export interface AppData {
  version: number
  trips: Trip[]
  activeTripId: string
  settings: AppSettings
}

export interface AppSettings {
  /** Allow calls to the public OSRM demo server for real road distances. */
  useRouting: boolean
  /** Allow Wikidata / Wikipedia enrichment calls. */
  useEnrichment: boolean
  /** Allow Overpass queries for discovering nearby OSM places. */
  useOverpass: boolean
  language: 'en'
  units: 'metric' | 'imperial'
}

/** A distance/time leg between two itinerary stops. */
export interface Leg {
  fromItemId: string
  toItemId: string
  distanceMeters: number
  durationSeconds?: number
  /** true => straight-line estimate, false => real routed value. */
  estimated: boolean
  provider: string
}

/** Loose input accepted by `createPlace`; every optional field stays optional. */
export interface GeoPlaceInput {
  id?: string
  name: string
  type: PlaceType
  latitude?: number
  longitude?: number
  geometry?: Geometry
  boundingBox?: BoundingBox
  address?: string
  city?: string
  country?: string
  countryCode?: string
  category?: string
  parentPlaceId?: string
  description?: string
  website?: string
  wikipedia?: string
  wikidata?: string
  imageUrl?: string
  notes?: string
  priority?: Priority
  durationMinutes?: number
  rawType?: string
  sources?: PlaceSource[]
}

export type PlacePatch = Partial<Omit<Place, 'id' | 'createdAt'>>
export type ItemPatch = Partial<Omit<ItineraryItem, 'id' | 'dayId'>>
