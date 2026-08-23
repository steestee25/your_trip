import { nowIso, uid } from '../lib/id'
import { addDaysIso } from '../lib/time'
import type {
  AppData,
  AppSettings,
  Category,
  Day,
  Destination,
  GeoPlaceInput,
  ItemPatch,
  ItineraryItem,
  Place,
  PlacePatch,
  Trip,
} from '../types'
import { createPlace, createTrip } from './factory'

export type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'trip/create'; name?: string; days?: number; startDate?: string }
  | { type: 'trip/select'; tripId: string }
  | { type: 'trip/patch'; patch: Partial<Pick<Trip, 'name' | 'startDate' | 'notes'>> }
  | { type: 'trip/delete'; tripId: string }
  | { type: 'days/setCount'; count: number }
  | { type: 'days/add' }
  | { type: 'days/remove'; dayId: string }
  | { type: 'days/patch'; dayId: string; patch: Partial<Omit<Day, 'id' | 'index'>> }
  | { type: 'days/reorder'; orderedIds: string[] }
  | { type: 'places/add'; input: GeoPlaceInput; addToDayId?: string }
  | { type: 'places/addMany'; inputs: GeoPlaceInput[] }
  | { type: 'places/patch'; placeId: string; patch: PlacePatch }
  | { type: 'places/remove'; placeId: string }
  | { type: 'places/removeMany'; placeIds: string[] }
  | { type: 'categories/add'; category: Omit<Category, 'id'> & { id?: string } }
  | { type: 'categories/patch'; categoryId: string; patch: Partial<Omit<Category, 'id'>> }
  | { type: 'categories/remove'; categoryId: string }
  | { type: 'items/add'; dayId: string; item: Partial<ItineraryItem>; index?: number }
  | { type: 'items/addPlaces'; dayId: string; placeIds: string[]; index?: number }
  | { type: 'items/patch'; itemId: string; patch: ItemPatch }
  | { type: 'items/remove'; itemId: string }
  | { type: 'items/move'; itemId: string; toDayId: string; toIndex: number }
  | { type: 'items/reorder'; dayId: string; orderedIds: string[] }
  | { type: 'items/setOrder'; dayId: string; orderedIds: string[] }
  | { type: 'items/clearDay'; dayId: string }
  | { type: 'items/autoTime'; dayId: string; startTime: string; gapMinutes: number }
  | { type: 'destinations/add'; destination: Omit<Destination, 'id'> & { id?: string } }
  | { type: 'destinations/remove'; destinationId: string }
  | { type: 'settings/patch'; patch: Partial<AppSettings> }
  | { type: 'data/import'; data: AppData; mode: 'replace' | 'merge' }
  | { type: 'trip/import'; trip: Trip }
  | { type: 'data/reset' }

const DEFAULT_ITEM_DURATION: Record<string, number> = {
  poi: 60,
  area: 120,
  city: 240,
  activity: 60,
}

/** Re-numbers `order` to 0..n-1 following array position. */
function renumber(items: ItineraryItem[]): ItineraryItem[] {
  return items.map((item, index) => (item.order === index ? item : { ...item, order: index }))
}

function itemsOfDay(items: ItineraryItem[], dayId: string): ItineraryItem[] {
  return items.filter((i) => i.dayId === dayId).sort((a, b) => a.order - b.order)
}

/** Rebuilds the whole item list from a per-day ordering. */
function withDayItems(all: ItineraryItem[], dayId: string, dayItems: ItineraryItem[]): ItineraryItem[] {
  const others = all.filter((i) => i.dayId !== dayId)
  return [...others, ...renumber(dayItems)]
}

function activeTrip(state: AppData): Trip | undefined {
  return state.trips.find((t) => t.id === state.activeTripId)
}

/** Applies a change to the active trip and stamps `updatedAt`. */
function updateActive(state: AppData, updater: (trip: Trip) => Trip): AppData {
  const current = activeTrip(state)
  if (!current) return state
  const next = updater(current)
  if (next === current) return state
  return {
    ...state,
    trips: state.trips.map((t) => (t.id === current.id ? { ...next, updatedAt: nowIso() } : t)),
  }
}

function defaultDurationFor(trip: Trip, item: Partial<ItineraryItem>): number | undefined {
  if (item.durationMinutes !== undefined) return item.durationMinutes
  if (item.placeId) {
    const place = trip.places.find((p) => p.id === item.placeId)
    if (place?.durationMinutes) return place.durationMinutes
    if (place) return DEFAULT_ITEM_DURATION[place.type] ?? 60
  }
  if (item.type === 'transport') return 30
  return 60
}

function makeItem(trip: Trip, dayId: string, partial: Partial<ItineraryItem>, order: number): ItineraryItem {
  const place = partial.placeId ? trip.places.find((p) => p.id === partial.placeId) : undefined
  const type: ItineraryItem['type'] =
    partial.type ?? (place ? (place.type === 'activity' ? 'activity' : 'place') : 'activity')
  return {
    id: partial.id ?? uid('item'),
    dayId,
    placeId: partial.placeId,
    type,
    title: partial.title ?? (place ? undefined : 'New activity'),
    startTime: partial.startTime,
    endTime: partial.endTime,
    durationMinutes: defaultDurationFor(trip, { ...partial, type }),
    notes: partial.notes,
    transportMode: partial.transportMode,
    order,
  }
}

function insertAt(list: ItineraryItem[], item: ItineraryItem, index?: number): ItineraryItem[] {
  const copy = [...list]
  const at = index === undefined || index < 0 || index > copy.length ? copy.length : index
  copy.splice(at, 0, item)
  return copy
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'hydrate':
      return action.data

    case 'trip/create': {
      const trip = createTrip({ name: action.name, days: action.days, startDate: action.startDate })
      return { ...state, trips: [...state.trips, trip], activeTripId: trip.id }
    }

    case 'trip/select':
      return state.trips.some((t) => t.id === action.tripId)
        ? { ...state, activeTripId: action.tripId }
        : state

    case 'trip/patch':
      return updateActive(state, (trip) => {
        const next = { ...trip, ...action.patch }
        // Changing the start date re-dates every day, keeping the offsets.
        if (action.patch.startDate !== undefined) {
          next.days = trip.days.map((day) => ({
            ...day,
            date: action.patch.startDate ? addDaysIso(action.patch.startDate, day.index) : undefined,
          }))
        }
        return next
      })

    case 'trip/delete': {
      const trips = state.trips.filter((t) => t.id !== action.tripId)
      if (trips.length === 0) {
        const fresh = createTrip({ name: 'My trip', days: 3 })
        return { ...state, trips: [fresh], activeTripId: fresh.id }
      }
      return {
        ...state,
        trips,
        activeTripId: state.activeTripId === action.tripId ? trips[0].id : state.activeTripId,
      }
    }

    case 'days/setCount':
      return updateActive(state, (trip) => {
        const count = Math.max(1, Math.min(action.count, 120))
        if (count === trip.days.length) return trip
        if (count < trip.days.length) {
          const removed = trip.days.slice(count)
          const removedIds = new Set(removed.map((d) => d.id))
          return {
            ...trip,
            days: trip.days.slice(0, count),
            // Items on deleted days go back to the Inbox rather than vanishing.
            items: trip.items.filter((i) => !removedIds.has(i.dayId)),
          }
        }
        const extra = Array.from({ length: count - trip.days.length }, (_, i) => ({
          id: uid('day'),
          index: trip.days.length + i,
          date: trip.startDate ? addDaysIso(trip.startDate, trip.days.length + i) : undefined,
        }))
        return { ...trip, days: [...trip.days, ...extra] }
      })

    case 'days/add':
      return reducer(state, { type: 'days/setCount', count: (activeTrip(state)?.days.length ?? 0) + 1 })

    case 'days/remove':
      return updateActive(state, (trip) => {
        if (trip.days.length <= 1) return trip
        const days = trip.days
          .filter((d) => d.id !== action.dayId)
          .map((d, index) => ({
            ...d,
            index,
            date: trip.startDate ? addDaysIso(trip.startDate, index) : d.date,
          }))
        return { ...trip, days, items: trip.items.filter((i) => i.dayId !== action.dayId) }
      })

    case 'days/patch':
      return updateActive(state, (trip) => ({
        ...trip,
        days: trip.days.map((d) => (d.id === action.dayId ? { ...d, ...action.patch } : d)),
      }))

    case 'days/reorder':
      return updateActive(state, (trip) => {
        const byId = new Map(trip.days.map((d) => [d.id, d]))
        const days = action.orderedIds
          .map((id) => byId.get(id))
          .filter((d): d is Day => Boolean(d))
          .map((d, index) => ({
            ...d,
            index,
            date: trip.startDate ? addDaysIso(trip.startDate, index) : d.date,
          }))
        return days.length === trip.days.length ? { ...trip, days } : trip
      })

    case 'places/add': {
      const place = createPlace(action.input)
      const next = updateActive(state, (trip) => ({ ...trip, places: [...trip.places, place] }))
      if (!action.addToDayId) return next
      return reducer(next, {
        type: 'items/addPlaces',
        dayId: action.addToDayId,
        placeIds: [place.id],
      })
    }

    case 'places/addMany': {
      const places = action.inputs.map(createPlace)
      return updateActive(state, (trip) => ({ ...trip, places: [...trip.places, ...places] }))
    }

    case 'places/patch':
      return updateActive(state, (trip) => ({
        ...trip,
        places: trip.places.map((p) =>
          p.id === action.placeId ? { ...p, ...action.patch, updatedAt: nowIso() } : p,
        ),
      }))

    case 'places/remove':
      return reducer(state, { type: 'places/removeMany', placeIds: [action.placeId] })

    case 'places/removeMany': {
      const ids = new Set(action.placeIds)
      return updateActive(state, (trip) => {
        const remainingItems = trip.items.filter((i) => !i.placeId || !ids.has(i.placeId))
        const byDay = new Map<string, ItineraryItem[]>()
        for (const item of remainingItems) {
          const list = byDay.get(item.dayId) ?? []
          list.push(item)
          byDay.set(item.dayId, list)
        }
        const items: ItineraryItem[] = []
        for (const [, list] of byDay) {
          items.push(...renumber(list.sort((a, b) => a.order - b.order)))
        }
        return {
          ...trip,
          places: trip.places
            .filter((p) => !ids.has(p.id))
            // Orphaned children keep existing, they just lose the parent link.
            .map((p) => (p.parentPlaceId && ids.has(p.parentPlaceId) ? { ...p, parentPlaceId: undefined } : p)),
          items,
        }
      })
    }

    case 'categories/add':
      return updateActive(state, (trip) => ({
        ...trip,
        categories: [...trip.categories, { ...action.category, id: action.category.id ?? uid('cat') }],
      }))

    case 'categories/patch':
      return updateActive(state, (trip) => ({
        ...trip,
        categories: trip.categories.map((c) =>
          c.id === action.categoryId ? { ...c, ...action.patch } : c,
        ),
      }))

    case 'categories/remove':
      return updateActive(state, (trip) => {
        const target = trip.categories.find((c) => c.id === action.categoryId)
        if (!target || target.builtIn) return trip
        return {
          ...trip,
          categories: trip.categories.filter((c) => c.id !== action.categoryId),
          places: trip.places.map((p) => (p.category === action.categoryId ? { ...p, category: 'other' } : p)),
        }
      })

    case 'items/add':
      return updateActive(state, (trip) => {
        const dayItems = itemsOfDay(trip.items, action.dayId)
        const item = makeItem(trip, action.dayId, action.item, dayItems.length)
        return { ...trip, items: withDayItems(trip.items, action.dayId, insertAt(dayItems, item, action.index)) }
      })

    case 'items/addPlaces':
      return updateActive(state, (trip) => {
        let dayItems = itemsOfDay(trip.items, action.dayId)
        let cursor = action.index
        for (const placeId of action.placeIds) {
          const item = makeItem(trip, action.dayId, { placeId }, dayItems.length)
          dayItems = insertAt(dayItems, item, cursor)
          if (cursor !== undefined) cursor += 1
        }
        return { ...trip, items: withDayItems(trip.items, action.dayId, dayItems) }
      })

    case 'items/patch':
      return updateActive(state, (trip) => ({
        ...trip,
        items: trip.items.map((i) => (i.id === action.itemId ? { ...i, ...action.patch } : i)),
      }))

    case 'items/remove':
      return updateActive(state, (trip) => {
        const target = trip.items.find((i) => i.id === action.itemId)
        if (!target) return trip
        const dayItems = itemsOfDay(trip.items, target.dayId).filter((i) => i.id !== action.itemId)
        return { ...trip, items: withDayItems(trip.items, target.dayId, dayItems) }
      })

    case 'items/move':
      return updateActive(state, (trip) => {
        const target = trip.items.find((i) => i.id === action.itemId)
        if (!target) return trip
        if (target.dayId === action.toDayId) {
          const dayItems = itemsOfDay(trip.items, target.dayId)
          const from = dayItems.findIndex((i) => i.id === action.itemId)
          if (from === -1) return trip
          const [moved] = dayItems.splice(from, 1)
          const to = Math.max(0, Math.min(action.toIndex, dayItems.length))
          dayItems.splice(to, 0, moved)
          return { ...trip, items: withDayItems(trip.items, target.dayId, dayItems) }
        }
        const sourceItems = itemsOfDay(trip.items, target.dayId).filter((i) => i.id !== action.itemId)
        const destItems = insertAt(
          itemsOfDay(trip.items, action.toDayId),
          { ...target, dayId: action.toDayId },
          action.toIndex,
        )
        const rest = trip.items.filter((i) => i.dayId !== target.dayId && i.dayId !== action.toDayId)
        return {
          ...trip,
          items: [...rest, ...renumber(sourceItems), ...renumber(destItems)],
        }
      })

    case 'items/reorder':
    case 'items/setOrder':
      return updateActive(state, (trip) => {
        const byId = new Map(itemsOfDay(trip.items, action.dayId).map((i) => [i.id, i]))
        const ordered = action.orderedIds
          .map((id) => byId.get(id))
          .filter((i): i is ItineraryItem => Boolean(i))
        if (ordered.length !== byId.size) return trip
        return { ...trip, items: withDayItems(trip.items, action.dayId, ordered) }
      })

    case 'items/clearDay':
      return updateActive(state, (trip) => ({
        ...trip,
        items: trip.items.filter((i) => i.dayId !== action.dayId),
      }))

    case 'items/autoTime':
      return updateActive(state, (trip) => {
        const dayItems = itemsOfDay(trip.items, action.dayId)
        let cursor = timeToMinutes(action.startTime)
        if (cursor === null) return trip
        const updated = dayItems.map((item) => {
          const duration = item.durationMinutes ?? 60
          const start = cursor as number
          const end = start + duration
          cursor = end + action.gapMinutes
          return { ...item, startTime: minutesToTime(start), endTime: minutesToTime(end) }
        })
        return { ...trip, items: withDayItems(trip.items, action.dayId, updated) }
      })

    case 'destinations/add':
      return updateActive(state, (trip) => {
        const destination: Destination = { ...action.destination, id: action.destination.id ?? uid('dest') }
        if (trip.destinations.some((d) => d.name === destination.name)) return trip
        return { ...trip, destinations: [...trip.destinations, destination] }
      })

    case 'destinations/remove':
      return updateActive(state, (trip) => ({
        ...trip,
        destinations: trip.destinations.filter((d) => d.id !== action.destinationId),
      }))

    case 'settings/patch':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'data/import': {
      if (action.mode === 'replace') return action.data
      const existing = new Set(state.trips.map((t) => t.id))
      const incoming = action.data.trips.map((t) => (existing.has(t.id) ? { ...t, id: uid('trip') } : t))
      return {
        ...state,
        trips: [...state.trips, ...incoming],
        activeTripId: incoming[0]?.id ?? state.activeTripId,
      }
    }

    case 'trip/import': {
      const exists = state.trips.some((t) => t.id === action.trip.id)
      const trip = exists ? { ...action.trip, id: uid('trip') } : action.trip
      return { ...state, trips: [...state.trips, trip], activeTripId: trip.id }
    }

    case 'data/reset': {
      const fresh = createTrip({ name: 'My trip', days: 3 })
      return { version: state.version, trips: [fresh], activeTripId: fresh.id, settings: state.settings }
    }

    default:
      return state
  }
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function minutesToTime(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

export { itemsOfDay, renumber }
export function placesById(trip: Trip): Map<string, Place> {
  return new Map(trip.places.map((p) => [p.id, p]))
}
