import { CATS } from '../data/categories.js'

/* ============================================================
   Search
   ------------------------------------------------------------
   Three rules this module exists to enforce:

   1. TEXT FIRST, LAYERS SECOND. The old implementation vetoed by layer
      before it ever compared the query, and `enabled` is persisted — so a
      category switched off in a previous session made today's search return
      "0 个" with no statement of cause. Matching now happens over every
      point; the layer state only decides which matches are drawn, and the
      ones it hides are reported so the UI can offer to bring them back.

   2. THE CORPUS MUST COVER WHAT THE PLACEHOLDER PROMISES. The field invites
      「景点 / 餐厅 / 酒店 / 片区」; before this, three of those four returned
      nothing, because category names were not in the haystack at all and
      「酒店」 never appears in a 住宿 record.

   3. RANK, DON'T JUST FILTER. A landmark whose name starts with the query
      should outrank a noodle shop that merely mentions it in a note.
   ============================================================ */

/** Query words that should resolve to a category, e.g. 酒店 → 住宿. */
const ALIASES = {
  酒店: 'stay',
  宾馆: 'stay',
  旅馆: 'stay',
  民宿: 'stay',
  住: 'stay',
  美食: 'food',
  吃: 'food',
  饭: 'food',
  餐: 'food',
  海鲜: 'food',
  玩: 'fun',
  娱乐: 'fun',
  酒吧: 'fun',
  地铁: 'metro',
  车站: 'metro',
  交通: 'metro',
  景区: 'sight',
  景点: 'sight',
  公园: 'sight',
}

const norm = (s) => (s || '').toLowerCase()

/** Score a point against a query. 0 means no match. Higher is better. */
function score(point, q) {
  const name = norm(point.name)
  if (name.startsWith(q)) return 100
  if (name.includes(q)) return 80

  const tags = (point.tags || []).map(norm)
  if (tags.some((t) => t.includes(q))) return 60

  const area = norm(point.area)
  const address = norm(point.address)
  if (area.includes(q) || address.includes(q)) return 50

  // category name, plus the alias table, so 酒店 finds 住宿
  const catName = norm(CATS[point.cat]?.name)
  if (catName.includes(q)) return 40
  if (ALIASES[q] === point.cat) return 40

  // the long-form guidance is searchable, but ranks last
  if (norm(point.note).includes(q) || norm(point.warn).includes(q)) return 20

  const prices = (point.prices || []).map(([k, v]) => norm(k) + ' ' + norm(v)).join(' ')
  if (prices.includes(q)) return 15

  return 0
}

/**
 * Split the points into what the map should draw, what the query matched but a
 * closed layer is hiding, and the ranked list for the results dropdown.
 */
export function runSearch(state) {
  const q = norm(state.query).trim()

  if (!q) {
    return {
      query: '',
      shown: state.points.filter((p) => state.enabled[p.cat]),
      matched: state.points,
      hiddenByLayer: [],
      ranked: [],
    }
  }

  const matched = []
  for (const p of state.points) {
    const s = score(p, q)
    if (s > 0) matched.push({ point: p, score: s })
  }
  matched.sort((a, b) => b.score - a.score || a.point.name.localeCompare(b.point.name))

  const all = matched.map((m) => m.point)
  const shown = all.filter((p) => state.enabled[p.cat])
  const hiddenByLayer = all.filter((p) => !state.enabled[p.cat])

  return { query: q, shown, matched: all, hiddenByLayer, ranked: all }
}

/** Per-category counts over a given set, for the chip row. */
export function countByCat(points) {
  const c = {}
  for (const p of points) c[p.cat] = (c[p.cat] || 0) + 1
  return c
}
