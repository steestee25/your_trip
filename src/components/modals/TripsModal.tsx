import { useState } from 'react'
import { cx } from '../../lib/cx'
import { formatDateLabel } from '../../lib/time'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import { Button } from '../ui/Button'
import { FieldRow, TextInput } from '../ui/Field'
import { Modal } from '../ui/Modal'

export function TripsModal({ onClose }: { onClose: () => void }) {
  const { data, dispatch } = useStore()
  const { pushToast } = useUi()
  const [name, setName] = useState('')
  const [days, setDays] = useState('5')
  const [startDate, setStartDate] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Your trips"
      description="Each trip keeps its own places, categories and itinerary."
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {data.trips.map((trip) => (
            <li key={trip.id}>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'trip/select', tripId: trip.id })
                  onClose()
                }}
                className={cx(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50',
                  trip.id === data.activeTripId && 'bg-brand-50/70',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-800">{trip.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {trip.days.length} days · {trip.places.length} places · {trip.items.length} stops
                    {trip.startDate ? ` · from ${formatDateLabel(trip.startDate)}` : ''}
                  </span>
                </span>
                {trip.id === data.activeTripId && (
                  <span className="shrink-0 text-[10px] font-bold tracking-wide text-brand-700 uppercase">
                    current
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-[12px] font-bold tracking-wide text-slate-700 uppercase">New trip</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <FieldRow label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend in Lisbon" />
            </FieldRow>
            <FieldRow label="Days">
              <TextInput type="number" min={1} max={120} value={days} onChange={(e) => setDays(e.target.value)} />
            </FieldRow>
            <FieldRow label="Start date" hint="optional">
              <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FieldRow>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const count = Math.max(1, Math.min(Number(days) || 3, 120))
              dispatch({
                type: 'trip/create',
                name: name.trim() || 'New trip',
                days: count,
                startDate: startDate || undefined,
              })
              pushToast('Trip created', 'success')
              onClose()
            }}
          >
            Create trip
          </Button>
        </div>
      </div>
    </Modal>
  )
}
