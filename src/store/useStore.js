import { create } from 'zustand'
import { SEED_POINTS } from '../data/points.js'
import { PRESET_ROUTES } from '../data/routes.js'
import { buildChecklist } from '../data/checklist.js'
import { CAT_ORDER } from '../data/categories.js'
import { wgs2gcj, haversine } from '../lib/geo.js'
import { KEYS, read, write, remove, readLegacy } from '../lib/storage.js'

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
const IDLE_MODES = { movingId: null, addMode: false, diyMode: false, draftStops: [] }

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
  panel: null, // 'detail' | 'edit' | 'routes' | 'checklist' | 'menu'
  selectedId: null,
  editingId: null, // null when creating a new point
  pendingLatLng: null,
  activeRouteId: null,
  draftStops: [],
  diyMode: false,
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

    set({
      points,
      myRoutes,
      enabled,
      metroOn,
      checklist,
      ready: true,
      showIntro: !read(KEYS.seen),
    })
  },

  /* Saying 已保存 when the write failed is worse than saying nothing: the trip
     lives only in localStorage, so a silent failure (quota full, Safari private
     mode) means the user believes their edits are safe when they are not.
     Warned once per session, because a full quota fails on every keystroke. */
  persist() {
    const { points, myRoutes, enabled, metroOn } = get()
    const ok = write(KEYS.data, { v: 2, points, myRoutes, enabled, metroOn })
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
      selectedId: null,
      editingId: null,
      pendingLatLng: null,
      addMode: false,
    })
  },
  openDetail(id) {
    set({ panel: 'detail', selectedId: id, editingId: null })
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
    set({ addMode: on, diyMode: on ? false : get().diyMode })
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
      draftStops: s.draftStops.filter((x) => x !== id),
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

  /* ================= routes ================= */

  allRoutes() {
    return [...get().myRoutes, ...PRESET_ROUTES]
  },
  getRoute(id) {
    return get()
      .allRoutes()
      .find((r) => r.id === id)
  },

  showRoute(id) {
    const rt = get().getRoute(id)
    if (!rt) return
    // Showing a route implies its categories should be visible.
    const enabled = { ...get().enabled }
    rt.stops.forEach((sid) => {
      const p = get().getPoint(sid)
      if (p) enabled[p.cat] = true
    })
    set({ activeRouteId: id, enabled, diyMode: false })
    get().persist()
    get().notify(`已显示「${rt.name}」`, 'good', 'routePath')
  },

  clearRoute() {
    set({ activeRouteId: null })
  },

  deleteRoute(id) {
    set((s) => ({
      myRoutes: s.myRoutes.filter((r) => r.id !== id),
      activeRouteId: s.activeRouteId === id ? null : s.activeRouteId,
    }))
    get().persist()
    get().notify('已删除这条自建路线', 'bad', 'trash')
  },

  /* ---- DIY ---- */

  startDiy() {
    set({ diyMode: true, draftStops: [], addMode: false, activeRouteId: null })
    get().notify('依次点击地图上的点位，按顺序串成路线', 'info', 'routePath')
  },
  exitDiy() {
    set({ diyMode: false, draftStops: [] })
  },
  addToDraft(id) {
    const s = get()
    if (!s.diyMode) {
      set({ diyMode: true, draftStops: [], activeRouteId: null })
    }
    if (get().draftStops.includes(id)) {
      get().notify('这个点已在路线里', 'warn', 'info')
      return
    }
    set((st) => ({ draftStops: [...st.draftStops, id] }))
    const p = get().getPoint(id)
    get().notify(`已加入：${p?.name}（第 ${get().draftStops.length} 站）`, 'good', 'plus')
  },
  removeFromDraft(index) {
    set((s) => ({ draftStops: s.draftStops.filter((_, i) => i !== index) }))
  },
  reorderDraft(from, to) {
    set((s) => {
      const next = [...s.draftStops]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { draftStops: next }
    })
  },
  saveDraft(name) {
    const stops = get().draftStops
    if (stops.length < 2) {
      get().notify('至少选 2 个点位', 'warn', 'alert')
      return null
    }
    const route = {
      id: 'r' + Date.now().toString(36),
      group: '我的',
      name: name || `我的路线 ${get().myRoutes.length + 1}`,
      icon: 'bookmark',
      stops: [...stops],
      color: '#6d5bc7',
    }
    set((s) => ({ myRoutes: [...s.myRoutes, route], diyMode: false, draftStops: [] }))
    get().persist()
    get().showRoute(route.id)
    return route.id
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
    const { points, myRoutes, checklist } = get()
    const payload = { v: 2, exported: new Date().toISOString(), points, myRoutes, checklist }
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
      set({
        points,
        // drop stops pointing at points the incoming backup does not contain,
        // or they render as nothing yet still count and get saved into routes
        myRoutes: (d.myRoutes || d.routes || [])
          .map(fromLegacyRoute)
          .map((r) => ({ ...r, stops: r.stops.filter((id) => ids.has(id)) })),
        activeRouteId: null,
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
    set({
      points: shiftSeed(),
      myRoutes: [],
      enabled: allEnabled(),
      metroOn: true,
      activeRouteId: null,
      panel: null,
      selectedId: null,
      ...IDLE_MODES,
    })
    get().persist()
    get().notify('已恢复默认数据', 'info', 'refresh')
  },
}))

if (import.meta.env.DEV) window.__store = useStore

/* ------------------------------------------------------------------ */
/* derived selectors (kept out of state so they never go stale)         */
/* ------------------------------------------------------------------ */

/* Search moved to lib/search.js — it has to rank, and it must match text
   BEFORE consulting the layer switches, which this function did backwards. */

/** Ordered [lat,lng] list for a route, skipping stops that were deleted. */
export function routeCoords(state, stops) {
  return stops
    .map((id) => state.points.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => [p.lat, p.lng])
}

export function routeDistance(state, stops) {
  const pts = routeCoords(state, stops)
  let total = 0
  for (let i = 1; i < pts.length; i++) total += haversine(pts[i - 1], pts[i])
  return total
}
