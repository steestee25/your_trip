import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { cx } from '../../lib/cx'
import { hasCoords } from '../../lib/geo'
import { addMinutes, formatDurationMinutes } from '../../lib/time'
import { categoryById } from '../../state/categories'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { ItineraryItem, Place, TransportMode } from '../../types'
import { TextArea, TextInput } from '../ui/Field'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480]

const TRANSPORT_ICON: Record<TransportMode, string> = {
  walk: '🚶',
  transit: '🚇',
  car: '🚗',
  bike: '🚲',
  train: '🚆',
  ferry: '⛴️',
  plane: '✈️',
  other: '🚉',
}

interface Props {
  item: ItineraryItem
  index: number
  place?: Place
}

export function ItemRow({ item, index, place }: Props) {
  const { trip, dispatch } = useStore()
  const { selectPlace, selectedPlaceId, setHoveredPlaceId, focusOn } = useUi()
  const [expanded, setExpanded] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item:${item.id}`,
    data: { kind: 'item', itemId: item.id, dayId: item.dayId },
  })

  const category = place
    ? categoryById(trip.categories, place.category)
    : categoryById(trip.categories, item.type === 'transport' ? 'transport' : 'other')

  const title = place?.name ?? item.title ?? (item.type === 'transport' ? 'Travel' : 'Activity')
  const selected = place && selectedPlaceId === place.id
  const endTime = item.endTime ?? (item.startTime ? addMinutes(item.startTime, item.durationMinutes ?? 0) : undefined)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="itinerary-item"
      onMouseEnter={() => place && setHoveredPlaceId(place.id)}
      onMouseLeave={() => setHoveredPlaceId(null)}
      className={cx(
        'group relative rounded-xl border bg-white transition-all',
        selected ? 'border-brand-600 ring-2 ring-brand-600/15' : 'border-slate-200 hover:border-slate-300',
        isDragging && 'dnd-ghost z-50',
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reorder"
          className="flex w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-xl text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-500 active:cursor-grabbing"
        >
          <svg viewBox="0 0 12 20" className="h-4 w-3" fill="currentColor">
            <circle cx="4" cy="5" r="1.3" />
            <circle cx="8" cy="5" r="1.3" />
            <circle cx="4" cy="10" r="1.3" />
            <circle cx="8" cy="10" r="1.3" />
            <circle cx="4" cy="15" r="1.3" />
            <circle cx="8" cy="15" r="1.3" />
          </svg>
        </button>

        <div className="min-w-0 flex-1 py-2 pr-2">
          <div className="flex items-start gap-2">
            <span
              className="relative grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg text-[13px]"
              style={{ background: `${category.color}1a` }}
            >
              {item.type === 'transport' ? TRANSPORT_ICON[item.transportMode ?? 'other'] : category.emoji}
              <span className="absolute -top-1.5 -left-1.5 grid h-4 w-4 place-items-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
                {index + 1}
              </span>
            </span>

            <button
              type="button"
              onClick={() => {
                if (!place) {
                  setExpanded((v) => !v)
                  return
                }
                selectPlace(place.id)
                if (hasCoords(place)) {
                  focusOn({
                    latitude: place.latitude,
                    longitude: place.longitude,
                    zoom: place.type === 'poi' ? 16 : 13,
                  })
                }
              }}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-[13px] leading-tight font-semibold text-slate-800">{title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500">
                {item.startTime && (
                  <span className="font-semibold tabular-nums text-brand-700">
                    {item.startTime}
                    {endTime ? `–${endTime}` : ''}
                  </span>
                )}
                {item.durationMinutes ? <span>{formatDurationMinutes(item.durationMinutes)}</span> : null}
                {place && place.type !== 'poi' && (
                  <span className="rounded bg-slate-100 px-1 font-semibold text-slate-600 capitalize">
                    {place.type}
                  </span>
                )}
                {place && !hasCoords(place) && <span className="text-amber-600">no location</span>}
                {item.notes && <span className="truncate italic">“{item.notes}”</span>}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <IconButton
                label={expanded ? 'Close editor' : 'Edit'}
                onClick={() => setExpanded((v) => !v)}
                active={expanded}
              >
                <path d="M4 13.5V16h2.5l7.4-7.4-2.5-2.5L4 13.5Zm11.8-6.9a.7.7 0 0 0 0-1L14.4 4.2a.7.7 0 0 0-1 0l-1.2 1.2 2.5 2.5 1.1-1.3Z" />
              </IconButton>
              <IconButton label="Remove from day" onClick={() => dispatch({ type: 'items/remove', itemId: item.id })}>
                <path d="M7 3h6v2h4v2H3V5h4V3Zm-2 6h10l-.8 8.2a1 1 0 0 1-1 .8H6.8a1 1 0 0 1-1-.8L5 9Z" />
              </IconButton>
            </div>
          </div>

          {expanded && (
            <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 animate-fade">
              {!place && (
                <TextInput
                  value={item.title ?? ''}
                  onChange={(e) => dispatch({ type: 'items/patch', itemId: item.id, patch: { title: e.target.value } })}
                  placeholder={item.type === 'transport' ? 'Travel to…' : 'Lunch, free time…'}
                  className="py-1.5 text-[13px]"
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Start
                  </span>
                  <input
                    type="time"
                    value={item.startTime ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'items/patch',
                        itemId: item.id,
                        patch: {
                          startTime: e.target.value || undefined,
                          endTime: e.target.value
                            ? addMinutes(e.target.value, item.durationMinutes ?? 60)
                            : undefined,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] tabular-nums focus:border-brand-600 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Duration
                  </span>
                  <select
                    value={item.durationMinutes ?? 60}
                    onChange={(e) => {
                      const minutes = Number(e.target.value)
                      dispatch({
                        type: 'items/patch',
                        itemId: item.id,
                        patch: {
                          durationMinutes: minutes,
                          endTime: item.startTime ? addMinutes(item.startTime, minutes) : undefined,
                        },
                      })
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] focus:border-brand-600 focus:outline-none"
                  >
                    {DURATIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {formatDurationMinutes(minutes)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {item.type === 'transport' && (
                <label className="block">
                  <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Mode
                  </span>
                  <select
                    value={item.transportMode ?? 'other'}
                    onChange={(e) =>
                      dispatch({
                        type: 'items/patch',
                        itemId: item.id,
                        patch: { transportMode: e.target.value as TransportMode },
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] focus:border-brand-600 focus:outline-none"
                  >
                    {Object.keys(TRANSPORT_ICON).map((mode) => (
                      <option key={mode} value={mode}>
                        {TRANSPORT_ICON[mode as TransportMode]} {mode}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <TextArea
                rows={2}
                value={item.notes ?? ''}
                onChange={(e) => dispatch({ type: 'items/patch', itemId: item.id, patch: { notes: e.target.value } })}
                placeholder="Notes for this stop (booking reference, entrance, …)"
                className="py-1.5 text-[12px]"
              />
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        'grid h-6 w-6 place-items-center rounded-md transition-colors',
        active ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
        {children}
      </svg>
    </button>
  )
}
