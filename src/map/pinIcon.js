import L from 'leaflet'
import { iconMarkup } from '../icons/svgString.js'
import { CATS, catColor } from '../data/categories.js'

/* The teardrop is a 24x24 rounded square rotated -45deg. Half its diagonal is
   12*sqrt(2) = 16.97, so with the drop's centre at (12,12) the point lands at
   (12, 28.97). Inside a 28px-wide box the drop starts at x=2, putting the tip
   at (14, 29) — which is why iconAnchor is [14, 29]. Change the drop size and
   you must redo this arithmetic or every pin will sit off its coordinate. */
const BOX_W = 28
const BOX_H = 32
const ANCHOR = [14, 29]

/* Point names are user-editable, and this markup goes in via innerHTML. */
const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

export function makePinIcon(
  point,
  {
    seq = 0,
    selected = false,
    inRoute = false,
    dim = false,
    moving = false,
    hover = false,
    /* When a point is on the day being viewed it wears that day's colour rather
       than its category's. Category tells you what a place is; on the map, what
       you need first is which day it belongs to. */
    color,
    nudge,
    label = false,
  } = {},
) {
  const cat = CATS[point.cat] || CATS.sight
  const cls = [
    'pin',
    inRoute && 'pin--route',
    selected && 'pin--sel',
    dim && 'pin--dim',
    moving && 'pin--moving',
    hover && 'pin--hover',
    label && 'pin--labelled',
  ]
    .filter(Boolean)
    .join(' ')

  /* pin__hit is an invisible 44x44 target. The drawn pin is 24px because a
     bigger one drowns the map, but 24px is far below the 44pt/48dp minimum
     every major map app honours, so the tappable area is decoupled from the
     drawn area. It overflows .pin deliberately; clicks bubble to the Leaflet
     icon element either way. */
  /* Two points can share a coordinate (lenbach and dianwan both sit at
     36.068/120.377). Superimposed, the one appended last wins every tap and
     the other is unreachable on the map, so co-located pins fan out slightly
     and a leader dot marks the true anchor. */
  const shift = nudge ? `translate(${nudge[0]}px,${nudge[1]}px)` : ''
  const html =
    `<div class="${cls}${nudge ? ' pin--nudged' : ''}" style="--pin-c:${color || catColor(point.cat)}${
      shift ? `;transform:${shift}` : ''
    }">` +
    `<span class="pin__hit"></span>` +
    `<span class="pin__tip"></span>` +
    `<span class="pin__drop">${iconMarkup(cat.icon, { size: 13, strokeWidth: 2.1 })}</span>` +
    (seq ? `<span class="pin__seq">${seq}</span>` : '') +
    (point.booking ? `<span class="pin__flag" title="需预约"></span>` : '') +
    (label ? `<span class="pin__label">${escapeHtml(point.name)}</span>` : '') +
    `</div>`

  return L.divIcon({
    className: 'pin-wrap',
    html,
    iconSize: [BOX_W, BOX_H],
    iconAnchor: ANCHOR,
  })
}

/**
 * Cluster bubble standing in for several nearby points. Size grows with the
 * count, but only across three steps — a continuous scale just makes the map
 * look noisy.
 */
export function makeClusterIcon(count, cats) {
  const size = count < 5 ? 34 : count < 15 ? 40 : 46
  // up to three category colours as a thin ring, so a cluster still hints at
  // what is inside it
  const stops = cats.slice(0, 3).map((c) => catColor(c))
  const ring =
    stops.length > 1
      ? `background-image: conic-gradient(${stops
          .map((c, i) => `${c} ${(i / stops.length) * 100}% ${((i + 1) / stops.length) * 100}%`)
          .join(',')});`
      : `background-image: linear-gradient(150deg, ${stops[0] || 'var(--accent)'}, ${
          stops[0] || 'var(--accent)'
        });`

  return L.divIcon({
    className: 'cluster-wrap',
    html:
      `<div class="cluster" style="width:${size}px;height:${size}px;${ring}">` +
      /* Same trick as the pins: the smallest bubble is drawn at 34px because a
         44px one dominates the map, so the tappable disc is decoupled from it. */
      `<span class="cluster__hit"></span>` +
      `<span class="cluster__inner">${count}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}
