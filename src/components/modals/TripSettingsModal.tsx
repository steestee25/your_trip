import { useRef, useState } from 'react'
import {
  exportItineraryMarkdown,
  exportTripJson,
  exportWorkspaceJson,
  openPrintableItinerary,
} from '../../features/exportTrip'
import { cacheSize, clearCache } from '../../lib/cache'
import { sanitizeAppData, sanitizeTrip } from '../../state/validate'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import { Button } from '../ui/Button'
import { FieldRow, TextArea, TextInput } from '../ui/Field'
import { Modal } from '../ui/Modal'

export function TripSettingsModal({ onClose }: { onClose: () => void }) {
  const { trip, data, dispatch, storageBytes, saveError } = useStore()
  const { pushToast, openModal } = useUi()
  const fileInput = useRef<HTMLInputElement>(null)
  const [dayCount, setDayCount] = useState(String(trip.days.length))

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const asWorkspace = sanitizeAppData(parsed)
      if (asWorkspace && Array.isArray((parsed as { trips?: unknown }).trips)) {
        dispatch({ type: 'data/import', data: asWorkspace, mode: 'merge' })
        pushToast(`${asWorkspace.trips.length} trips imported`, 'success')
        onClose()
        return
      }
      const asTrip = sanitizeTrip(parsed)
      if (asTrip) {
        dispatch({ type: 'trip/import', trip: asTrip })
        pushToast(`“${asTrip.name}” imported`, 'success')
        onClose()
        return
      }
      pushToast('That file is not a Universal Trip Planner export.', 'error')
    } catch {
      pushToast('Could not read that file — is it valid JSON?', 'error')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Trip settings"
      description="Everything is stored in this browser only. There is no account and no server."
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Trip name">
            <TextInput
              value={trip.name}
              onChange={(e) => dispatch({ type: 'trip/patch', patch: { name: e.target.value } })}
            />
          </FieldRow>
          <FieldRow label="Start date" hint="optional">
            <TextInput
              type="date"
              value={trip.startDate ?? ''}
              onChange={(e) =>
                dispatch({ type: 'trip/patch', patch: { startDate: e.target.value || undefined } })
              }
            />
          </FieldRow>
          <FieldRow label="Number of days" hint="1–120">
            <div className="flex gap-1.5">
              <TextInput
                type="number"
                min={1}
                max={120}
                value={dayCount}
                onChange={(e) => setDayCount(e.target.value)}
              />
              <Button
                onClick={() => {
                  const count = Number(dayCount)
                  if (!Number.isFinite(count) || count < 1) return
                  if (count < trip.days.length) {
                    const removed = trip.days.length - count
                    const affected = trip.items.filter((item) =>
                      trip.days.slice(count).some((d) => d.id === item.dayId),
                    ).length
                    if (
                      affected > 0 &&
                      !window.confirm(
                        `Removing ${removed} ${removed === 1 ? 'day' : 'days'} will unplan ${affected} ${
                          affected === 1 ? 'stop' : 'stops'
                        }. They go back to your Inbox. Continue?`,
                      )
                    ) {
                      return
                    }
                  }
                  dispatch({ type: 'days/setCount', count })
                  pushToast(`Trip is now ${count} days long`, 'success')
                }}
              >
                Apply
              </Button>
            </div>
          </FieldRow>
          <FieldRow label="Trip notes" hint="optional">
            <TextArea
              rows={2}
              value={trip.notes ?? ''}
              onChange={(e) => dispatch({ type: 'trip/patch', patch: { notes: e.target.value } })}
              placeholder="Flight numbers, hotel, anything"
            />
          </FieldRow>
        </section>

        <Section title="Destinations" hint="Used to bias search results towards the right city.">
          <div className="flex flex-wrap gap-1.5">
            {trip.destinations.length === 0 && (
              <p className="text-[12px] text-slate-500">
                No destination yet. Search for a city and open it to set it as a destination.
              </p>
            )}
            {trip.destinations.map((destination) => (
              <span
                key={destination.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-700"
              >
                {destination.name}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'destinations/remove', destinationId: destination.id })}
                  className="text-slate-400 hover:text-rose-600"
                  aria-label={`Remove ${destination.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Online services" hint="All free and key-less. Turn any of them off to work fully offline.">
          <div className="space-y-1.5">
            <Toggle
              checked={data.settings.useEnrichment}
              onChange={(v) => dispatch({ type: 'settings/patch', patch: { useEnrichment: v } })}
              label="Wikipedia / Wikidata descriptions"
              hint="Fetches a short description, official website and photo when the place is tagged."
            />
            <Toggle
              checked={data.settings.useRouting}
              onChange={(v) => dispatch({ type: 'settings/patch', patch: { useRouting: v } })}
              label="OSRM routing for real distances"
              hint="Off means all distances are straight-line estimates, clearly labelled as such."
            />
            <Toggle
              checked={data.settings.useOverpass}
              onChange={(v) => dispatch({ type: 'settings/patch', patch: { useOverpass: v } })}
              label="Overpass discovery of nearby places"
              hint="Only ever runs when you press “Find nearby places” on an area or city."
            />
          </div>
        </Section>

        <Section title="Backup and export">
          <div className="flex flex-wrap gap-1.5">
            <Button onClick={() => exportTripJson(trip)}>Export this trip (JSON)</Button>
            <Button onClick={() => exportWorkspaceJson(data)}>Export everything</Button>
            <Button onClick={() => exportItineraryMarkdown(trip)}>Itinerary as Markdown</Button>
            <Button
              onClick={() => {
                if (!openPrintableItinerary(trip)) {
                  pushToast('Your browser blocked the print window. Allow pop-ups for this page.', 'warning')
                }
              }}
            >
              Printable itinerary
            </Button>
            <Button onClick={() => fileInput.current?.click()}>Import JSON…</Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </Section>

        <Section title="Storage">
          <p className="text-[12px] leading-relaxed text-slate-500">
            Saved in this browser (IndexedDB, with a localStorage backup):{' '}
            <strong className="text-slate-700">{(storageBytes / 1024).toFixed(1)} KB</strong>. Cached API
            responses: <strong className="text-slate-700">{cacheSize()}</strong>.
            {saveError && <span className="mt-1 block text-rose-600">{saveError}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button onClick={() => openModal({ kind: 'trips' })}>Switch trip…</Button>
            <Button
              onClick={() => {
                clearCache()
                pushToast('Cached lookups cleared')
              }}
            >
              Clear API cache
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (
                  window.confirm(
                    'Delete this trip and all its places? Export it first if you want to keep it. This cannot be undone.',
                  )
                ) {
                  dispatch({ type: 'trip/delete', tripId: trip.id })
                  pushToast('Trip deleted')
                  onClose()
                }
              }}
            >
              Delete this trip
            </Button>
          </div>
        </Section>
      </div>
    </Modal>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-4">
      <h3 className="text-[12px] font-bold tracking-wide text-slate-700 uppercase">{title}</h3>
      {hint && <p className="mt-0.5 mb-2 text-[12px] text-slate-500">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </section>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-700"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-800">{label}</span>
        <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>
      </span>
    </label>
  )
}
