import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { uid } from '../lib/id'
import type { BoundingBox } from '../types'
import { EMPTY_FILTERS, type PlaceFilters, type SortKey } from './selectors'

/** `all` = every place on the map; a day id = only that day's stops. */
export type DaySelection = 'all' | 'inbox' | string

export interface MapFocus {
  nonce: number
  latitude?: number
  longitude?: number
  bounds?: BoundingBox
  zoom?: number
}

export type ModalKind =
  | { kind: 'none' }
  | { kind: 'import-list' }
  | { kind: 'trip-settings' }
  | { kind: 'categories' }
  | { kind: 'about' }
  | { kind: 'trips' }
  | { kind: 'optimize'; dayId: string }
  | { kind: 'discover'; placeId: string }

export interface Toast {
  id: string
  message: string
  tone: 'info' | 'success' | 'warning' | 'error'
}

export type MobilePanel = 'map' | 'places' | 'itinerary'

interface UiValue {
  selectedDay: DaySelection
  setSelectedDay: (value: DaySelection) => void
  selectedPlaceId: string | null
  selectPlace: (placeId: string | null) => void
  hoveredPlaceId: string | null
  setHoveredPlaceId: (placeId: string | null) => void
  focus: MapFocus | null
  focusOn: (options: Omit<MapFocus, 'nonce'>) => void
  filters: PlaceFilters
  setFilters: (updater: (current: PlaceFilters) => PlaceFilters) => void
  resetFilters: () => void
  sort: SortKey
  setSort: (sort: SortKey) => void
  modal: ModalKind
  openModal: (modal: ModalKind) => void
  closeModal: () => void
  toasts: Toast[]
  pushToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
  mobilePanel: MobilePanel
  setMobilePanel: (panel: MobilePanel) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  itineraryOpen: boolean
  setItineraryOpen: (open: boolean) => void
}

const UiContext = createContext<UiValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<DaySelection>('all')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [filters, setFiltersState] = useState<PlaceFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('recent')
  const [modal, setModal] = useState<ModalKind>({ kind: 'none' })
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('map')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [itineraryOpen, setItineraryOpen] = useState(true)
  const nonce = useRef(0)

  const focusOn = useCallback((options: Omit<MapFocus, 'nonce'>) => {
    nonce.current += 1
    setFocus({ ...options, nonce: nonce.current })
  }, [])

  const setFilters = useCallback((updater: (current: PlaceFilters) => PlaceFilters) => {
    setFiltersState((current) => updater(current))
  }, [])

  const resetFilters = useCallback(() => setFiltersState(EMPTY_FILTERS), [])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (message: string, tone: Toast['tone'] = 'info') => {
      const id = uid('toast')
      setToasts((current) => [...current.slice(-3), { id, message, tone }])
      setTimeout(() => dismissToast(id), tone === 'error' ? 7000 : 4000)
    },
    [dismissToast],
  )

  const selectPlace = useCallback((placeId: string | null) => setSelectedPlaceId(placeId), [])
  const openModal = useCallback((next: ModalKind) => setModal(next), [])
  const closeModal = useCallback(() => setModal({ kind: 'none' }), [])

  const value = useMemo<UiValue>(
    () => ({
      selectedDay,
      setSelectedDay,
      selectedPlaceId,
      selectPlace,
      hoveredPlaceId,
      setHoveredPlaceId,
      focus,
      focusOn,
      filters,
      setFilters,
      resetFilters,
      sort,
      setSort,
      modal,
      openModal,
      closeModal,
      toasts,
      pushToast,
      dismissToast,
      mobilePanel,
      setMobilePanel,
      sidebarOpen,
      setSidebarOpen,
      itineraryOpen,
      setItineraryOpen,
    }),
    [
      selectedDay, selectedPlaceId, selectPlace, hoveredPlaceId, focus, focusOn, filters,
      setFilters, resetFilters, sort, modal, openModal, closeModal, toasts, pushToast,
      dismissToast, mobilePanel, sidebarOpen, itineraryOpen,
    ],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi(): UiValue {
  const value = useContext(UiContext)
  if (!value) throw new Error('useUi must be used inside <UiProvider>')
  return value
}
