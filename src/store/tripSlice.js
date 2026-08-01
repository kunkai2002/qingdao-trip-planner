import {
  TRIP_SEED,
  seedDays,
  makeItem,
  dayColor,
  addDays,
  daysBetween,
  DEFAULT_STAY,
  formatDate,
} from '../data/trip.js'
import { optimizeDay } from '../lib/optimize.js'
import { formatDistance } from '../data/trip.js'

/* ============================================================
   The itinerary half of the store.

   Kept in its own file because it is a different subject from "points on a
   map", and because every action in here has to answer the same two questions:
   does it need an undo snapshot, and does it need to persist.

   Reordering, deleting and optimising are destructive to something the user
   arranged by hand, so all three snapshot first. Editing a note does not.
   ============================================================ */

const UNDO_LIMIT = 30

export function createTripSlice(set, get) {
  /* Snapshot before a destructive change. Cheap: days are a few dozen small
     objects, and structural sharing means the untouched days are not copied. */
  const snapshot = (label) => {
    const { trip, days, _undo } = get()
    set({ _undo: [..._undo.slice(-(UNDO_LIMIT - 1)), { label, trip, days }] })
  }

  const commit = (days, extra = {}) => {
    set({ days, ...extra })
    get().persist()
  }

  const withDay = (dayId, fn) => {
    const days = get().days.map((d) => (d.id === dayId ? fn(d) : d))
    return days
  }

  return {
    /* ---- data ---- */
    trip: TRIP_SEED,
    days: [],
    savedIds: [],

    /* ---- view ---- */
    view: 'itinerary', // overview | itinerary | explore | saved | checklist | settings
    activeDayId: null,
    /* Which card the pointer is over. Lives in the store because the map is a
       sibling of the list, not a child — there is nowhere else both can see. */
    hoverPointId: null,
    /* Bumped when a pin is clicked, so the list can scroll to the card without
       fighting the user's own scrolling on every unrelated render. */
    revealSeq: 0,
    revealPointId: null,

    _undo: [],

    /* ================= view ================= */

    /* Clearing `selectedId` is the point, not a side effect: a set selectedId
       IS the open detail, so keeping it would make every nav destination render
       the place you last tapped instead of the section you just asked for. */
    setView(view) {
      set({ view, panel: null, selectedId: null })
    },
    setActiveDay(id) {
      set({ activeDayId: id })
    },
    setHover(pointId) {
      if (get().hoverPointId !== pointId) set({ hoverPointId: pointId })
    },

    /** Ask the itinerary list to scroll to this point and flash it. */
    reveal(pointId) {
      const day = get().dayOfPoint(pointId)
      set({
        activeDayId: day ? day.id : get().activeDayId,
        revealPointId: pointId,
        revealSeq: get().revealSeq + 1,
      })
    },

    /* ================= lookups ================= */

    activeDay() {
      const { days, activeDayId } = get()
      return days.find((d) => d.id === activeDayId) || days[0] || null
    },
    dayOfPoint(pointId) {
      return get().days.find((d) => d.items.some((it) => it.pointId === pointId)) || null
    },
    /** Every day this point appears in — a point may legitimately repeat. */
    daysOfPoint(pointId) {
      return get().days.filter((d) => d.items.some((it) => it.pointId === pointId))
    },
    isScheduled(pointId) {
      return get().days.some((d) => d.items.some((it) => it.pointId === pointId))
    },
    dayIndex(dayId) {
      return get().days.findIndex((d) => d.id === dayId)
    },
    /** 1-based position of a point within a day, for the numbered pins. */
    seqInDay(dayId, pointId) {
      const day = get().days.find((d) => d.id === dayId)
      if (!day) return 0
      const i = day.items.findIndex((it) => it.pointId === pointId)
      return i < 0 ? 0 : i + 1
    },

    /* ================= trip ================= */

    updateTrip(patch) {
      const trip = { ...get().trip, ...patch }
      set({ trip })
      /* Days follow the start date: moving the trip must not leave day 3 dated
         before day 1. Titles and contents stay put — only the dates shift. */
      if (patch.startDate) {
        const days = get().days.map((d, i) => ({ ...d, date: addDays(patch.startDate, i) }))
        set({ days })
      }
      get().persist()
    },

    /* ================= days ================= */

    addDay() {
      const days = get().days
      const last = days[days.length - 1]
      const date = last ? addDays(last.date, 1) : get().trip.startDate
      const day = {
        id: `day-${Date.now().toString(36)}`,
        date,
        title: '',
        color: dayColor(days.length),
        startTime: '09:00',
        items: [],
      }
      const next = [...days, day]
      commit(next, { activeDayId: day.id })
      get().updateTrip({ endDate: date })
      get().notify(`已添加 ${formatDate(date).full}`, 'good', 'calendarPlus')
      return day.id
    },

    removeDay(dayId) {
      const days = get().days
      if (days.length <= 1) {
        get().notify('至少要保留一天', 'warn', 'alert')
        return
      }
      snapshot('删除一天')
      const i = days.findIndex((d) => d.id === dayId)
      const next = days.filter((d) => d.id !== dayId)
      commit(next, { activeDayId: (next[i] || next[next.length - 1]).id })
      get().notify('已删除这一天，可撤销', 'bad', 'trash')
    },

    updateDay(dayId, patch) {
      commit(withDay(dayId, (d) => ({ ...d, ...patch })))
    },

    /* ================= items ================= */

    /**
     * Add a place to a day. Defaults come from the place itself so the card is
     * useful the moment it appears: a place that needs booking arrives with an
     * open reservation task rather than silently looking done.
     */
    addToDay(dayId, pointId, index = -1) {
      const point = get().getPoint(pointId)
      if (!point) return null
      const day = get().days.find((d) => d.id === dayId)
      if (!day) return null

      snapshot('添加地点')
      const item = makeItem(pointId, day.items.length, {
        reservationStatus: point.booking ? 'todo' : 'none',
      })
      const items =
        index < 0 || index >= day.items.length
          ? [...day.items, item]
          : [...day.items.slice(0, index), item, ...day.items.slice(index)]
      commit(
        withDay(dayId, (d) => ({ ...d, items })),
        { activeDayId: dayId },
      )
      get().notify(`已把「${point.name}」加入 ${formatDate(day.date).md}`, 'good', 'plus')
      return item.id
    },

    removeItem(dayId, itemId) {
      const day = get().days.find((d) => d.id === dayId)
      const item = day?.items.find((it) => it.id === itemId)
      const point = item && get().getPoint(item.pointId)
      snapshot('移除地点')
      commit(withDay(dayId, (d) => ({ ...d, items: d.items.filter((it) => it.id !== itemId) })))
      get().notify(`已移出行程：${point?.name || ''}`, 'bad', 'trash')
    },

    /** Remove by point id, from wherever it is — what a place card's toggle needs. */
    removePoint(pointId) {
      const day = get().dayOfPoint(pointId)
      if (!day) return
      const item = day.items.find((it) => it.pointId === pointId)
      if (item) get().removeItem(day.id, item.id)
    },

    reorderItems(dayId, from, to) {
      if (from === to) return
      snapshot('调整顺序')
      commit(
        withDay(dayId, (d) => {
          const items = [...d.items]
          const [moved] = items.splice(from, 1)
          items.splice(to, 0, moved)
          return { ...d, items }
        }),
      )
    },

    moveItemToDay(fromDayId, itemId, toDayId) {
      if (fromDayId === toDayId) return
      const from = get().days.find((d) => d.id === fromDayId)
      const item = from?.items.find((it) => it.id === itemId)
      if (!item) return
      snapshot('移动到其他日期')
      const days = get().days.map((d) => {
        if (d.id === fromDayId) return { ...d, items: d.items.filter((it) => it.id !== itemId) }
        if (d.id === toDayId) return { ...d, items: [...d.items, item] }
        return d
      })
      commit(days, { activeDayId: toDayId })
      const target = days.find((d) => d.id === toDayId)
      get().notify(`已移到 ${formatDate(target.date).md}`, 'good', 'calendar')
    },

    updateItem(dayId, itemId, patch) {
      commit(
        withDay(dayId, (d) => ({
          ...d,
          items: d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
        })),
      )
    },

    toggleLock(dayId, itemId) {
      const day = get().days.find((d) => d.id === dayId)
      const item = day?.items.find((it) => it.id === itemId)
      if (!item) return
      get().updateItem(dayId, itemId, { locked: !item.locked })
    },

    /* ================= optimise ================= */

    optimiseDay(dayId) {
      const day = get().days.find((d) => d.id === dayId)
      if (!day) return null
      const hotel = get().trip.hotelPointId ? get().getPoint(get().trip.hotelPointId) : null
      const result = optimizeDay(day.items, get().getPoint, {
        startCoord: hotel ? [hotel.lat, hotel.lng] : null,
      })
      if (result.moved === 0) {
        get().notify('已经是较短的顺序了，没有改动', 'info', 'checkCircle')
        return result
      }
      snapshot('优化顺序')
      commit(withDay(dayId, (d) => ({ ...d, items: result.items })))
      const saved = Math.max(0, result.before - result.after)
      get().notify(
        `顺序已优化，直线距离少约 ${formatDistance(saved)}（估算，可撤销）`,
        'good',
        'wand',
      )
      return result
    },

    /* ================= saved ================= */

    toggleSaved(pointId) {
      const on = get().savedIds.includes(pointId)
      const savedIds = on
        ? get().savedIds.filter((id) => id !== pointId)
        : [...get().savedIds, pointId]
      set({ savedIds })
      get().persist()
      const p = get().getPoint(pointId)
      get().notify(on ? `已取消收藏：${p?.name || ''}` : `已收藏：${p?.name || ''}`, 'info', on ? 'star' : 'starFilled')
    },

    /* ================= undo ================= */

    canUndo() {
      return get()._undo.length > 0
    },
    undo() {
      const stack = get()._undo
      if (!stack.length) {
        get().notify('没有可撤销的操作', 'info', 'undo')
        return
      }
      const last = stack[stack.length - 1]
      set({ trip: last.trip, days: last.days, _undo: stack.slice(0, -1) })
      get().persist()
      get().notify(`已撤销「${last.label}」`, 'info', 'undo')
    },

    /* ================= migration ================= */

    /**
     * Build the itinerary state from whatever was in storage.
     *
     * Three shapes have to survive: v3 (has `days`), v2 (points + myRoutes, the
     * shipped version), and the original v1 blob. v2 is the important one — the
     * five 按天 preset routes *were* the itinerary, so they become the days
     * rather than being thrown away and re-entered by hand.
     */
    hydrateTrip(saved) {
      const seeded = seedDays()
      if (saved?.days?.length) {
        const days = saved.days.map((d, i) => ({
          id: d.id || `day-${i + 1}`,
          date: d.date || addDays(saved.trip?.startDate || TRIP_SEED.startDate, i),
          title: typeof d.title === 'string' ? d.title : '',
          color: d.color || dayColor(i),
          startTime: /^\d{1,2}:\d{2}$/.test(d.startTime) ? d.startTime : '09:00',
          items: (Array.isArray(d.items) ? d.items : [])
            .filter((it) => it && typeof it.pointId === 'string')
            .map((it, j) => ({ ...makeItem(it.pointId, j), ...it })),
        }))
        return {
          trip: { ...TRIP_SEED, ...(saved.trip || {}) },
          days: days.length ? days : seeded,
          savedIds: Array.isArray(saved.savedIds) ? saved.savedIds : [],
        }
      }

      /* v2 and older: no days ever existed. The preset day routes are the
         closest true statement about what the user planned, so seed from them
         and keep any DIY route as an extra day rather than dropping it. */
      const extra = (saved?.myRoutes || [])
        .filter((r) => Array.isArray(r.stops) && r.stops.length)
        .map((r, i) => ({
          id: `day-diy-${i + 1}`,
          date: addDays(TRIP_SEED.startDate, seeded.length + i),
          title: r.name || '自建路线',
          color: dayColor(seeded.length + i),
          startTime: '09:00',
          items: r.stops.map((pid, j) => makeItem(pid, j)),
        }))

      const days = [...seeded, ...extra]
      return {
        trip: {
          ...TRIP_SEED,
          endDate: addDays(TRIP_SEED.startDate, Math.max(0, days.length - 1)),
        },
        days,
        savedIds: [],
      }
    },

    /** Drop itinerary entries whose point no longer exists (import, reset). */
    pruneItems(validIds) {
      const days = get().days.map((d) => ({
        ...d,
        items: d.items.filter((it) => validIds.has(it.pointId)),
      }))
      set({ days, savedIds: get().savedIds.filter((id) => validIds.has(id)) })
    },
  }
}

/* ---------------- derived, kept out of state ---------------- */

export function dayStats(day, getPoint, timeline) {
  const points = day.items.map((it) => getPoint(it.pointId)).filter(Boolean)
  const areas = [...new Set(points.map((p) => p.area).filter(Boolean))]
  const booking = day.items.filter((it) => it.reservationStatus === 'todo').length
  return {
    count: day.items.length,
    missing: day.items.length - points.length,
    areas,
    booking,
    metres: timeline.totalMetres,
    travelMinutes: timeline.totalTravel,
    stayMinutes: timeline.totalStay,
    endMinutes: timeline.endMinutes,
  }
}

export { DEFAULT_STAY }
