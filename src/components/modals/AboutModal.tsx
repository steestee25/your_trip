import { ATTRIBUTIONS } from '../../providers'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Data, services and privacy"
      description="Universal Trip Planner runs entirely in your browser and uses only free, key-less open services."
      footer={<Button variant="primary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4 text-[13px] leading-relaxed text-slate-600">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {ATTRIBUTIONS.map((entry) => (
            <li key={entry.service} className="px-3 py-2">
              <div className="text-[12px] font-bold tracking-wide text-slate-700 uppercase">{entry.service}</div>
              <div className="text-[12px] text-slate-600">{entry.text}</div>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-brand-700 hover:underline"
              >
                {entry.url}
              </a>
            </li>
          ))}
        </ul>

        <section>
          <h3 className="mb-1 text-[12px] font-bold tracking-wide text-slate-700 uppercase">How we stay polite</h3>
          <ul className="list-disc space-y-1 pl-5 text-[12px]">
            <li>Geocoding runs at most one request per second and never on every keystroke.</li>
            <li>Every response is cached locally (30 days for geocoding, 7 for routing and Overpass).</li>
            <li>Overpass and routing only run when you ask for them, and can be switched off entirely.</li>
            <li>No analytics, no tracking, no account. Your trip never leaves this browser.</li>
          </ul>
        </section>

        <section>
          <h3 className="mb-1 text-[12px] font-bold tracking-wide text-slate-700 uppercase">Honest limitations</h3>
          <ul className="list-disc space-y-1 pl-5 text-[12px]">
            <li>Missing information is left empty rather than guessed. Nothing here is invented.</li>
            <li>Boundaries are drawn only when OpenStreetMap actually publishes a polygon for that place.</li>
            <li>
              When routing is unavailable, distances are straight-line estimates and are always labelled as such.
            </li>
            <li>The public OSRM demo server only serves a driving profile, so times reflect driving.</li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}
