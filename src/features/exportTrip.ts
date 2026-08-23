import { formatDistance, hasCoords, pathLength, type LatLng } from '../lib/geo'
import { downloadBlob, slugify } from '../lib/text'
import { formatDateLabel, formatDurationMinutes } from '../lib/time'
import { categoryById } from '../state/categories'
import { itemsForDay, placeMap } from '../state/selectors'
import type { AppData, Trip } from '../types'

export function exportTripJson(trip: Trip): void {
  const payload = { ...trip, exportedAt: new Date().toISOString(), app: 'universal-trip-planner', formatVersion: 1 }
  downloadBlob(JSON.stringify(payload, null, 2), `${slugify(trip.name)}.trip.json`, 'application/json')
}

export function exportWorkspaceJson(data: AppData): void {
  const payload = { ...data, exportedAt: new Date().toISOString(), app: 'universal-trip-planner' }
  downloadBlob(JSON.stringify(payload, null, 2), 'trip-planner-backup.json', 'application/json')
}

/** Human-readable itinerary as Markdown. */
export function buildItineraryText(trip: Trip): string {
  const places = placeMap(trip)
  const lines: string[] = []
  lines.push(`# ${trip.name}`)
  if (trip.startDate) lines.push(`Starting ${formatDateLabel(trip.startDate)}`)
  if (trip.destinations.length) lines.push(`Destinations: ${trip.destinations.map((d) => d.name).join(', ')}`)
  if (trip.notes) lines.push('', trip.notes)
  lines.push('')

  for (const day of trip.days) {
    const items = itemsForDay(trip, day.id)
    const heading = day.title?.trim() || `Day ${day.index + 1}`
    lines.push(`## ${heading}${day.date ? ` — ${formatDateLabel(day.date)}` : ''}`)
    if (day.notes) lines.push(`_${day.notes}_`)
    if (items.length === 0) {
      lines.push('', '_Nothing planned yet._', '')
      continue
    }
    lines.push('')
    for (const item of items) {
      const place = item.placeId ? places.get(item.placeId) : undefined
      const name = place?.name ?? item.title ?? (item.type === 'transport' ? 'Travel' : 'Activity')
      const time = item.startTime ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}` : ''
      const duration = formatDurationMinutes(item.durationMinutes)
      const category = place ? categoryById(trip.categories, place.category) : undefined
      const bits = [
        time ? `**${time}**` : null,
        category ? category.emoji : item.type === 'transport' ? '🚉' : '📌',
        name,
        place?.type && place.type !== 'poi' ? `(${place.type})` : null,
        duration ? `· ${duration}` : null,
      ].filter(Boolean)
      lines.push(`- ${bits.join(' ')}`)
      if (place?.address) lines.push(`  - ${place.address}`)
      if (item.notes) lines.push(`  - Note: ${item.notes}`)
      if (place?.notes) lines.push(`  - ${place.notes}`)
    }

    const points = items
      .map((item) => (item.placeId ? places.get(item.placeId) : undefined))
      .filter((p): p is NonNullable<typeof p> => Boolean(p) && hasCoords(p))
      .map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number }) as LatLng)
    if (points.length > 1) {
      lines.push('', `_Straight-line distance across the day: ${formatDistance(pathLength(points))}_`)
    }
    lines.push('')
  }

  const inbox = trip.places.filter((p) => !trip.items.some((i) => i.placeId === p.id) && !p.visited)
  if (inbox.length) {
    lines.push('## Inbox (not planned yet)', '')
    for (const place of inbox) {
      const category = categoryById(trip.categories, place.category)
      lines.push(`- ${category.emoji} ${place.name}${place.city ? ` — ${place.city}` : ''}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('Data © OpenStreetMap contributors (ODbL). Descriptions from Wikipedia/Wikidata where shown.')
  return lines.join('\n')
}

export function exportItineraryMarkdown(trip: Trip): void {
  downloadBlob(buildItineraryText(trip), `${slugify(trip.name)}-itinerary.md`, 'text/markdown;charset=utf-8')
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Printable HTML opened in a new tab, styled for paper. */
export function buildPrintableHtml(trip: Trip): string {
  const places = placeMap(trip)
  const dayBlocks = trip.days
    .map((day) => {
      const items = itemsForDay(trip, day.id)
      const rows = items
        .map((item) => {
          const place = item.placeId ? places.get(item.placeId) : undefined
          const name = place?.name ?? item.title ?? (item.type === 'transport' ? 'Travel' : 'Activity')
          const category = place ? categoryById(trip.categories, place.category) : undefined
          const time = item.startTime
            ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}`
            : formatDurationMinutes(item.durationMinutes) || ''
          const meta = [
            place?.type && place.type !== 'poi' ? place.type : null,
            place?.address ?? place?.city,
            formatDurationMinutes(item.durationMinutes),
          ]
            .filter(Boolean)
            .map((m) => escapeHtml(String(m)))
            .join(' · ')
          const note = [item.notes, place?.notes].filter(Boolean).join(' — ')
          return `<tr>
            <td class="time">${escapeHtml(time)}</td>
            <td>
              <div class="name">${escapeHtml(category?.emoji ?? '📌')} ${escapeHtml(name)}</div>
              ${meta ? `<div class="meta">${meta}</div>` : ''}
              ${note ? `<div class="note">${escapeHtml(note)}</div>` : ''}
            </td>
          </tr>`
        })
        .join('')
      return `<section class="day">
        <h2>${escapeHtml(day.title?.trim() || `Day ${day.index + 1}`)}${
          day.date ? ` <span class="date">${escapeHtml(formatDateLabel(day.date))}</span>` : ''
        }</h2>
        ${day.notes ? `<p class="daynote">${escapeHtml(day.notes)}</p>` : ''}
        ${items.length ? `<table>${rows}</table>` : '<p class="empty">Nothing planned yet.</p>'}
      </section>`
    })
    .join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(trip.name)} — itinerary</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 32px; }
  header { border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 24px; }
  h1 { margin: 0 0 4px; font-size: 26px; }
  .sub { color: #475569; font-size: 14px; }
  .day { break-inside: avoid; margin-bottom: 26px; }
  h2 { font-size: 18px; margin: 0 0 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  h2 .date { font-weight: 400; color: #64748b; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
  td.time { width: 110px; font-variant-numeric: tabular-nums; color: #0f766e; font-weight: 600; white-space: nowrap; }
  .name { font-weight: 600; }
  .meta { color: #64748b; font-size: 13px; }
  .note { color: #334155; font-size: 13px; font-style: italic; }
  .daynote { color: #475569; font-style: italic; margin: 0 0 8px; }
  .empty { color: #94a3b8; font-style: italic; }
  footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body>
  <header>
    <h1>${escapeHtml(trip.name)}</h1>
    <div class="sub">${[
      trip.startDate ? `From ${escapeHtml(formatDateLabel(trip.startDate))}` : '',
      `${trip.days.length} days`,
      trip.destinations.length ? escapeHtml(trip.destinations.map((d) => d.name).join(' · ')) : '',
    ]
      .filter(Boolean)
      .join(' — ')}</div>
  </header>
  ${dayBlocks}
  <footer>Data © OpenStreetMap contributors (ODbL). Descriptions from Wikipedia (CC BY-SA) / Wikidata (CC0) where shown.</footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 300) })</script>
</body></html>`
}

export function openPrintableItinerary(trip: Trip): boolean {
  const html = buildPrintableHtml(trip)
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  return true
}
