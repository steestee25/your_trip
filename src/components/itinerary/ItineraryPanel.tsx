import { useMemo } from 'react'
import { cx } from '../../lib/cx'
import { openPrintableItinerary } from '../../features/exportTrip'
import { tripStats } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import { Button } from '../ui/Button'
import { DayColumn } from './DayColumn'

export function ItineraryPanel({ className }: { className?: string }) {
  const { trip, dispatch } = useStore()
  const { selectedDay, setSelectedDay, pushToast, openModal } = useUi()
  const stats = useMemo(() => tripStats(trip), [trip])

  return (
    <section className={cx('flex min-h-0 flex-col border-slate-200 bg-slate-50', className)}>
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-bold text-slate-800">Itinerary</h2>
          <p className="text-[11px] text-slate-500">
            {trip.days.length} days · {stats.totalItems} {stats.totalItems === 1 ? 'stop' : 'stops'}
            {stats.emptyDays > 0 && ` · ${stats.emptyDays} empty`}
          </p>
        </div>
        {selectedDay !== 'all' && (
          <Button size="sm" onClick={() => setSelectedDay('all')}>
            Show all
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => {
            if (!openPrintableItinerary(trip)) {
              pushToast('Your browser blocked the print window. Allow pop-ups for this page.', 'warning')
            }
          }}
          title="Open a printable version"
        >
          Print
        </Button>
        <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'days/add' })}>
          + Day
        </Button>
      </header>

      <div className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {trip.days.map((day) => (
          <DayColumn key={day.id} day={day} />
        ))}

        <button
          type="button"
          onClick={() => dispatch({ type: 'days/add' })}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-3 text-[12px] font-semibold text-slate-400 transition-colors hover:border-brand-500 hover:text-brand-700"
        >
          + Add day {trip.days.length + 1}
        </button>

        <button
          type="button"
          onClick={() => openModal({ kind: 'trip-settings' })}
          className="w-full py-1 text-center text-[11px] text-slate-400 hover:text-slate-600"
        >
          Trip settings, dates and export
        </button>
      </div>
    </section>
  )
}
