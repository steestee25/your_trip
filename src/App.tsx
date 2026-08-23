import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useCallback, useEffect, useState } from 'react'
import { MobileSheet } from './components/MobileSheet'
import { TopBar } from './components/TopBar'
import { ItineraryPanel } from './components/itinerary/ItineraryPanel'
import { MapView } from './components/map/MapView'
import { AboutModal } from './components/modals/AboutModal'
import { CategoriesModal } from './components/modals/CategoriesModal'
import { ImportListModal } from './components/modals/ImportListModal'
import { OptimizeModal } from './components/modals/OptimizeModal'
import { TripSettingsModal } from './components/modals/TripSettingsModal'
import { TripsModal } from './components/modals/TripsModal'
import { PlaceDetail } from './components/place/PlaceDetail'
import { Sidebar } from './components/sidebar/Sidebar'
import { Toasts } from './components/ui/Toasts'
import { DESKTOP_QUERY, useMediaQuery } from './lib/useMediaQuery'
import { categoryById } from './state/categories'
import { itemsForDay } from './state/selectors'
import { useStore } from './state/store'
import { useUi } from './state/ui'

interface DragPreview {
  label: string
  emoji: string
}

export default function App() {
  const { trip, dispatch, ready, undo } = useStore()
  const { modal, closeModal, sidebarOpen, itineraryOpen, selectedPlaceId } = useUi()
  const [preview, setPreview] = useState<DragPreview | null>(null)
  // Only one of the two layouts is mounted: two copies would register the same
  // droppable ids twice and break drag & drop.
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const sensors = useSensors(
    // A small activation distance keeps plain clicks working on draggable cards.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        const target = event.target as HTMLElement | null
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as { kind?: string; placeId?: string; itemId?: string } | undefined
      if (data?.kind === 'place' && data.placeId) {
        const place = trip.places.find((p) => p.id === data.placeId)
        if (place) {
          setPreview({ label: place.name, emoji: categoryById(trip.categories, place.category).emoji })
        }
      } else if (data?.kind === 'item' && data.itemId) {
        const item = trip.items.find((i) => i.id === data.itemId)
        const place = item?.placeId ? trip.places.find((p) => p.id === item.placeId) : undefined
        setPreview({
          label: place?.name ?? item?.title ?? 'Stop',
          emoji: place
            ? categoryById(trip.categories, place.category).emoji
            : item?.type === 'transport'
              ? '🚉'
              : '📌',
        })
      }
    },
    [trip],
  )

  /**
   * One handler covers all four gestures: Inbox -> day, day -> day,
   * reorder inside a day, and day -> Inbox (which unplans the stop).
   */
  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setPreview(null)
      const { active, over } = event
      if (!over) return

      const from = active.data.current as
        | { kind: 'place'; placeId: string }
        | { kind: 'item'; itemId: string; dayId: string }
        | undefined
      const to = over.data.current as
        | { kind: 'day'; dayId: string }
        | { kind: 'item'; itemId: string; dayId: string }
        | { kind: 'inbox' }
        | undefined
      if (!from || !to) return

      if (to.kind === 'inbox') {
        if (from.kind === 'item') dispatch({ type: 'items/remove', itemId: from.itemId })
        return
      }

      const targetDayId = to.dayId
      const dayItems = itemsForDay(trip, targetDayId)
      const targetIndex =
        to.kind === 'item' ? dayItems.findIndex((item) => item.id === to.itemId) : dayItems.length

      if (from.kind === 'place') {
        dispatch({
          type: 'items/addPlaces',
          dayId: targetDayId,
          placeIds: [from.placeId],
          index: targetIndex === -1 ? undefined : targetIndex,
        })
        return
      }

      if (from.itemId === (to.kind === 'item' ? to.itemId : '')) return
      dispatch({
        type: 'items/move',
        itemId: from.itemId,
        toDayId: targetDayId,
        toIndex: targetIndex === -1 ? dayItems.length : targetIndex,
      })
    },
    [dispatch, trip],
  )

  if (!ready) {
    return (
      <div className="grid h-full place-items-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 animate-pulse place-items-center rounded-xl bg-brand-700 text-xl">
            📍
          </div>
          <p className="text-sm text-slate-500">Loading your trip…</p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setPreview(null)}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <TopBar />

        <main className="relative flex min-h-0 flex-1">
          {isDesktop && sidebarOpen && <Sidebar className="w-[22rem] shrink-0 border-r" />}

          <div className="relative min-w-0 flex-1">
            <MapView />

            {selectedPlaceId && (
              <div className="pointer-events-none absolute inset-0 z-600 flex items-stretch justify-start p-0 md:inset-auto md:top-16 md:bottom-3 md:left-3 md:items-start">
                <div className="pointer-events-auto flex h-full w-full md:max-h-full md:w-auto">
                  <PlaceDetail />
                </div>
              </div>
            )}
          </div>

          {isDesktop && itineraryOpen && <ItineraryPanel className="w-[23rem] shrink-0 border-l" />}

          {/* Mobile: the map stays full screen behind a bottom sheet. */}
          {!isDesktop && <MobileSheet />}
        </main>
      </div>

      <DragOverlay modifiers={[restrictToWindowEdges]} dropAnimation={null}>
        {preview && (
          <div className="dnd-overlay flex items-center gap-2 rounded-xl border border-brand-500 bg-white px-2.5 py-2 shadow-lg">
            <span className="text-[14px]">{preview.emoji}</span>
            <span className="max-w-[14rem] truncate text-[13px] font-semibold text-slate-800">{preview.label}</span>
          </div>
        )}
      </DragOverlay>

      {modal.kind === 'import-list' && <ImportListModal onClose={closeModal} />}
      {modal.kind === 'trip-settings' && <TripSettingsModal onClose={closeModal} />}
      {modal.kind === 'categories' && <CategoriesModal onClose={closeModal} />}
      {modal.kind === 'about' && <AboutModal onClose={closeModal} />}
      {modal.kind === 'trips' && <TripsModal onClose={closeModal} />}
      {modal.kind === 'optimize' && <OptimizeModal dayId={modal.dayId} onClose={closeModal} />}

      <Toasts />
    </DndContext>
  )
}
