/* ============================================================
   How long it takes to get from one stop to the next.

   There is no routing API here on purpose: a key would have to ship in a public
   static bundle, and 高德's keyless tile endpoint is already the most fragile
   thing in this app. So the estimate is geometric — great-circle distance times
   a detour factor, divided by a mode speed.

   That is a real limitation and the UI says so ("估算"). What matters is that
   it is wrong in a *stable, understandable* way: it never claims a precision it
   does not have, and reordering stops always changes the number in the
   direction you would expect.

   Everything goes through the RouteProvider interface below, so swapping in
   高德路径规划 later is one file, not a refactor.
   ============================================================ */

import { haversineM } from './geo.js'

export const MODES = {
  walk: { key: 'walk', name: '步行', icon: 'walk', kmh: 4.6, detour: 1.28, fixed: 0 },
  /* Urban driving in Qingdao during 国庆 is not 40km/h. The fixed cost covers
     parking and walking from wherever you actually parked. */
  drive: { key: 'drive', name: '驾车', icon: 'car', kmh: 22, detour: 1.35, fixed: 8 },
  /* Metro is fast in the tunnel and slow either side; the fixed cost is the
     walk to the platform plus the wait, which dominates for short hops. */
  transit: { key: 'transit', name: '地铁/公交', icon: 'train', kmh: 24, detour: 1.4, fixed: 12 },
}

export const MODE_ORDER = ['walk', 'transit', 'drive']

/* Below this, walking beats waiting for anything. Above it, a car wins.
   Deliberately generous — 1.2km of seafront is a nice walk, not a taxi ride. */
const WALK_LIMIT_M = 1200
const TRANSIT_LIMIT_M = 12000

export function autoMode(metres) {
  if (metres <= WALK_LIMIT_M) return 'walk'
  if (metres <= TRANSIT_LIMIT_M) return 'transit'
  return 'drive'
}

/**
 * The seam a real routing service would slot into.
 * A provider takes two [lat,lng] pairs and a mode, and returns
 * { metres, minutes, mode, estimated }.
 */
export const straightLineProvider = {
  id: 'straight-line',
  /** Synchronous, which is why the UI can afford to recompute on every drag. */
  leg(from, to, mode = 'auto') {
    const direct = haversineM(from, to)
    const resolved = mode === 'auto' ? autoMode(direct) : mode
    const spec = MODES[resolved] || MODES.walk
    const metres = direct * spec.detour
    const minutes = spec.fixed + (metres / 1000 / spec.kmh) * 60
    return {
      metres,
      minutes: Math.max(1, Math.round(minutes)),
      mode: resolved,
      auto: mode === 'auto',
      estimated: true,
    }
  },
}

let provider = straightLineProvider

export function setRouteProvider(next) {
  provider = next || straightLineProvider
}

export function legBetween(from, to, mode = 'auto') {
  if (!from || !to) return null
  return provider.leg(from, to, mode)
}

/**
 * Walk a day's stops and produce the timeline: for each item, when you arrive,
 * how you got there and how long the hop took.
 *
 * `plannedStart` on an item pins it — everything after cascades from there, so
 * a fixed dinner booking pushes the afternoon rather than being silently
 * overwritten by it.
 */
export function buildTimeline(items, getPoint, { startMinutes = 540, defaultStay } = {}) {
  const legs = []
  let clock = startMinutes
  let prevPoint = null
  let totalTravel = 0
  let totalStay = 0
  let totalMetres = 0

  items.forEach((item, i) => {
    const point = getPoint(item.pointId)
    let leg = null
    if (prevPoint && point) {
      leg = legBetween([prevPoint.lat, prevPoint.lng], [point.lat, point.lng], item.transitMode)
      if (leg) {
        clock += leg.minutes
        totalTravel += leg.minutes
        totalMetres += leg.metres
      }
    }

    const pinned = item.plannedStart != null ? item.plannedStart : null
    if (pinned != null) clock = Math.max(clock, pinned)

    const stay =
      item.durationMinutes != null
        ? item.durationMinutes
        : (defaultStay?.[point?.cat] ?? 60)

    legs.push({
      item,
      point,
      index: i,
      leg,
      arrive: clock,
      depart: clock + stay,
      stay,
      pinned: pinned != null,
    })

    clock += stay
    totalStay += stay
    if (point) prevPoint = point
  })

  return {
    rows: legs,
    startMinutes,
    endMinutes: clock,
    totalTravel,
    totalStay,
    totalMinutes: clock - startMinutes,
    totalMetres,
  }
}
