import L from 'leaflet'

export interface MarkerOptions {
  emoji: string
  color: string
  /** 1-based position inside a day; omitted when not showing a day. */
  order?: number
  active?: boolean
  dim?: boolean
}

/**
 * Markers are div icons rather than images: they carry the category colour,
 * its emoji and the day order badge without loading any external asset.
 */
export function placeIcon({ emoji, color, order, active, dim }: MarkerOptions): L.DivIcon {
  const classes = ['utp-pin', active ? 'is-active' : '', dim ? 'is-dim' : ''].filter(Boolean).join(' ')
  const badge = order !== undefined ? `<i class="utp-badge">${order}</i>` : ''
  return L.divIcon({
    className: 'utp-marker',
    html: `<div class="${classes}" style="background:${color}"><span>${emoji}</span>${badge}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
    tooltipAnchor: [0, -22],
  })
}

export function areaLabelIcon(text: string): L.DivIcon {
  return L.divIcon({
    className: 'utp-marker',
    html: `<div class="utp-area-label">${text.replace(/[<>&]/g, '')}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, -18],
  })
}
