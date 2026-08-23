import { useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { PlaceType } from '../../types'
import { Chip } from '../ui/Chip'

const TYPES: Array<{ id: PlaceType; label: string }> = [
  { id: 'poi', label: 'POI' },
  { id: 'area', label: 'Areas' },
  { id: 'city', label: 'Cities' },
  { id: 'activity', label: 'Activities' },
]

const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export function Filters() {
  const { trip } = useStore()
  const { filters, setFilters, resetFilters, sort, setSort, openModal } = useUi()
  const [expanded, setExpanded] = useState(false)

  const counts = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const place of trip.places) {
      const id = place.category ?? 'other'
      byCategory.set(id, (byCategory.get(id) ?? 0) + 1)
    }
    return byCategory
  }, [trip.places])

  const usedCategories = trip.categories.filter((c) => (counts.get(c.id) ?? 0) > 0)
  const activeCount =
    filters.categories.length + filters.types.length + filters.priorities.length + (filters.status !== 'all' ? 1 : 0)

  const toggle = (key: 'categories' | 'types' | 'priorities', value: string) =>
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((v) => v !== value)
        : [...current[key], value],
    }))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <input
          value={filters.search}
          onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))}
          placeholder="Filter saved places…"
          aria-label="Filter saved places"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cx(
            'relative rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors',
            expanded || activeCount > 0
              ? 'border-brand-600 bg-brand-50 text-brand-800'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 animate-fade">
          <FilterGroup label="Category" action={{ label: 'Manage', onClick: () => openModal({ kind: 'categories' }) }}>
            {usedCategories.length === 0 && <span className="text-[11px] text-slate-400">No places yet.</span>}
            {usedCategories.map((category) => (
              <Chip
                key={category.id}
                color={category.color}
                active={filters.categories.includes(category.id)}
                count={counts.get(category.id)}
                onClick={() => toggle('categories', category.id)}
              >
                {category.emoji} {category.name}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Type">
            {TYPES.map((type) => (
              <Chip key={type.id} active={filters.types.includes(type.id)} onClick={() => toggle('types', type.id)}>
                {type.label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Priority">
            {PRIORITIES.map((priority) => (
              <Chip
                key={priority.id}
                active={filters.priorities.includes(priority.id)}
                onClick={() => toggle('priorities', priority.id)}
              >
                {priority.label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Status">
            {(['all', 'inbox', 'planned', 'visited'] as const).map((status) => (
              <Chip
                key={status}
                active={filters.status === status}
                onClick={() => setFilters((c) => ({ ...c, status }))}
              >
                {status[0].toUpperCase() + status.slice(1)}
              </Chip>
            ))}
          </FilterGroup>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none"
              >
                <option value="recent">Recently added</option>
                <option value="name">Name</option>
                <option value="priority">Priority</option>
                <option value="category">Category</option>
              </select>
            </label>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterGroup({
  label,
  action,
  children,
}: {
  label: string
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[10px] font-semibold text-brand-700 hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}
