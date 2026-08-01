/* ============================================================
   The trip itself.

   The old model's top object was a *point*, so the product could only ever
   answer "where is this place". The questions people actually have are "what
   am I doing on the 1st" and "does the afternoon still fit" — those need a
   trip that owns days, and days that own ordered stops.

     Trip → TripDay → ItineraryItem → (pointId) → the point on the map

   An ItineraryItem deliberately stores only `pointId` plus the fields that
   belong to *this visit*. Copying the point in would fork the data: edit the
   place and the itinerary would still show yesterday's name and address.
   ============================================================ */

import { PRESET_ROUTES } from './routes.js'

/* One fixed hue per day. Fixed, not generated: the colour is how you read the
   map, so D2 has to still be D2's colour after you delete D1. */
export const DAY_COLORS = [
  '#087EA4', // sea
  '#B64A3E', // roof
  '#4C7A34', // pine
  '#8A5AA8', // plum
  '#C07A18', // amber
  '#357A7A', // teal
  '#9A4B6B', // rose
]

export const dayColor = (i) => DAY_COLORS[i % DAY_COLORS.length]

/* How long people actually stop, by category. These are starting points the
   user edits per stop, not claims about the place — a museum is not 90 minutes
   because we measured it, it is 90 minutes because that is a sane first guess
   that is quicker to correct than to enter from scratch. */
export const DEFAULT_STAY = {
  sight: 90,
  food: 70,
  fun: 120,
  stay: 0,
  metro: 0,
}

export const TRIP_SEED = {
  id: 'trip-qingdao',
  title: '青岛五日',
  startDate: '2026-09-29',
  endDate: '2026-10-03',
  travelers: 4,
  hotelPointId: null,
  notes: '',
}

/* The five 按天 preset routes already were the itinerary — they just had no
   dates, no times and no way to reorder. They become the seed days, so anyone
   who used the old version finds their plan where they left it. */
const DAY_TITLES = {
  d1: '海军 + 赶海',
  d2: '崂山一日',
  d3: '会师 + 室内',
  d4: '老城线',
  d5: '娱乐 + 升级局',
}

const SEED_DAY_IDS = ['d1', 'd2', 'd3', 'd4', 'd5']

export function seedDays() {
  return SEED_DAY_IDS.map((rid, i) => {
    const preset = PRESET_ROUTES.find((r) => r.id === rid)
    return {
      id: `day-${i + 1}`,
      date: addDays(TRIP_SEED.startDate, i),
      title: DAY_TITLES[rid] || `第 ${i + 1} 天`,
      color: dayColor(i),
      startTime: '09:00',
      items: (preset?.stops || []).map((pointId, j) => makeItem(pointId, j)),
    }
  })
}

/* Routes that are a *theme* rather than a day (拍照打卡线, 觅食线, 海边线) are
   not days and must not become them. They stay browsable in 探索 as a way to
   drop a whole set of places into whichever day you choose. */
export const THEME_ROUTES = PRESET_ROUTES.filter((r) => !SEED_DAY_IDS.includes(r.id))

let itemSeq = 0
export function makeItem(pointId, index = 0, extra = {}) {
  return {
    id: `it-${Date.now().toString(36)}-${(itemSeq++).toString(36)}-${index}`,
    pointId,
    plannedStart: null, // null = follow the cascade from the day's start time
    durationMinutes: null, // null = fall back to DEFAULT_STAY for the category
    transitMode: 'auto', // how you get here from the previous stop
    reservationStatus: 'none', // none | todo | done
    estimatedCost: null, // null = fall back to the point's own price
    note: '',
    locked: false, // optimisation leaves locked stops where they are
    ...extra,
  }
}

/* ---------------- dates ---------------- */
/* Everything is a plain 'YYYY-MM-DD' string. Date objects would drag in the
   timezone question for no benefit — a trip day is a calendar day, not an
   instant, and `new Date('2026-09-29')` is already UTC midnight, which is the
   28th in some places. */

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** '2026-09-29' → { md: '9/29', weekday: '周二', full: '9 月 29 日 周二' } */
export function formatDate(iso) {
  if (!iso) return { md: '', weekday: '', full: '' }
  const [y, m, d] = iso.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return { md: `${m}/${d}`, weekday: wd, full: `${m} 月 ${d} 日 ${wd}` }
}

/* ---------------- money ---------------- */

/* Prices in the seed data are human strings: '免费', '¥100–180', '~500–750/晚',
   '2 / 3 号线'. Parsing has to be conservative — inventing a number for a metro
   line's route list would quietly poison every budget on the page. */
export function parsePrice(prices) {
  if (!Array.isArray(prices) || !prices.length) return null
  for (const row of prices) {
    if (!Array.isArray(row) || row.length < 2) continue
    const label = String(row[0] ?? '')
    const value = String(row[1] ?? '')
    const both = `${label}${value}`
    if (/号线/.test(both)) continue // a metro line list, not a price
    if (/免费/.test(both)) return 0
    if (!/[¥￥元]|人均|晚|房|套餐/.test(both)) continue
    const nums = value.match(/\d+(?:\.\d+)?/g)
    if (!nums?.length) continue
    const vals = nums.map(Number).filter((n) => Number.isFinite(n) && n < 100000)
    if (!vals.length) continue
    // a range like 100–180 reads as its midpoint; a single number as itself
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }
  return null
}

/** Per-person cost we are willing to claim for one stop. */
export function pointCost(point) {
  if (!point) return null
  // Lodging is priced per room per night, not per head — mixing it into a
  // per-person day total would silently multiply it by the party size.
  if (point.cat === 'stay' || point.cat === 'metro') return null
  return parsePrice(point.prices)
}

/* ---------------- time ---------------- */

export function minutesToClock(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function clockToMinutes(hhmm) {
  if (typeof hhmm !== 'string') return null
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** '1h 20m' style, but in Chinese and without a leading zero hour. */
export function formatDuration(mins) {
  const m = Math.max(0, Math.round(mins || 0))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`
}

export function formatDistance(metres) {
  const m = Math.max(0, Math.round(metres || 0))
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}
