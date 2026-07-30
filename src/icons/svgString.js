import { ICONS, opticalStroke } from './registry.js'

/**
 * Render a registry icon to an SVG string.
 *
 * Needed because Leaflet's divIcon takes HTML, not React elements. Geometry
 * still comes from the one registry, so a map pin and a panel button can never
 * drift apart.
 */
export function iconMarkup(name, { size = 18, strokeWidth, color = 'currentColor' } = {}) {
  const els = ICONS[name]
  if (!els) return ''
  const sw = strokeWidth ?? opticalStroke(size)

  const body = els
    .map(([tag, attrs]) => {
      const { _solid, ...a } = attrs
      const pairs = Object.entries(a)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      const paint = _solid ? 'fill="currentColor" stroke="none"' : ''
      return `<${tag} ${pairs}${paint ? ' ' + paint : ''}/>`
    })
    .join('')

  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
    `stroke="${color}" stroke-width="${sw}" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  )
}
