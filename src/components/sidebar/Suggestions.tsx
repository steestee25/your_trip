import { useMemo, useState } from 'react'
import { buildSuggestions } from '../../features/suggestions'
import { cx } from '../../lib/cx'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'

export function Suggestions() {
  const { trip } = useStore()
  const { setSelectedDay, setFilters, openModal } = useUi()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [open, setOpen] = useState(true)

  const suggestions = useMemo(
    () => buildSuggestions(trip).filter((s) => !dismissed.includes(s.id)),
    [trip, dismissed],
  )

  if (suggestions.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2.5 py-2 text-left"
      >
        <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          Suggestions
          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-px text-[10px] text-slate-600">
            {suggestions.length}
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          className={cx('h-3.5 w-3.5 text-slate-400 transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {suggestions.slice(0, 5).map((suggestion) => (
            <li
              key={suggestion.id}
              className={cx('px-2.5 py-2', suggestion.tone === 'warning' ? 'bg-amber-50/40' : 'bg-white')}
            >
              <div className="flex items-start gap-2">
                <span className="mt-px text-[13px] leading-none">{suggestion.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-snug font-semibold text-slate-800">{suggestion.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{suggestion.detail}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {suggestion.placeIds && suggestion.placeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDay('all')
                          setFilters((c) => ({
                            ...c,
                            search: '',
                            status: 'all',
                            categories: [],
                            types: [],
                            priorities: [],
                            ids: suggestion.placeIds ?? null,
                          }))
                        }}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Show {suggestion.placeIds.length} places
                      </button>
                    )}
                    {suggestion.dayId && (
                      <button
                        type="button"
                        onClick={() => setSelectedDay(suggestion.dayId!)}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Open day
                      </button>
                    )}
                    {suggestion.kind === 'dispersed-day' && suggestion.dayId && (
                      <button
                        type="button"
                        onClick={() => openModal({ kind: 'optimize', dayId: suggestion.dayId! })}
                        className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 hover:bg-brand-100"
                      >
                        Optimise day
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDismissed((current) => [...current, suggestion.id])}
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-slate-700"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
