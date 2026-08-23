import { useMemo } from 'react'
import { cx } from '../../lib/cx'
import { tripStats } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'

export function Dashboard() {
  const { trip } = useStore()
  const { selectedDay, setSelectedDay, setFilters } = useUi()
  const stats = useMemo(() => tripStats(trip), [trip])

  const cells = [
    { label: 'places', value: stats.total, onClick: () => setFilters((c) => ({ ...c, status: 'all' })) },
    { label: 'high priority', value: stats.priority, onClick: () => setFilters((c) => ({ ...c, priorities: ['high'] })) },
    { label: 'planned', value: stats.planned, onClick: () => setFilters((c) => ({ ...c, status: 'planned' })) },
    { label: 'in Inbox', value: stats.inbox, onClick: () => setFilters((c) => ({ ...c, status: 'inbox' })) },
  ]

  return (
    <section className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {cells.map((cell) => (
          <button
            key={cell.label}
            type="button"
            onClick={cell.onClick}
            className="rounded-xl border border-slate-200 bg-white px-1.5 py-2 text-center transition-colors hover:border-brand-500 hover:bg-brand-50/50"
          >
            <div className="text-[17px] leading-none font-bold tabular-nums text-slate-800">{cell.value}</div>
            <div className="mt-1 text-[10px] leading-tight text-slate-500">{cell.label}</div>
          </button>
        ))}
      </div>

      <div className="scroll-thin -mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5">
        {stats.days.map((day) => (
          <button
            key={day.dayId}
            type="button"
            onClick={() => setSelectedDay(selectedDay === day.dayId ? 'all' : day.dayId)}
            title={`${day.label} — ${day.itemCount} ${day.itemCount === 1 ? 'activity' : 'activities'}`}
            className={cx(
              'shrink-0 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
              selectedDay === day.dayId
                ? 'border-brand-700 bg-brand-700 text-white'
                : day.itemCount === 0
                  ? 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-slate-400'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            {day.label} <span className="tabular-nums opacity-70">· {day.itemCount}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
