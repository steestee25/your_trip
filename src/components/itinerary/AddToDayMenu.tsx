import { useEffect, useMemo, useRef, useState } from 'react'
import { ACTIVITY_PRESETS, TRANSPORT_PRESETS } from '../../features/placeFromResult'
import { cx } from '../../lib/cx'
import { categoryById } from '../../state/categories'
import { plannedPlaceIds } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { Day, TransportMode } from '../../types'

type Section = 'places' | 'activities' | 'transport' | 'tools'

export function AddToDayMenu({ day, onClose }: { day: Day; onClose: () => void }) {
  const { trip, dispatch } = useStore()
  const { pushToast } = useUi()
  const [section, setSection] = useState<Section>('places')
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const planned = useMemo(() => plannedPlaceIds(trip), [trip])
  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return trip.places
      .filter((place) => !needle || place.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aPlanned = planned.has(a.id) ? 1 : 0
        const bPlanned = planned.has(b.id) ? 1 : 0
        return aPlanned - bPlanned || a.name.localeCompare(b.name)
      })
      .slice(0, 40)
  }, [trip.places, query, planned])

  return (
    <div
      ref={ref}
      className="absolute top-8 right-0 z-100 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel animate-rise"
    >
      <div className="flex border-b border-slate-100">
        {(['places', 'activities', 'transport', 'tools'] as Section[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={cx(
              'flex-1 px-1 py-1.5 text-[11px] font-semibold capitalize transition-colors',
              section === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50',
            )}
          >
            {key}
          </button>
        ))}
      </div>

      {section === 'places' && (
        <div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a saved place…"
            className="w-full border-b border-slate-100 px-3 py-2 text-[12px] placeholder:text-slate-400 focus:outline-none"
          />
          <ul className="scroll-thin max-h-60 overflow-y-auto">
            {candidates.length === 0 && (
              <li className="px-3 py-4 text-center text-[11px] text-slate-400">
                No saved place yet — search for one first.
              </li>
            )}
            {candidates.map((place) => {
              const category = categoryById(trip.categories, place.category)
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'items/addPlaces', dayId: day.id, placeIds: [place.id] })
                      onClose()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-brand-50/60"
                  >
                    <span className="text-[13px]">{category.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-700">
                      {place.name}
                    </span>
                    {planned.has(place.id) && (
                      <span className="shrink-0 text-[9px] font-bold tracking-wide text-slate-400 uppercase">
                        planned
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {section === 'activities' && (
        <ul className="scroll-thin max-h-64 overflow-y-auto py-1">
          {ACTIVITY_PRESETS.map((preset) => (
            <li key={preset.name}>
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: 'items/add',
                    dayId: day.id,
                    item: {
                      type: 'activity',
                      title: preset.name,
                      durationMinutes: preset.durationMinutes,
                    },
                  })
                  onClose()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-brand-50/60"
              >
                <span className="text-[13px]">{preset.emoji}</span>
                <span className="flex-1 text-[12px] font-medium text-slate-700">{preset.name}</span>
                <span className="text-[10px] text-slate-400">{preset.durationMinutes} min</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {section === 'transport' && (
        <ul className="scroll-thin max-h-64 overflow-y-auto py-1">
          {TRANSPORT_PRESETS.map((preset) => (
            <li key={preset.name}>
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: 'items/add',
                    dayId: day.id,
                    item: {
                      type: 'transport',
                      title: preset.name,
                      transportMode: preset.mode as TransportMode,
                      durationMinutes: preset.durationMinutes,
                    },
                  })
                  onClose()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-brand-50/60"
              >
                <span className="text-[13px]">{preset.emoji}</span>
                <span className="flex-1 text-[12px] font-medium text-slate-700">{preset.name}</span>
                <span className="text-[10px] text-slate-400">{preset.durationMinutes} min</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {section === 'tools' && (
        <div className="space-y-1 p-2">
          <MenuAction
            label="Auto-schedule times"
            hint="From 09:00, 20 min between stops"
            onClick={() => {
              dispatch({ type: 'items/autoTime', dayId: day.id, startTime: '09:00', gapMinutes: 20 })
              pushToast('Times filled in from 09:00 — adjust any stop as you like', 'success')
              onClose()
            }}
          />
          <MenuAction
            label="Add a note to this day"
            hint={day.notes ? 'Edit the day note' : 'e.g. “Museum day”'}
            onClick={() => {
              const value = window.prompt('Note for this day', day.notes ?? '')
              if (value !== null) dispatch({ type: 'days/patch', dayId: day.id, patch: { notes: value } })
              onClose()
            }}
          />
          <MenuAction
            label="Clear this day"
            hint="Stops return to the Inbox"
            tone="danger"
            onClick={() => {
              dispatch({ type: 'items/clearDay', dayId: day.id })
              pushToast('Day cleared — the places are back in your Inbox')
              onClose()
            }}
          />
          <MenuAction
            label="Delete this day"
            hint="Removes the day itself"
            tone="danger"
            onClick={() => {
              if (trip.days.length <= 1) {
                pushToast('A trip needs at least one day', 'warning')
                return
              }
              dispatch({ type: 'days/remove', dayId: day.id })
              onClose()
            }}
          />
        </div>
      )}
    </div>
  )
}

function MenuAction({
  label,
  hint,
  onClick,
  tone,
}: {
  label: string
  hint?: string
  onClick: () => void
  tone?: 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'w-full rounded-lg px-2 py-1.5 text-left transition-colors',
        tone === 'danger' ? 'hover:bg-rose-50' : 'hover:bg-slate-100',
      )}
    >
      <span className={cx('block text-[12px] font-semibold', tone === 'danger' ? 'text-rose-600' : 'text-slate-700')}>
        {label}
      </span>
      {hint && <span className="block text-[10px] text-slate-400">{hint}</span>}
    </button>
  )
}
