import L from 'leaflet'
import { iconMarkup } from '../icons/svgString.js'
import { CATS, catColor } from '../data/categories.js'

/* The teardrop is a 30x30 rounded square rotated -45deg, so its point lands at
   (15, 36.2) inside a 34x38 box. Those two numbers are why iconAnchor is
   [17, 36] — change one and you must change the other. */
const BOX_W = 34
const BOX_H = 38
const ANCHOR = [17, 36]

export function makePinIcon(point, { seq = 0, selected = false, inRoute = false, dim = false } = {}) {
  const cat = CATS[point.cat] || CATS.sight
  const cls = ['pin', inRoute && 'pin--route', selected && 'pin--sel', dim && 'pin--dim']
    .filter(Boolean)
    .join(' ')

  const html =
    `<div class="${cls}" style="--pin-c:${catColor(point.cat)}">` +
    `<span class="pin__tip"></span>` +
    `<span class="pin__drop">${iconMarkup(cat.icon, { size: 16, strokeWidth: 2 })}</span>` +
    (seq ? `<span class="pin__seq">${seq}</span>` : '') +
    (point.booking ? `<span class="pin__flag" title="需预约"></span>` : '') +
    `</div>`

  return L.divIcon({
    className: 'pin-wrap',
    html,
    iconSize: [BOX_W, BOX_H],
    iconAnchor: ANCHOR,
  })
}
