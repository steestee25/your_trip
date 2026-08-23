import { cx } from '../../lib/cx'
import { Dashboard } from './Dashboard'
import { Filters } from './Filters'
import { PlaceList } from './PlaceList'
import { SearchPanel } from './SearchPanel'
import { Suggestions } from './Suggestions'

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cx('flex min-h-0 flex-col gap-3 overflow-hidden border-slate-200 bg-white p-3', className)}
    >
      <SearchPanel />
      <Dashboard />
      <Suggestions />
      <Filters />
      <PlaceList />
    </aside>
  )
}
