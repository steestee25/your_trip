import { useEffect, useMemo, useState } from 'react'
import { optimizeDay, stopsFromItems, type OptimizeResult } from '../../features/optimize'
import { formatDistance, formatDuration } from '../../lib/geo'
import { parseTime } from '../../lib/time'
import { itemsForDay, placeMap } from '../../state/selectors'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'

export function OptimizeModal({ dayId, onClose }: { dayId: string; onClose: () => void }) {
  const { trip, data, dispatch } = useStore()
  const { pushToast } = useUi()
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [reflow, setReflow] = useState(true)

  const day = trip.days.find((d) => d.id === dayId)
  const items = itemsForDay(trip, dayId)
  const places = placeMap(trip)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void optimizeDay(stopsFromItems(items, places), {
      useRouting: data.settings.useRouting,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setResult(value)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // Recomputing on every keystroke elsewhere would spam the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId])

  /** Earliest time already on the day, used when re-flowing the schedule. */
  const firstStart = useMemo(() => {
    const times = items
      .map((item) => item.startTime)
      .filter((t): t is string => Boolean(t) && parseTime(t) !== null)
      .sort()
    return times[0]
  }, [items])

  const apply = () => {
    if (!result?.changed) return
    dispatch({ type: 'items/setOrder', dayId, orderedIds: result.orderedIds })
    // Reordering leaves each stop holding its old clock time, which would read
    // as a broken schedule. Re-flow keeps every duration and just restacks them.
    if (reflow && firstStart) {
      dispatch({ type: 'items/autoTime', dayId, startTime: firstStart, gapMinutes: 15 })
    }
    pushToast(`Order applied — about ${formatDistance(result.savedMeters)} saved`, 'success')
    onClose()
  }

  const preview = result
    ? result.orderedIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : []

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Optimise ${day?.title?.trim() || `Day ${(day?.index ?? 0) + 1}`}`}
      description="A geographic heuristic proposes a shorter order. Nothing changes until you apply it."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={apply} disabled={!result?.changed}>
            Apply new order
          </Button>
        </>
      }
    >
      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Spinner /> Comparing routes…
        </div>
      )}

      {!loading && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <Metric label="Before" value={formatDistance(result.beforeMeters)} sub={result.beforeSeconds ? formatDuration(result.beforeSeconds) : undefined} />
            <Metric label="After" value={formatDistance(result.afterMeters)} sub={result.afterSeconds ? formatDuration(result.afterSeconds) : undefined} />
            <Metric
              label="Saved"
              value={result.savedMeters > 0 ? formatDistance(result.savedMeters) : '—'}
              highlight={result.savedMeters > 0}
            />
          </div>

          <p className="rounded-lg bg-slate-100 px-3 py-2 text-[12px] leading-snug text-slate-600">
            {result.note}
            {result.pinnedCount > 0 && (
              <>
                {' '}
                {result.pinnedCount} {result.pinnedCount === 1 ? 'stop has' : 'stops have'} no coordinates
                (meals, transfers…) and {result.pinnedCount === 1 ? 'was' : 'were'} left in place.
              </>
            )}
          </p>

          {result.changed && firstStart && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={reflow}
                onChange={(e) => setReflow(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-700"
              />
              <span>
                <span className="block text-[13px] font-medium text-slate-800">
                  Re-flow the times from {firstStart}
                </span>
                <span className="block text-[11px] leading-snug text-slate-500">
                  Keeps every duration and leaves 15 minutes between stops. Without this, each stop keeps the
                  clock time it had before the reorder.
                </span>
              </span>
            </label>
          )}

          {!result.changed ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
              {result.savedMeters > 0
                ? 'The proposed order matches what you already have.'
                : 'This day is already efficient — no shorter order was found.'}
            </p>
          ) : (
            <div>
              <h3 className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Proposed order
              </h3>
              <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {preview.map((item, index) => {
                  const place = item.placeId ? places.get(item.placeId) : undefined
                  const wasAt = items.findIndex((i) => i.id === item.id)
                  const moved = wasAt !== index
                  return (
                    <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
                        {place?.name ?? item.title ?? 'Activity'}
                      </span>
                      {moved && (
                        <span className="shrink-0 text-[10px] font-semibold text-brand-700">
                          was #{wasAt + 1}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</div>
      <div className={highlight ? 'text-lg font-bold text-emerald-600' : 'text-lg font-bold text-slate-800'}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  )
}
