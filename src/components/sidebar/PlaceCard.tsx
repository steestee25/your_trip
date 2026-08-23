import { useDraggable } from '@dnd-kit/core'
import { cx } from '../../lib/cx'
import { hasCoords } from '../../lib/geo'
import { formatDurationMinutes } from '../../lib/time'
import { categoryById } from '../../state/categories'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { Place } from '../../types'
import { TYPE_LABEL } from './SearchPanel'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-300',
}

interface Props {
  place: Place
  planned?: boolean
  compact?: boolean
}

export function PlaceCard({ place, planned, compact }: Props) {
  const { trip } = useStore()
  const { selectPlace, selectedPlaceId, setHoveredPlaceId, focusOn } = useUi()
  const category = categoryById(trip.categories, place.category)
  const selected = selectedPlaceId === place.id

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `place:${place.id}`,
    data: { kind: 'place', placeId: place.id },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHoveredPlaceId(place.id)}
      onMouseLeave={() => setHoveredPlaceId(null)}
      onClick={() => {
        selectPlace(place.id)
        if (hasCoords(place)) {
          focusOn({
            latitude: place.latitude,
            longitude: place.longitude,
            bounds: place.type === 'poi' ? undefined : place.boundingBox,
            zoom: place.type === 'poi' ? 16 : 13,
          })
        }
      }}
      role="button"
      tabIndex={0}
      data-testid="place-card"
      data-place-id={place.id}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectPlace(place.id)
        }
      }}
      className={cx(
        'group relative cursor-grab touch-none rounded-xl border bg-white px-2.5 py-2 transition-all select-none active:cursor-grabbing',
        selected
          ? 'border-brand-600 ring-2 ring-brand-600/15'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
        isDragging && 'dnd-ghost',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg text-[13px]"
          style={{ background: `${category.color}1a` }}
          title={category.name}
        >
          {category.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] leading-tight font-semibold text-slate-800">{place.name}</span>
            {place.priority && (
              <span
                className={cx('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[place.priority])}
                title={`${place.priority} priority`}
              />
            )}
          </div>

          {!compact && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
              {place.type !== 'poi' && (
                <span className="rounded bg-slate-100 px-1 py-px font-semibold text-slate-600">
                  {TYPE_LABEL[place.type]}
                </span>
              )}
              <span className="truncate">{place.city ?? place.address ?? category.name}</span>
              {place.durationMinutes ? <span>· {formatDurationMinutes(place.durationMinutes)}</span> : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {planned && (
            <span className="rounded bg-brand-50 px-1 py-px text-[10px] font-bold tracking-wide text-brand-700 uppercase">
              Planned
            </span>
          )}
          {place.visited && (
            <span className="rounded bg-emerald-50 px-1 py-px text-[10px] font-bold tracking-wide text-emerald-700 uppercase">
              Visited
            </span>
          )}
          {!hasCoords(place) && place.type !== 'activity' && (
            <span className="rounded bg-amber-50 px-1 py-px text-[10px] font-bold tracking-wide text-amber-700 uppercase">
              No location
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
