import { useDroppable } from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { filterPlaces, plannedPlaceIds } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import { EmptyState } from '../ui/Spinner'
import { PlaceCard } from './PlaceCard'

type Tab = 'inbox' | 'all'

export function PlaceList() {
  const { trip } = useStore()
  const { filters, setFilters, sort, selectedDay, setSelectedDay } = useUi()
  const [tab, setTab] = useState<Tab>('inbox')

  const planned = useMemo(() => plannedPlaceIds(trip), [trip])
  const filtered = useMemo(() => filterPlaces(trip, filters, sort), [trip, filters, sort])

  const inbox = useMemo(
    () => filtered.filter((p) => !planned.has(p.id) && !p.visited),
    [filtered, planned],
  )

  const list = tab === 'inbox' ? inbox : filtered
  const inboxCount = trip.places.filter((p) => !planned.has(p.id) && !p.visited).length

  // Dropping an itinerary item here takes it out of its day.
  const { setNodeRef, isOver } = useDroppable({ id: 'inbox', data: { kind: 'inbox' } })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-0.5 pb-2">
        <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')} count={inboxCount}>
          Inbox
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')} count={trip.places.length}>
          All places
        </TabButton>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setSelectedDay(selectedDay === 'inbox' ? 'all' : 'inbox')}
          title="Show only unplanned places on the map"
          className={cx(
            'rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors',
            selectedDay === 'inbox'
              ? 'bg-brand-700 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          On map
        </button>
      </div>

      {filters.ids && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] text-brand-900">
          <span>Showing {filters.ids.length} suggested places</span>
          <button
            type="button"
            onClick={() => setFilters((c) => ({ ...c, ids: null }))}
            className="font-semibold hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cx(
          'scroll-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-xl p-0.5 transition-colors',
          isOver && 'bg-brand-50 ring-2 ring-brand-500/40 ring-inset',
        )}
      >
        {list.length === 0 ? (
          tab === 'inbox' ? (
            <EmptyState
              icon="📥"
              title="Your Inbox is empty"
              hint="Search for a place above, or paste a whole list with “Import a list”. Everything you save lands here until you drag it into a day."
            />
          ) : (
            <EmptyState icon="🔍" title="No place matches these filters" hint="Try clearing the filters." />
          )
        ) : (
          list.map((place) => (
            <PlaceCard key={place.id} place={place} planned={tab === 'all' && planned.has(place.id)} />
          ))
        )}
      </div>

      <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-400">
        Drag a place onto a day to plan it. Drag it back here to unplan it.
      </p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors',
        active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100',
      )}
    >
      {children}
      <span className={cx('ml-1 tabular-nums', active ? 'text-white/70' : 'text-slate-400')}>{count}</span>
    </button>
  )
}
