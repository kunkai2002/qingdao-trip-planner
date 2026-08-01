/* ============================================================
   Reordering a day so you double back less.

   This optimises *distance*, not time, and certainly not "the best day out" —
   it has no idea that the aquarium is better before lunch or that 崂山 eats a
   whole day. So the UI states what it did, shows the before/after, and the
   change is undoable. A stop the user has locked never moves.

   Nearest-neighbour for a starting order, then 2-opt to unpick the crossings NN
   always leaves behind. Days here are under a dozen stops, so this is instant
   and there is no reason to reach for anything cleverer.
   ============================================================ */

import { haversineM } from './geo.js'

function pathLength(seq, coordOf, startCoord) {
  let total = 0
  let prev = startCoord
  for (const item of seq) {
    const c = coordOf(item)
    if (!c) continue
    if (prev) total += haversineM(prev, c)
    prev = c
  }
  return total
}

function rebuild(base, slots, freeOrder) {
  const out = base.slice()
  slots.forEach((slot, i) => {
    out[slot] = freeOrder[i]
  })
  return out
}

/**
 * @param items    the day's ItineraryItems, in current order
 * @param getPoint (pointId) => point | undefined
 * @param startCoord [lat,lng] to leave from (the hotel), or null
 * @returns { items, before, after, moved, movable }
 */
export function optimizeDay(items, getPoint, { startCoord = null } = {}) {
  const coordOf = (item) => {
    const p = item && getPoint(item.pointId)
    return p ? [p.lat, p.lng] : null
  }

  // An item we cannot place (deleted point) is treated as locked: moving it
  // would shuffle the list around a stop we cannot even measure.
  const slots = []
  items.forEach((item, i) => {
    if (!item.locked && coordOf(item)) slots.push(i)
  })

  const before = pathLength(items, coordOf, startCoord)
  if (slots.length < 3) {
    return { items, before, after: before, moved: 0, movable: slots.length }
  }

  const free = slots.map((i) => items[i])

  /* ---- nearest neighbour ---- */
  const remaining = free.slice()
  const seeded = []
  let cursor = startCoord || coordOf(items[Math.max(0, slots[0] - 1)]) || coordOf(free[0])
  while (remaining.length) {
    let best = 0
    let bestD = Infinity
    remaining.forEach((item, i) => {
      const c = coordOf(item)
      const d = cursor && c ? haversineM(cursor, c) : 0
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    const [picked] = remaining.splice(best, 1)
    seeded.push(picked)
    cursor = coordOf(picked) || cursor
  }

  /* ---- 2-opt ----
     Reverse each candidate segment and keep it if the *whole reconstructed day*
     gets shorter. Scoring the rebuilt sequence rather than the free subsequence
     is what makes locked stops actually constrain the result instead of being
     stepped over. */
  let bestOrder = seeded
  let bestScore = pathLength(rebuild(items, slots, seeded), coordOf, startCoord)
  let improved = true
  let guard = 0
  while (improved && guard++ < 60) {
    improved = false
    for (let i = 0; i < bestOrder.length - 1; i++) {
      for (let j = i + 1; j < bestOrder.length; j++) {
        const candidate = bestOrder.slice()
        const segment = candidate.slice(i, j + 1).reverse()
        candidate.splice(i, segment.length, ...segment)
        const score = pathLength(rebuild(items, slots, candidate), coordOf, startCoord)
        if (score < bestScore - 1) {
          bestScore = score
          bestOrder = candidate
          improved = true
        }
      }
    }
  }

  const next = rebuild(items, slots, bestOrder)
  const moved = next.reduce((n, item, i) => n + (item.id === items[i].id ? 0 : 1), 0)
  return { items: next, before, after: bestScore, moved, movable: slots.length }
}
