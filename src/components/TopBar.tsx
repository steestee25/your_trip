import { cx } from '../lib/cx'
import { useStore } from '../state/store'
import { useUi } from '../state/ui'
import { Button } from './ui/Button'

export function TopBar() {
  const { trip, dispatch, saveState, canUndo, undo } = useStore()
  const { openModal, sidebarOpen, setSidebarOpen, itineraryOpen, setItineraryOpen } = useUi()

  return (
    <header className="z-30 flex h-13 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2.5 sm:px-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7.5 w-7.5 place-items-center rounded-lg bg-brand-700 text-[15px]">📍</span>
        <span className="hidden text-[13px] leading-tight font-bold text-slate-800 sm:block">
          Universal
          <br />
          Trip Planner
        </span>
      </div>

      <div className="mx-1 h-6 w-px shrink-0 bg-slate-200" />

      <button
        type="button"
        onClick={() => openModal({ kind: 'trips' })}
        title="Switch or create a trip"
        className="group flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100"
      >
        <span className="min-w-0">
          <span className="block max-w-[34vw] truncate text-[13px] font-semibold whitespace-nowrap text-slate-800 sm:max-w-xs">
            {trip.name}
          </span>
          <span className="block truncate text-left text-[10.5px] whitespace-nowrap text-slate-500">
            {trip.days.length} days · {trip.places.length} places
          </span>
        </span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="flex-1" />

      <span
        className={cx(
          'hidden text-[11px] font-medium sm:block',
          saveState === 'error' ? 'text-rose-600' : 'text-slate-400',
        )}
        title="Everything is stored locally in your browser"
      >
        {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved locally'}
      </span>

      {/* Responsive visibility lives on these wrappers: putting `hidden` on the
          buttons themselves would fight their own `inline-flex` base class. */}
      <div className="hidden items-center gap-1.5 sm:flex">
        <Button size="sm" variant="ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd + Z)">
          Undo
        </Button>
      </div>

      <div className="hidden items-center gap-1.5 md:flex">
        <Button size="sm" onClick={() => openModal({ kind: 'import-list' })}>
          Import list
        </Button>
      </div>

      <div className="hidden items-center gap-1.5 lg:flex">
        <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'days/add' })}>
          + Day
        </Button>
        <div className="ml-0.5 flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
          <PanelToggle
            active={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            label="Places panel"
            side="left"
          />
          <PanelToggle
            active={itineraryOpen}
            onClick={() => setItineraryOpen(!itineraryOpen)}
            label="Itinerary panel"
            side="right"
          />
        </div>
      </div>

      <Button size="icon" variant="ghost" onClick={() => openModal({ kind: 'trip-settings' })} title="Trip settings">
        <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="10" r="2.6" />
          <path d="M10 3.2v1.6M10 15.2v1.6M16.8 10h-1.6M4.8 10H3.2M14.8 5.2l-1.1 1.1M6.3 13.7l-1.1 1.1M14.8 14.8l-1.1-1.1M6.3 6.3 5.2 5.2" strokeLinecap="round" />
        </svg>
      </Button>
      <Button size="icon" variant="ghost" onClick={() => openModal({ kind: 'about' })} title="Data sources and privacy">
        <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="10" r="7.2" />
          <path d="M10 9v4.5M10 6.4v.9" strokeLinecap="round" />
        </svg>
      </Button>
    </header>
  )
}

function PanelToggle({
  active,
  onClick,
  label,
  side,
}: {
  active: boolean
  onClick: () => void
  label: string
  side: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${active ? 'Hide' : 'Show'} ${label}`}
      aria-pressed={active}
      className={cx(
        'grid h-7 w-7 place-items-center rounded-md transition-colors',
        active ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600',
      )}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="14" height="12" rx="2" />
        <path d={side === 'left' ? 'M8 4v12' : 'M12 4v12'} />
      </svg>
    </button>
  )
}
