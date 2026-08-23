import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, Trip } from '../types'
import { createInitialData } from './factory'
import { estimateSize, loadState, saveState } from './persistence'
import { reducer, type Action } from './reducer'
import { sanitizeOrInitial } from './validate'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface StoreValue {
  data: AppData
  trip: Trip
  dispatch: (action: Action) => void
  ready: boolean
  saveState: SaveState
  saveError: string | null
  /** Bytes of the persisted document — surfaced in Settings. */
  storageBytes: number
  undo: () => void
  canUndo: boolean
}

const StoreContext = createContext<StoreValue | null>(null)

const UNDO_LIMIT = 40

/** Actions that should not create an undo checkpoint (noisy or trivial). */
const NO_UNDO: ReadonlySet<Action['type']> = new Set<Action['type']>([
  'hydrate',
  'trip/select',
  'settings/patch',
])

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, rawDispatch] = useReducer(reducer, undefined, createInitialData)
  const [ready, setReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [storageBytes, setStorageBytes] = useState(0)
  const [undoDepth, setUndoDepth] = useState(0)

  const history = useRef<AppData[]>([])
  const latest = useRef(data)
  latest.current = data
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydrated = useRef(false)

  // ---- hydrate once -------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await loadState()
      if (cancelled) return
      if (stored) rawDispatch({ type: 'hydrate', data: sanitizeOrInitial(stored) })
      hydrated.current = true
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- debounced persistence ---------------------------------------------
  useEffect(() => {
    if (!ready || !hydrated.current) return
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist(data)
    }, 400)

    async function persist(snapshot: AppData) {
      try {
        await saveState(snapshot)
        setStorageBytes(estimateSize(snapshot))
        setSaveStatus('saved')
        setSaveError(null)
      } catch (error) {
        setSaveStatus('error')
        setSaveError(error instanceof Error ? error.message : 'Could not save locally.')
      }
    }

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [data, ready])

  // Flush pending writes if the tab is closed mid-edit.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
        void saveState(latest.current).catch(() => undefined)
      }
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])

  const dispatch = useCallback((action: Action) => {
    if (!NO_UNDO.has(action.type)) {
      history.current.push(latest.current)
      if (history.current.length > UNDO_LIMIT) history.current.shift()
      setUndoDepth(history.current.length)
    }
    rawDispatch(action)
  }, [])

  const undo = useCallback(() => {
    const previous = history.current.pop()
    setUndoDepth(history.current.length)
    if (previous) rawDispatch({ type: 'hydrate', data: previous })
  }, [])

  const trip = useMemo(
    () => data.trips.find((t) => t.id === data.activeTripId) ?? data.trips[0],
    [data],
  )

  const value = useMemo<StoreValue>(
    () => ({
      data,
      trip,
      dispatch,
      ready,
      saveState: saveStatus,
      saveError,
      storageBytes,
      undo,
      canUndo: undoDepth > 0,
    }),
    [data, trip, dispatch, ready, saveStatus, saveError, storageBytes, undo, undoDepth],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside <StoreProvider>')
  return value
}

export function useTrip(): Trip {
  return useStore().trip
}

export function useDispatch(): (action: Action) => void {
  return useStore().dispatch
}
