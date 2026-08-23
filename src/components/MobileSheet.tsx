import { useState } from 'react'
import { cx } from '../lib/cx'
import { useUi } from '../state/ui'
import { Sidebar } from './sidebar/Sidebar'
import { ItineraryPanel } from './itinerary/ItineraryPanel'

/**
 * Mobile layout: the map owns the screen and the two panels come up as a
 * bottom sheet with two snap heights.
 */
export function MobileSheet() {
  const { mobilePanel, setMobilePanel } = useUi()
  const [full, setFull] = useState(false)
  const open = mobilePanel !== 'map'

  return (
    <>
      <div
        className={cx(
          'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.35)] transition-transform duration-300 lg:hidden',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ height: full ? 'calc(100dvh - 3.25rem)' : '62dvh' }}
      >
        <button
          type="button"
          onClick={() => setFull((v) => !v)}
          aria-label={full ? 'Collapse panel' : 'Expand panel'}
          className="grid shrink-0 place-items-center py-2"
        >
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-14">
          {mobilePanel === 'places' && <Sidebar className="flex-1 border-0" />}
          {mobilePanel === 'itinerary' && <ItineraryPanel className="flex-1 border-0" />}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <TabButton
          active={mobilePanel === 'places'}
          onClick={() => setMobilePanel(mobilePanel === 'places' ? 'map' : 'places')}
          label="Places"
          icon="📥"
        />
        <TabButton
          active={mobilePanel === 'map'}
          onClick={() => setMobilePanel('map')}
          label="Map"
          icon="🗺️"
        />
        <TabButton
          active={mobilePanel === 'itinerary'}
          onClick={() => setMobilePanel(mobilePanel === 'itinerary' ? 'map' : 'itinerary')}
          label="Itinerary"
          icon="📅"
        />
      </nav>
    </>
  )
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors',
        active ? 'text-brand-800' : 'text-slate-400',
      )}
    >
      <span className={cx('text-[16px] transition-transform', active && 'scale-110')}>{icon}</span>
      {label}
    </button>
  )
}
