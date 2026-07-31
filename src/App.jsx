import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, routeCoords, routeDistance } from './store/useStore.js'
import { runSearch, countByCat } from './lib/search.js'
import { CATS, CAT_ORDER } from './data/categories.js'
import { PRESET_ROUTES } from './data/routes.js'
import { initGlassPointer } from './lib/glassPointer.js'
import { useIsDesktop } from './lib/useMediaQuery.js'
import { T } from './lib/motion.js'

import { MapCanvas } from './map/MapCanvas.jsx'
import { Ambient } from './components/Ambient.jsx'
import { TopBar } from './components/TopBar.jsx'
import { Chips } from './components/Chips.jsx'
import { Dock } from './components/Dock.jsx'
import { Panel } from './components/Panel.jsx'
import { Toast } from './components/Toast.jsx'
import { Onboarding } from './components/Onboarding.jsx'
import { Dialog, useDialog } from './components/Dialog.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { DetailPanel } from './components/panels/DetailPanel.jsx'
import { EditPanel } from './components/panels/EditPanel.jsx'
import { RoutesPanel } from './components/panels/RoutesPanel.jsx'
import { ChecklistPanel } from './components/panels/ChecklistPanel.jsx'
import { MenuPanel } from './components/panels/MenuPanel.jsx'

/* `detent` is the resting height of the phone sheet: a POI card sits low so the
   map stays the subject, a long list opens tall because reading is the point. */
const PANEL_META = {
  routes: { eyebrow: '行程', eyebrowIcon: 'compass', title: '攻略路线', detent: 'full' },
  checklist: {
    eyebrow: '出行准备',
    eyebrowIcon: 'clipboardCheck',
    title: '证件 · 备忘清单',
    detent: 'full',
  },
  menu: { eyebrow: '设置', eyebrowIcon: 'sliders', title: '菜单与数据', detent: 'full' },
}

export default function App() {
  const s = useStore()
  const dialog = useDialog()
  const mapRef = useRef(null)
  const desktop = useIsDesktop()

  /* ---------------- boot ---------------- */
  useEffect(() => {
    s.init()
    return initGlassPointer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* theme → documentElement */
  useEffect(() => {
    const root = document.documentElement
    if (s.theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', s.theme)
  }, [s.theme])

  /* ---------------- derived ---------------- */
  const search = useMemo(() => runSearch(s), [s.points, s.enabled, s.query])
  const visible = search.shown
  const visibleIds = useMemo(() => new Set(visible.map((p) => p.id)), [visible])
  const searching = !!search.query

  /* Chip counts follow the query, so a filtered map and its own filter row can
     never disagree — and a closed chip still advertises what turning it back on
     would restore, which is why this ignores `enabled`. */
  const counts = useMemo(() => {
    const base = countByCat(searching ? search.matched : s.points)
    const c = {}
    CAT_ORDER.forEach((k) => (c[k] = base[k] || 0))
    return c
  }, [s.points, search.matched, searching])

  const activeRoute = useMemo(
    () => (s.activeRouteId ? s.allRoutes().find((r) => r.id === s.activeRouteId) : null),
    [s.activeRouteId, s.myRoutes],
  )

  const pendingChecks = useMemo(
    () => s.checklist.reduce((n, g) => n + g.items.filter((i) => !i.done).length, 0),
    [s.checklist],
  )

  const selected = s.selectedId ? s.getPoint(s.selectedId) : null
  const distanceOf = useCallback((stops) => routeDistance(s, stops || []), [s.points])

  /* How much of the map the chrome is covering right now. On desktop the panel
     is a right rail; on phones it is a bottom sheet whose live height Panel
     publishes as --panel-h. Both camera calls frame into what is left. */
  const mapInset = useCallback(() => {
    if (!s.panel) return {}
    if (desktop) return { right: 420 }
    const h = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--panel-h'),
      10,
    )
    return { bottom: Number.isFinite(h) ? h : 0 }
  }, [s.panel, desktop])

  /* ---------------- map focus follows selection ---------------- */
  useEffect(() => {
    if (!selected || s.panel !== 'detail') return
    if (import.meta.env.DEV) window.__mapApi = mapRef.current
    mapRef.current?.focus(selected.lat, selected.lng, mapInset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.selectedId, s.panel])

  /* Fly to the user once a fix arrives, zooming in only if we are further out
     than street level — otherwise a locate would throw away their zoom. */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !s.userPos) return
    map.focus(s.userPos.lat, s.userPos.lng, mapInset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.userPos])

  /* ---------------- the camera follows the query ----------------
     Matches were often nowhere near the opening viewport (the three 崂山 hits
     sit 25km east), so the map appeared to simply empty out. Debounced so it
     does not lurch on every keystroke, and the pre-search view is restored when
     the query clears, making search a non-destructive excursion. */
  const savedViewRef = useRef(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!searching) {
      if (savedViewRef.current) {
        map.restoreView(savedViewRef.current)
        savedViewRef.current = null
      }
      return
    }
    if (!savedViewRef.current) savedViewRef.current = map.getView()
    const t = setTimeout(() => {
      const coords = visible.map((p) => [p.lat, p.lng])
      if (coords.length > 1) map.fit(coords, mapInset())
      else if (coords.length === 1) map.focus(coords[0][0], coords[0][1], mapInset())
    }, 320)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, s.query, visible])

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      if (dialog.state || s.showIntro) return
      const t = e.target
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

      if (e.key === 'Escape') {
        // Escape backs out one level at a time rather than nuking everything
        if (typing && s.query) {
          s.setQuery('')
          t.blur()
        } else if (s.panel) s.closePanel()
        return
      }
      /* `/` only fired when focus was literally on <body>, so it stopped
         working the moment anything had been clicked. Anywhere outside a text
         field is the intent. */
      if (e.key === '/' && !typing) {
        e.preventDefault()
        document.querySelector('.search input')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.panel, s.showIntro, dialog.state, s])

  /* ---------------- handlers ---------------- */

  const handleSelect = (id) => {
    if (s.diyMode) {
      s.addToDraft(id)
      s.openPanel('routes')
      return
    }
    s.openDetail(id)
  }

  const handlePlacePoint = (latlng, longPress) => {
    if (s.addMode || longPress) {
      s.placeNewPoint(latlng)
      return
    }
    if (s.panel === 'detail') s.closePanel()
  }

  const handleFit = () => {
    const coords = visible.map((p) => [p.lat, p.lng])
    if (!coords.length) {
      s.notify('当前没有可见的点位，先打开一个图层', 'warn', 'alert')
      return
    }
    mapRef.current?.fit(coords, mapInset())
  }

  const handleDeletePoint = async (id) => {
    const p = s.getPoint(id)
    const ok = await dialog.confirm({
      kicker: '删除点位',
      title: `删除「${p?.name}」？`,
      body: '这个点位会从地图和所有自建路线里移除。此操作无法撤销，但你可以用「恢复默认数据」拿回原始点位。',
      tone: 'danger',
      confirmLabel: '删除',
    })
    if (ok) s.deletePoint(id)
  }

  const handleDeleteRoute = async (id) => {
    const r = s.getRoute(id)
    const ok = await dialog.confirm({
      kicker: '删除路线',
      title: `删除「${r?.name}」？`,
      body: '只删除这条自建路线，点位本身不受影响。',
      tone: 'danger',
      confirmLabel: '删除',
    })
    if (ok) s.deleteRoute(id)
  }

  const handleSaveDraft = async () => {
    const name = await dialog.prompt({
      kicker: '保存路线',
      title: '给这条路线起个名字',
      label: '路线名称',
      defaultValue: `我的路线 ${s.myRoutes.length + 1}`,
      placeholder: '例如：D6 自由活动',
      confirmLabel: '保存',
    })
    if (name) s.saveDraft(name)
  }

  const handleAddCheck = async (gi) => {
    const text = await dialog.prompt({
      kicker: '备忘清单',
      title: `往「${s.checklist[gi]?.title}」加一条`,
      label: '内容',
      placeholder: '例如：给相机多带一张 SD 卡',
      confirmLabel: '添加',
    })
    if (text) s.addCheckItem(gi, text)
  }

  const handleResetChecklist = async () => {
    const ok = await dialog.confirm({
      kicker: '重置清单',
      title: '重置整份备忘清单？',
      body: '所有勾选状态会清空，你自己加的备忘也会被删除。',
      tone: 'danger',
      confirmLabel: '重置',
    })
    if (ok) s.resetChecklist()
  }

  const handleResetData = async () => {
    const ok = await dialog.confirm({
      kicker: '恢复默认',
      title: '恢复到默认数据？',
      body: '你编辑过的点位、拖动过的位置和自建路线都会清空，换回内置的 49 个点位。建议先「导出备份」。',
      tone: 'danger',
      confirmLabel: '恢复默认',
    })
    if (ok) s.resetData()
  }

  const handleImport = (file) => {
    const rd = new FileReader()
    rd.onload = () => s.importData(String(rd.result))
    rd.onerror = () => s.notify('文件读取失败', 'bad', 'alert')
    rd.readAsText(file)
  }

  /* ---------------- panel content ---------------- */

  let meta = PANEL_META[s.panel]
  let content = null

  if (s.panel === 'detail' && selected) {
    meta = {
      eyebrow: CATS[selected.cat]?.name,
      eyebrowIcon: CATS[selected.cat]?.icon,
      title: selected.name,
    }
    content = (
      <DetailPanel
        point={selected}
        inDraft={s.draftStops.includes(selected.id)}
        moving={s.movingId === selected.id}
        onAddToRoute={(id) => {
          s.addToDraft(id)
          s.openPanel('routes')
        }}
        onEdit={(id) => s.openEdit(id)}
        onDelete={handleDeletePoint}
        onMove={(id) => (s.movingId === id ? s.endMove() : s.startMove(id))}
      />
    )
  } else if (s.panel === 'edit') {
    const editing = s.editingId ? s.getPoint(s.editingId) : null
    meta = {
      eyebrow: editing ? '编辑点位' : '新增点位',
      eyebrowIcon: editing ? 'pencil' : 'pinPlus',
      title: editing ? editing.name : '新的点位',
    }
    content = (
      <EditPanel
        point={editing}
        isNew={!editing}
        onNotify={s.notify}
        onSave={(data) => s.savePoint(s.editingId, data)}
        onCancel={() => (editing ? s.openDetail(editing.id) : s.closePanel())}
      />
    )
  } else if (s.panel === 'routes') {
    content = (
      <RoutesPanel
        myRoutes={s.myRoutes}
        presetRoutes={PRESET_ROUTES}
        activeRouteId={s.activeRouteId}
        activeRoute={activeRoute}
        diyMode={s.diyMode}
        draftStops={s.draftStops}
        getPoint={s.getPoint}
        distanceOf={distanceOf}
        onShowRoute={(id) => {
          s.showRoute(id)
          const rt = s.getRoute(id)
          const coords = routeCoords(useStore.getState(), rt.stops)
          if (coords.length) mapRef.current?.fit(coords, mapInset())
        }}
        onClearRoute={s.clearRoute}
        onDeleteRoute={handleDeleteRoute}
        onStartDiy={s.startDiy}
        onExitDiy={s.exitDiy}
        onRemoveDraft={s.removeFromDraft}
        onSaveDraft={handleSaveDraft}
        onOpenDetail={s.openDetail}
      />
    )
  } else if (s.panel === 'checklist') {
    content = (
      <ChecklistPanel
        groups={s.checklist}
        onToggle={s.toggleCheck}
        onAdd={handleAddCheck}
        onDelete={s.delCheckItem}
        onReset={handleResetChecklist}
      />
    )
  } else if (s.panel === 'menu') {
    content = (
      <MenuPanel
        points={s.points}
        myRoutes={s.myRoutes}
        counts={counts}
        theme={s.theme}
        onTheme={s.setTheme}
        basemap={s.basemap}
        onBasemap={s.setBasemap}
        onExport={s.exportData}
        onImport={handleImport}
        onReset={handleResetData}
        onOpenDetail={s.openDetail}
        onReplayIntro={() => {
          s.closePanel()
          useStore.setState({ showIntro: true })
        }}
      />
    )
  }

  return (
    <div className="app" data-panel={s.panel || undefined}>
      {/* Scoped so a map failure degrades in place — the panels, the checklist
          and the export still work without a basemap. */}
      <ErrorBoundary compact label="地图">
      <MapCanvas
        ref={mapRef}
        points={s.points}
        visibleIds={visibleIds}
        metroOn={s.metroOn}
        basemap={s.basemap}
        routeStops={activeRoute?.stops}
        routeColor={activeRoute?.color}
        draftStops={s.diyMode ? s.draftStops : undefined}
        selectedId={s.selectedId}
        movingId={s.movingId}
        userPos={s.userPos}
        addMode={s.addMode}
        diyMode={s.diyMode}
        onSelect={handleSelect}
        onMovePoint={s.movePoint}
        onMoveEnd={() => s.endMove()}
        onPlacePoint={handlePlacePoint}
        onTileTrouble={() =>
          s.notify('底图加载不太顺，检查一下网络连接', 'warn', 'alert')
        }
      />
      </ErrorBoundary>

      <Ambient />

      <TopBar
        query={s.query}
        onQuery={s.setQuery}
        onMenu={() => s.openPanel('menu')}
        theme={s.theme}
        onTheme={s.cycleTheme}
        resultCount={visible.length}
        filtering={searching}
        results={search.ranked.filter((p) => s.enabled[p.cat]).slice(0, 20)}
        hiddenByLayer={search.hiddenByLayer}
        onEnableHidden={() => s.enableCats([...new Set(search.hiddenByLayer.map((p) => p.cat))])}
        onPick={(id) => {
          const p = s.getPoint(id)
          if (p) mapRef.current?.focus(p.lat, p.lng, desktop ? { right: 420 } : {})
          s.setQuery('')
          s.openDetail(id)
        }}
      >
        <Chips
          counts={counts}
          enabled={s.enabled}
          metroOn={s.metroOn}
          onToggleCat={s.toggleCat}
          onToggleMetro={s.toggleMetro}
          onRoutes={() => s.openPanel('routes')}
          routeActive={!!s.activeRouteId || s.diyMode}
        />
      </TopBar>

      <Dock
        onFit={handleFit}
        onLocate={s.locate}
        locating={s.locating}
        located={!!s.userPos}
        onChecklist={() => s.openPanel('checklist')}
        onRoutes={() => s.openPanel('routes')}
        onAdd={s.armAdd}
        addArmed={s.addMode}
        diyActive={s.diyMode}
        pendingChecks={pendingChecks}
        draftCount={s.draftStops.length}
      />

      <AnimatePresence>
        {s.panel && meta && (
          <Panel
            key="panel"
            eyebrow={meta.eyebrow}
            eyebrowIcon={meta.eyebrowIcon}
            title={meta.title}
            onClose={s.closePanel}
            resetKey={`${s.panel}:${s.selectedId || ''}`}
            initialDetent={meta.detent || 'half'}
          >
            {/* The glass pane is the shared element across views, so only the
                contents change. Keyed remount + fade-in, deliberately NOT
                AnimatePresence mode="wait": gating the swap on an exit
                animation would delay every panel switch, and would strand the
                old view on screen if the animation never ran. */}
            <motion.div
              key={`${s.panel}:${s.selectedId || ''}:${s.editingId || ''}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={T.card}
            >
              {content}
            </motion.div>
          </Panel>
        )}
      </AnimatePresence>

      <Toast toast={s.toast} onDismiss={s.dismissToast} />
      <Onboarding open={s.showIntro} onClose={s.dismissIntro} />
      <Dialog dialog={dialog} />
    </div>
  )
}
