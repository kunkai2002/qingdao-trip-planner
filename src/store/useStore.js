import { create } from 'zustand'
import { SEED_POINTS } from '../data/points.js'
import { buildChecklist } from '../data/checklist.js'
import { CAT_ORDER } from '../data/categories.js'
import { wgs2gcj } from '../lib/geo.js'
import { KEYS, read, write, remove, readLegacy } from '../lib/storage.js'
import { createTripSlice } from './tripSlice.js'

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const shiftSeed = () =>
  SEED_POINTS.map((p) => {
    const [lat, lng] = wgs2gcj(p.lat, p.lng)
    return { ...p, lat, lng }
  })

/** v1 stored terse keys and a single `nt` blob with a ⚠ marker inside. */
function fromLegacyPoint(p) {
  if (p.cat || p.name) return p // already v2
  const raw = p.nt || ''
  const [note, ...rest] = raw.split('⚠')
  return {
    id: p.id,
    cat: p.c,
    name: p.n,
    lat: p.lat,
    lng: p.lng,
    rating: p.r || 0,
    reviews: p.rv || 0,
    prices: p.pr || [],
    address: p.ad || '',
    area: p.ar || '',
    hours: p.h || '',
    tel: p.tel || '',
    tags: p.tg || [],
    note: (note || '').trim(),
    warn: rest.join(' ').trim() || undefined,
    booking: !!p.bk,
  }
}

function fromLegacyRoute(r) {
  return {
    id: r.id,
    group: r.group || r.cat || '我的',
    name: r.name,
    icon: r.icon || 'routePath',
    stops: r.stops || [],
    color: r.color || '#6d5bc7',
  }
}

const allEnabled = () => CAT_ORDER.reduce((a, k) => ({ ...a, [k]: true }), {})

/** Every interaction mode back to rest. Anything that swaps the point set out
    from under the user (import, reset) must apply this, or modes keep pointing
    at ids that no longer exist. */
const IDLE_MODES = { movingId: null, addMode: false }

/* An imported file is untrusted input, and whatever it contains gets written
   straight to localStorage. A point with a missing id or a string latitude
   renders as nothing but still counts, still gets saved, and can crash the map
   layer — so validate here rather than discovering it later. */
function sanePoint(p) {
  if (!p || typeof p !== 'object') return null
  const lat = Number(p.lat)
  const lng = Number(p.lng)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null
  const id = typeof p.id === 'string' && p.id ? p.id : null
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : null
  if (!id || !name) return null
  return {
    ...p,
    id,
    name,
    lat,
    lng,
    cat: CAT_ORDER.includes(p.cat) ? p.cat : 'sight',
    rating: Number.isFinite(Number(p.rating)) ? Math.max(0, Math.min(5, Number(p.rating))) : 0,
    reviews: Number.isFinite(Number(p.reviews)) ? Math.max(0, Number(p.reviews)) : 0,
    prices: Array.isArray(p.prices)
      ? p.prices.filter((r) => Array.isArray(r) && r.length === 2).map(([a, b]) => [String(a), String(b)])
      : [],
    tags: Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string') : [],
    booking: !!p.booking,
  }
}

function initialTheme() {
  const saved = read(KEYS.theme)
  return saved === 'light' || saved === 'dark' ? saved : 'auto'
}

/* ------------------------------------------------------------------ */
/* store                                                              */
/* ------------------------------------------------------------------ */

let toastSeq = 0

export const useStore = create((set, get) => ({
  /* The itinerary lives in its own slice. Spread first so anything defined
     below wins a name clash rather than silently shadowing the map store. */
  ...createTripSlice(set, get),

  /* ---- data ---- */
  points: [],
  myRoutes: [],
  checklist: [],

  /* ---- view ---- */
  enabled: allEnabled(),
  metroOn: true,
  query: '',
  theme: initialTheme(),
  basemap: read(KEYS.basemap) === 'satellite' ? 'satellite' : 'road',

  /* ---- selection / modes ---- */
  panel: null, // 'edit' when the place editor is open; otherwise null
  panelFrom: null, // the list we drilled in from, for the back arrow
  selectedId: null,
  editingId: null, // null when creating a new point
  pendingLatLng: null,
  addMode: false,
  /* Markers are NOT draggable by default — a drag on the map must pan the map.
     Exactly one point at a time can be armed for moving, from its detail panel. */
  movingId: null,

  /* ---- geolocation ---- */
  userPos: null,
  locating: false,

  /* ---- ephemeral ---- */
  _storageWarned: false,
  toast: null,
  showIntro: false,
  ready: false,

  /* ================= lifecycle ================= */

  init() {
    const saved = read(KEYS.data)
    const legacy = saved ? null : readLegacy()

    let points, myRoutes, enabled, metroOn
    if (saved?.points?.length) {
      points = saved.points.map(fromLegacyPoint)
      myRoutes = (saved.myRoutes || saved.routes || []).map(fromLegacyRoute)
      enabled = { ...allEnabled(), ...(saved.enabled || {}) }
      metroOn = saved.metroOn !== false
    } else if (legacy?.data?.points?.length) {
      points = legacy.data.points.map(fromLegacyPoint)
      myRoutes = (legacy.data.routes || []).map(fromLegacyRoute)
      enabled = { ...allEnabled(), ...(legacy.data.enabled || {}) }
      metroOn = legacy.data.metroOn !== 0
    } else {
      points = shiftSeed()
      myRoutes = []
      enabled = allEnabled()
      metroOn = true
    }

    const chk = read(KEYS.checklist)
    const checklist = Array.isArray(chk?.groups) ? chk.groups : buildChecklist()

    /* The itinerary is rebuilt from whatever shape was on disk — including the
       v2 payload that never had one, where the 按天 preset routes are the
       user's actual plan and become the days. */
    const { trip, days, savedIds } = get().hydrateTrip(saved || legacy?.data || null)
    const ids = new Set(points.map((p) => p.id))

    set({
      points,
      myRoutes,
      enabled,
      metroOn,
      checklist,
      trip,
      // a stop pointing at a deleted point renders as nothing but still counts
      days: days.map((d) => ({ ...d, items: d.items.filter((it) => ids.has(it.pointId)) })),
      savedIds: savedIds.filter((id) => ids.has(id)),
      activeDayId: days[0]?.id || null,
      ready: true,
      showIntro: !read(KEYS.seen),
    })

    /* Write the migration back immediately. Without this, someone who opens the
       app and changes nothing still has the old payload on disk, so the trip is
       rebuilt from the presets on every launch — and an export taken in that
       window would carry the old shape too. */
    if (!saved?.days?.length) get().persist()
  },

  /* Saying 已保存 when the write failed is worse than saying nothing: the trip
     lives only in localStorage, so a silent failure (quota full, Safari private
     mode) means the user believes their edits are safe when they are not.
     Warned once per session, because a full quota fails on every keystroke. */
  persist() {
    const { points, myRoutes, enabled, metroOn, trip, days, savedIds } = get()
    const ok = write(KEYS.data, {
      v: 3,
      points,
      myRoutes,
      enabled,
      metroOn,
      trip,
      days,
      savedIds,
    })
    if (!ok && !get()._storageWarned) {
      set({ _storageWarned: true })
      get().notify('保存失败：浏览器存储已满或处于隐私模式。请立刻「导出备份」', 'bad', 'alert')
    }
    return ok
  },

  persistChecklist() {
    return write(KEYS.checklist, { groups: get().checklist })
  },

  /* ================= toast ================= */

  notify(text, tone = 'info', icon) {
    set({ toast: { id: ++toastSeq, text, tone, icon } })
  },
  dismissToast(id) {
    if (get().toast?.id === id) set({ toast: null })
  },

  /* ================= theme ================= */

  setTheme(next, announce = true) {
    if (next === get().theme) return
    set({ theme: next })
    if (next === 'auto') remove(KEYS.theme)
    else write(KEYS.theme, next)
    if (!announce) return
    const label = { auto: '跟随系统', light: '浅色', dark: '深色' }[next]
    get().notify(`地图外观：${label}`, 'info', next === 'dark' ? 'moon' : 'sun')
  },

  cycleTheme() {
    const order = ['auto', 'light', 'dark']
    get().setTheme(order[(order.indexOf(get().theme) + 1) % order.length])
  },

  /* Every major map has this and we had nothing — "fit to all points" is not
     the same affordance for someone actually standing in Qingdao.
     The device reports WGS-84; the basemap is GCJ-02, so the fix has to be
     shifted or the blue dot lands a few hundred metres off. */
  locate() {
    if (!navigator.geolocation) {
      get().notify('这个浏览器不支持定位', 'warn', 'alert')
      return
    }
    if (get().locating) return
    set({ locating: true })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const [lat, lng] = wgs2gcj(pos.coords.latitude, pos.coords.longitude)
        set({ userPos: { lat, lng, accuracy: pos.coords.accuracy || 0 }, locating: false })
      },
      (err) => {
        set({ locating: false })
        get().notify(
          err.code === 1
            ? '定位被拒绝了，请在浏览器地址栏的权限里允许位置'
            : '定位失败，室内信号弱时常见，可稍后再试',
          'warn',
          'alert',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  },

  setBasemap(basemap) {
    set({ basemap })
    write(KEYS.basemap, basemap)
  },

  /* ================= layers & search ================= */

  toggleCat(key) {
    set((s) => ({ enabled: { ...s.enabled, [key]: !s.enabled[key] } }))
    get().persist()
  },
  enableCats(keys) {
    set((s) => ({ enabled: { ...s.enabled, ...Object.fromEntries(keys.map((k) => [k, true])) } }))
    get().persist()
  },
  toggleMetro() {
    set((s) => ({ metroOn: !s.metroOn }))
    get().persist()
  },
  setQuery(query) {
    set({ query })
  },

  /* ================= panels ================= */

  openPanel(panel) {
    set({ panel })
  },
  /* Closing the sheet must also end any mode it was hosting. `movingId` used to
     outlive its own cancel button: the armed marker kept dragging enabled and
     was force-excluded from clustering, so a thumb landing on it while panning
     silently moved and persisted the point, and the only control that ends the
     mode was back inside that point's detail. */
  closePanel() {
    get().endMove(false)
    set({
      panel: null,
      panelFrom: null,
      selectedId: null,
      editingId: null,
      pendingLatLng: null,
      addMode: false,
    })
  },
  openDetail(id) {
    set({ panel: 'detail', selectedId: id, editingId: null })
  },

  /* Drilling from a list into one of its items used to replace the list with
     no way back — you tapped a stop in a route and the route was simply gone.
     `from` remembers where you came from so the header can offer a back arrow.
     Deliberately one level: this is a drill-in, not a browser history. */
  drillTo(id, from) {
    set({ panel: 'detail', selectedId: id, editingId: null, panelFrom: from })
  },
  popPanel() {
    const from = get().panelFrom
    if (!from) return get().closePanel()
    set({ panel: from, panelFrom: null, selectedId: null, editingId: null })
  },
  openEdit(id) {
    set({ panel: 'edit', editingId: id ?? null, selectedId: id ?? null })
  },
  dismissIntro() {
    write(KEYS.seen, 1)
    set({ showIntro: false })
  },

  /* ================= points ================= */

  getPoint(id) {
    return get().points.find((p) => p.id === id)
  },

  armAdd() {
    const on = !get().addMode
    set({ addMode: on })
    get().notify(
      on ? '点击地图上任意位置放置新点位' : '已退出新增模式',
      'info',
      on ? 'pinPlus' : 'close',
    )
  },

  placeNewPoint(latlng) {
    set({ addMode: false, pendingLatLng: latlng, editingId: null, panel: 'edit' })
  },

  savePoint(id, data) {
    if (id) {
      set((s) => ({ points: s.points.map((p) => (p.id === id ? { ...p, ...data } : p)) }))
    } else {
      const ll = get().pendingLatLng
      const fresh = {
        ...data,
        id: 'u' + Date.now().toString(36),
        lat: ll?.lat ?? 36.062,
        lng: ll?.lng ?? 120.384,
      }
      set((s) => ({ points: [...s.points, fresh], pendingLatLng: null }))
      id = fresh.id
    }
    const ok = get().persist()
    set({ panel: 'detail', selectedId: id, editingId: null })
    // persist() has already explained itself if the write failed
    if (ok) get().notify('已保存', 'good', 'checkCircle')
    return id
  },

  deletePoint(id) {
    const p = get().getPoint(id)
    set((s) => ({
      points: s.points.filter((x) => x.id !== id),
      myRoutes: s.myRoutes.map((r) => ({ ...r, stops: r.stops.filter((x) => x !== id) })),
      // the itinerary must not keep a stop whose place no longer exists
      days: s.days.map((d) => ({ ...d, items: d.items.filter((it) => it.pointId !== id) })),
      savedIds: s.savedIds.filter((x) => x !== id),
      panel: null,
      selectedId: null,
      // otherwise a later endMove() announces a saved position for a dead point
      movingId: s.movingId === id ? null : s.movingId,
    }))
    get().persist()
    get().notify(`已删除「${p?.name || ''}」`, 'bad', 'trash')
  },

  movePoint(id, lat, lng) {
    set((s) => ({ points: s.points.map((p) => (p.id === id ? { ...p, lat, lng } : p)) }))
    get().persist()
  },

  /** Arm a single point for dragging. Panning stays available everywhere else. */
  startMove(id) {
    set({ movingId: id, addMode: false })
    get().notify('拖动这个点位到正确位置，其余地方仍可平移地图', 'info', 'gripDots')
  },
  endMove(announce = true) {
    const id = get().movingId
    if (!id) return
    set({ movingId: null })
    if (announce) {
      const p = get().getPoint(id)
      get().notify(`「${p?.name || ''}」位置已保存`, 'good', 'checkCircle')
    }
  },

  /* ================= checklist ================= */

  toggleCheck(gi, ii) {
    set((s) => {
      const groups = s.checklist.map((g, i) =>
        i !== gi
          ? g
          : { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, done: !it.done } : it)) },
      )
      return { checklist: groups }
    })
    get().persistChecklist()
  },
  addCheckItem(gi, text) {
    if (!text?.trim()) return
    set((s) => ({
      checklist: s.checklist.map((g, i) =>
        i !== gi ? g : { ...g, items: [...g.items, { text: text.trim(), done: false, custom: true }] },
      ),
    }))
    get().persistChecklist()
  },
  delCheckItem(gi, ii) {
    set((s) => ({
      checklist: s.checklist.map((g, i) =>
        i !== gi ? g : { ...g, items: g.items.filter((_, j) => j !== ii) },
      ),
    }))
    get().persistChecklist()
  },
  resetChecklist() {
    remove(KEYS.checklist)
    set({ checklist: buildChecklist() })
    get().notify('清单已重置', 'info', 'refresh')
  },

  /* ================= data in / out ================= */

  exportData() {
    const { points, myRoutes, checklist, trip, days, savedIds } = get()
    const payload = {
      schemaVersion: 3,
      v: 3, // older builds look for `v`; keeping it means they can still read this
      exported: new Date().toISOString(),
      points,
      myRoutes,
      checklist,
      trip,
      days,
      savedIds,
    }
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `青岛行程备份-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    get().notify('备份已导出', 'good', 'download')
  },

  importData(text) {
    try {
      const d = JSON.parse(text)
      if (!Array.isArray(d.points) || !d.points.length) throw new Error('no points')
      /* Filter non-objects BEFORE fromLegacyPoint — it dereferences its
         argument, so a stray null in the array would abort the whole import
         and lose the records that were perfectly good. */
      const points = d.points
        .filter((p) => p && typeof p === 'object')
        .map(fromLegacyPoint)
        .map(sanePoint)
        .filter(Boolean)
      if (!points.length) throw new Error('no usable points')
      const dropped = d.points.length - points.length
      const ids = new Set(points.map((p) => p.id))
      /* A v1/v2 backup has no itinerary in it. Rebuilding from its routes is
         the honest reading — the alternative is importing a trip and finding
         every day empty. */
      const { trip, days, savedIds } = get().hydrateTrip(d)
      set({
        trip,
        days: days.map((day) => ({
          ...day,
          items: day.items.filter((it) => ids.has(it.pointId)),
        })),
        savedIds: savedIds.filter((id) => ids.has(id)),
        activeDayId: days[0]?.id || null,
        _undo: [],
        points,
        /* myRoutes is no longer a feature — the itinerary replaced it. It is
           still carried so that re-importing an old backup, or exporting to a
           machine still running the old build, keeps those routes intact.
           Stops pointing at absent points are dropped either way. */
        myRoutes: (d.myRoutes || d.routes || [])
          .map(fromLegacyRoute)
          .map((r) => ({ ...r, stops: r.stops.filter((id) => ids.has(id)) })),
        panel: null,
        selectedId: null,
        ...IDLE_MODES,
      })
      if (Array.isArray(d.checklist)) {
        set({ checklist: d.checklist })
        get().persistChecklist()
      }
      get().persist()
      get().notify(
        dropped > 0
          ? `已导入 ${points.length} 个点位，跳过 ${dropped} 条无效记录`
          : `已导入 ${points.length} 个点位`,
        dropped > 0 ? 'warn' : 'good',
        'upload',
      )
    } catch {
      get().notify('这个文件读不了，请确认是本应用导出的 JSON', 'bad', 'alert')
    }
  },

  resetData() {
    remove(KEYS.data)
    const fresh = get().hydrateTrip(null)
    set({
      trip: fresh.trip,
      days: fresh.days,
      savedIds: [],
      activeDayId: fresh.days[0]?.id || null,
      _undo: [],
      points: shiftSeed(),
      myRoutes: [],
      enabled: allEnabled(),
      metroOn: true,
      panel: null,
      selectedId: null,
      ...IDLE_MODES,
    })
    get().persist()
    get().notify('已恢复默认数据', 'info', 'refresh')
  },
}))

if (import.meta.env.DEV) window.__store = useStore

/* Search lives in lib/search.js — it has to rank, and it must match text BEFORE
   consulting the layer switches, which the original did backwards.
   Distances and times live in lib/transit.js, because a straight line between
   two stops is not the answer the itinerary needs. */
