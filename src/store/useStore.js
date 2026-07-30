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

  /* ---- ephemeral ---- */
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

  persist() {
    const { points, myRoutes, enabled, metroOn } = get()
    write(KEYS.data, { v: 2, points, myRoutes, enabled, metroOn })
  },

  persistChecklist() {
    write(KEYS.checklist, { groups: get().checklist })
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
    get().notify(`外观：${label}`, 'info', next === 'dark' ? 'moon' : 'sun')
  },

  cycleTheme() {
    const order = ['auto', 'light', 'dark']
    get().setTheme(order[(order.indexOf(get().theme) + 1) % order.length])
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
  closePanel() {
    set({ panel: null, selectedId: null, editingId: null, pendingLatLng: null })
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
    get().persist()
    set({ panel: 'detail', selectedId: id, editingId: null })
    get().notify('已保存', 'good', 'checkCircle')
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
    }))
    get().persist()
    get().notify(`已删除「${p?.name || ''}」`, 'bad', 'trash')
  },

  movePoint(id, lat, lng) {
    set((s) => ({ points: s.points.map((p) => (p.id === id ? { ...p, lat, lng } : p)) }))
    get().persist()
    const p = get().getPoint(id)
    get().notify(`已移动「${p?.name || ''}」`, 'info', 'mapPin')
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
      set({
        points: d.points.map(fromLegacyPoint),
        myRoutes: (d.myRoutes || d.routes || []).map(fromLegacyRoute),
        activeRouteId: null,
        panel: null,
        selectedId: null,
      })
      if (Array.isArray(d.checklist)) {
        set({ checklist: d.checklist })
        get().persistChecklist()
      }
      get().persist()
      get().notify(`已导入 ${d.points.length} 个点位`, 'good', 'upload')
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
      draftStops: [],
      diyMode: false,
      panel: null,
      selectedId: null,
    })
    get().persist()
    get().notify('已恢复默认数据', 'info', 'refresh')
  },
}))

/* ------------------------------------------------------------------ */
/* derived selectors (kept out of state so they never go stale)         */
/* ------------------------------------------------------------------ */

/** Points passing the current layer filter + search query. */
export function visiblePoints(state) {
  const q = state.query.trim().toLowerCase()
  return state.points.filter((p) => {
    if (!state.enabled[p.cat]) return false
    if (!q) return true
    const hay = `${p.name} ${p.area || ''} ${p.address || ''} ${(p.tags || []).join(' ')}`
    return hay.toLowerCase().includes(q)
  })
}

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
