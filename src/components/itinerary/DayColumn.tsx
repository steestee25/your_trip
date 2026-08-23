import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { formatDistance, haversine, pathLength, type LatLng } from '../../lib/geo'
import { formatDateLabel } from '../../lib/time'
import { itemsForDay, placeMap } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { Day } from '../../types'
import { AddToDayMenu } from './AddToDayMenu'
import { ItemRow } from './ItemRow'

export function DayColumn({ day }: { day: Day }) {
  const { trip, dispatch } = useStore()
  const { selectedDay, setSelectedDay, openModal } = useUi()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const places = useMemo(() => placeMap(trip), [trip])
  const items = useMemo(() => itemsForDay(trip, day.id), [trip, day.id])
  const isFocused = selectedDay === day.id

  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.id}`, data: { kind: 'day', dayId: day.id } })

  const points = useMemo<LatLng[]>(
    () =>
      items
        .map((item) => (item.placeId ? places.get(item.placeId) : undefined))
        .filter((p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number')
        .map((p) => ({ latitude: p!.latitude as number, longitude: p!.longitude as number })),
    [items, places],
  )

  const totalMinutes = items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0)
  const totalDistance = points.length > 1 ? pathLength(points) : 0

  return (
    <section
      data-testid={`day-${day.index}`}
      className={cx(
        'rounded-2xl border bg-white transition-all',
        isFocused ? 'border-brand-600 shadow-panel' : 'border-slate-200',
        isOver && 'border-brand-500 ring-2 ring-brand-500/30',
      )}
    >
      <header className="flex items-start gap-2 px-3 pt-2.5 pb-2">
        <button
          type="button"
          onClick={() => setSelectedDay(isFocused ? 'all' : day.id)}
          title={isFocused ? 'Show all places on the map' : 'Show only this day on the map'}
          className={cx(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold transition-colors',
            isFocused ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          {day.index + 1}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={day.title ?? ''}
              placeholder={`Day ${day.index + 1}`}
              onChange={(e) => dispatch({ type: 'days/patch', dayId: day.id, patch: { title: e.target.value } })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              className="w-full rounded-md border border-slate-300 px-1.5 py-0.5 text-[13px] font-semibold focus:border-brand-600 focus:outline-none"
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="block max-w-full text-left">
              <span className="truncate text-[13px] font-bold text-slate-800">
                {day.title?.trim() || `Day ${day.index + 1}`}
              </span>
              {day.date && <span className="ml-1.5 text-[11px] font-normal text-slate-400">{formatDateLabel(day.date)}</span>}
            </button>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
            <span>{items.length === 0 ? 'Nothing planned' : `${items.length} ${items.length === 1 ? 'stop' : 'stops'}`}</span>
            {totalMinutes > 0 && <span>· {Math.round((totalMinutes / 60) * 10) / 10} h planned</span>}
            {totalDistance > 0 && <span>· {formatDistance(totalDistance)} apart</span>}
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-0.5">
          {items.length >= 3 && (
            <button
              type="button"
              onClick={() => openModal({ kind: 'optimize', dayId: day.id })}
              title="Suggest a shorter order for this day"
              className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Optimise
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Add to this day"
            className={cx(
              'grid h-7 w-7 place-items-center rounded-lg transition-colors',
              menuOpen ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
          </button>
          {menuOpen && <AddToDayMenu day={day} onClose={() => setMenuOpen(false)} />}
        </div>
      </header>

      <div
        ref={setNodeRef}
        data-testid={`day-body-${day.index}`}
        className={cx(
          'min-h-[54px] px-2.5 pb-2.5 transition-colors',
          isOver && 'bg-brand-50/60',
        )}
      >
        {items.length === 0 ? (
          <div
            className={cx(
              'grid place-items-center rounded-xl border-2 border-dashed px-3 py-4 text-center text-[11px] leading-snug transition-colors',
              isOver ? 'border-brand-500 bg-white text-brand-700' : 'border-slate-200 text-slate-400',
            )}
          >
            Drag a place here, or use + to add a stop, an activity or a transfer.
          </div>
        ) : (
          <SortableContext
            items={items.map((item) => `item:${item.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="space-y-1.5">
              {items.map((item, index) => {
                const place = item.placeId ? places.get(item.placeId) : undefined
                const previous = index > 0 ? items[index - 1] : undefined
                const previousPlace = previous?.placeId ? places.get(previous.placeId) : undefined
                const leg =
                  place && previousPlace && isLocated(place) && isLocated(previousPlace)
                    ? haversine(
                        { latitude: previousPlace.latitude!, longitude: previousPlace.longitude! },
                        { latitude: place.latitude!, longitude: place.longitude! },
                      )
                    : null
                return (
                  <div key={item.id}>
                    {leg !== null && leg > 50 && (
                      <div className="flex items-center gap-1.5 py-0.5 pl-8 text-[10px] text-slate-400">
                        <span className="h-3 w-px bg-slate-200" />
                        <span>{formatDistance(leg)} away (straight line)</span>
                      </div>
                    )}
                    <ItemRow item={item} index={index} place={place} />
                  </div>
                )
              })}
            </ol>
          </SortableContext>
        )}
      </div>
    </section>
  )
}

function isLocated(place: { latitude?: number; longitude?: number }): boolean {
  return typeof place.latitude === 'number' && typeof place.longitude === 'number'
}
