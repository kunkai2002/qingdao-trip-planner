import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/useStore.js'
import { runSearch } from './lib/search.js'
import { CATS, CAT_ORDER } from './data/categories.js'
import { DEFAULT_STAY, clockToMinutes, formatDate } from './data/trip.js'
import { buildTimeline } from './lib/transit.js'
import { initGlassPointer } from './lib/glassPointer.js'
import { useInstallPrompt, requestPersistentStorage } from './lib/install.js'
import { useIsDesktop } from './lib/useMediaQuery.js'
import { T } from './lib/motion.js'

import { MapCanvas } from './map/MapCanvas.jsx'
import { Ambient } from './components/Ambient.jsx'
import { Panel } from './components/Panel.jsx'
import { Toast } from './components/Toast.jsx'
import { ModeStrip } from './components/ModeStrip.jsx'
import { Onboarding } from './components/Onboarding.jsx'
import { Dialog, useDialog } from './components/Dialog.jsx'
import { Modal } from './components/Modal.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { GlassButton } from './components/Glass.jsx'
import { Icon } from './icons/Icon.jsx'

import { Rail, TabBar } from './components/work/Rail.jsx'
import { ItineraryView } from './components/work/ItineraryView.jsx'
import { PlaceDetailView } from './components/work/PlaceDetailView.jsx'

/* Only 行程 and the map are needed for the first screen — everything else is
   behind a deliberate tap, so it loads when first opened. */
const ExploreView = lazy(() =>
  import('./components/work/ExploreView.jsx').then((m) => ({ default: m.ExploreView })),
)
const OverviewView = lazy(() =>
  import('./components/work/OverviewView.jsx').then((m) => ({ default: m.OverviewView })),
)
const SavedView = lazy(() =>
  import('./components/work/SavedView.jsx').then((m) => ({ default: m.SavedView })),
)
const ChecklistView = lazy(() =>
  import('./components/work/ChecklistView.jsx').then((m) => ({ default: m.ChecklistView })),
)
const SettingsView = lazy(() =>
  import('./components/work/SettingsView.jsx').then((m) => ({ default: m.SettingsView })),
)
const EditPanel = lazy(() =>
  import('./components/panels/EditPanel.jsx').then((m) => ({ default: m.EditPanel })),
)

function ViewSkeleton() {
  return (
    <div style={{ padding: 'var(--sp-4)', display: 'grid', gap: 10 }}>
      <span className="wskel" style={{ height: 22, width: '46%' }} />
      <span className="wskel" style={{ height: 88 }} />
      <span className="wskel" style={{ height: 88 }} />
    </div>
  )
}

export default function App() {
  const s = useStore()
  const dialog = useDialog()
  const mapRef = useRef(null)
  const desktop = useIsDesktop()

  const install = useInstallPrompt()
  const [storageState, setStorageState] = useState(null)
  const [railMini, setRailMini] = useState(false)
  const [showLayers, setShowLayers] = useState(false)

  /* ---------------- boot ---------------- */
  useEffect(() => {
    s.init()
    requestPersistentStorage().then(setStorageState)
    return initGlassPointer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (s.theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', s.theme)
  }, [s.theme])

  /* ---------------- derived ---------------- */

  /* `map` is a phone tab, not a desktop section — on a wide screen the map is
     simply always there, so landing on it after a resize would show an empty
     workspace beside a map that was already visible. */
  const view = desktop && s.view === 'map' ? 'itinerary' : s.view
  const mobileMap = !desktop && s.view === 'map'

  const search = useMemo(() => runSearch(s), [s.points, s.enabled, s.query])
  const visibleIds = useMemo(() => new Set(search.shown.map((p) => p.id)), [search.shown])

  const day = s.activeDay()
  const dayStops = useMemo(() => day?.items.map((it) => it.pointId) || [], [day])

  const timeline = useMemo(
    () =>
      day
        ? buildTimeline(day.items, s.getPoint, {
            startMinutes: clockToMinutes(day.startTime) ?? 540,
            defaultStay: DEFAULT_STAY,
          })
        : null,
    [day, s.points],
  )

  const pendingChecks = useMemo(
    () => s.checklist.reduce((n, g) => n + g.items.filter((i) => !i.done).length, 0),
    [s.checklist],
  )

  const selected = s.selectedId ? s.getPoint(s.selectedId) : null
  /* On a phone, a detail opened from the map belongs in the sheet so the pin
     stays visible; opened from a list, it belongs in that list's column. */
  const detailInSheet = !desktop && mobileMap && !!selected
  const detailInWork = !!selected && !detailInSheet

  /* How much of the map is covered right now, so the camera frames into what is
     actually visible. The workspace is a real grid column on desktop, so it
     costs the camera nothing — only the phone sheet does. */
  const mapInset = useCallback(() => {
    if (desktop) return {}
    if (!detailInSheet) return {}
    const h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-h'), 10)
    return { bottom: Number.isFinite(h) ? h : 0 }
  }, [desktop, detailInSheet])

  /* ---------------- the map column changes size ----------------
     Leaflet caches its container size. Folding the workspace away, collapsing
     the rail or switching phone tabs all resize the map column without a window
     resize event, and without this the map renders into the old rectangle. */
  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.invalidate())
    return () => cancelAnimationFrame(id)
  }, [desktop, railMini, mobileMap, s.view])

  /* ---------------- map follows selection ---------------- */
  useEffect(() => {
    if (!selected) return
    if (import.meta.env.DEV) window.__mapApi = mapRef.current
    mapRef.current?.focus(selected.lat, selected.lng, mapInset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.selectedId])

  useEffect(() => {
    if (!s.userPos) return
    mapRef.current?.focus(s.userPos.lat, s.userPos.lng, mapInset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.userPos])

  /* Switching day reframes the map onto that day, which is the whole point of
     the day tabs — otherwise D3 selects and the map keeps showing D1. */
  const lastDayRef = useRef(null)
  useEffect(() => {
    if (!day || lastDayRef.current === day.id) return
    lastDayRef.current = day.id
    const coords = day.items
      .map((it) => s.getPoint(it.pointId))
      .filter(Boolean)
      .map((p) => [p.lat, p.lng])
    if (coords.length > 1) mapRef.current?.fit(coords, mapInset())
    else if (coords.length === 1) mapRef.current?.focus(coords[0][0], coords[0][1], mapInset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.id])

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      if (dialog.state || s.showIntro) return
      const t = e.target
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

      /* Ctrl/Cmd+Z undoes the last reorder, removal or optimisation — the three
         things that rearrange work the user did by hand. */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        s.undo()
        return
      }
      if (e.key === 'Escape') {
        if (typing && s.query) {
          s.setQuery('')
          t.blur()
        } else if (s.panel === 'edit') requestClose()
        else if (s.selectedId) s.closePanel()
        return
      }
      if (e.key === '/' && !typing) {
        e.preventDefault()
        const box = document.querySelector('.work__head input, .mapsearch input')
        if (box) box.focus()
        else {
          s.setView('explore')
          setTimeout(() => document.querySelector('.work__head input')?.focus(), 60)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.panel, s.selectedId, s.showIntro, s.query, dialog.state])

  /* ---------------- handlers ---------------- */

  const editDirtyRef = useRef(false)
  const requestClose = useCallback(async () => {
    if (s.panel === 'edit' && editDirtyRef.current) {
      const ok = await dialog.confirm({
        kicker: '未保存的修改',
        title: '放弃这次编辑？',
        body: '你改动的内容还没有保存，关闭后会丢失。',
        tone: 'danger',
        confirmLabel: '放弃修改',
        cancelLabel: '继续编辑',
      })
      if (!ok) return
      editDirtyRef.current = false
    }
    s.closePanel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.panel, dialog])

  /* Clicking a pin is the map half of the two-way link: it selects the place,
     switches to the day that place is on, and asks the list to scroll to it. */
  const handleSelect = (id) => {
    /* Order matters: setView clears the selection, so the view has to settle
       before the detail opens, not after. */
    if (!desktop && s.view !== 'map') s.setView('itinerary')
    if (s.isScheduled(id)) s.reveal(id)
    s.openDetail(id)
  }

  const handlePlacePoint = (latlng, longPress) => {
    if (s.addMode || longPress) {
      s.placeNewPoint(latlng)
      return
    }
    if (s.selectedId) s.closePanel()
  }

  const handleFitDay = () => {
    const coords = (day?.items || [])
      .map((it) => s.getPoint(it.pointId))
      .filter(Boolean)
      .map((p) => [p.lat, p.lng])
    if (coords.length > 1) return mapRef.current?.fit(coords, mapInset())
    const all = search.shown.map((p) => [p.lat, p.lng])
    if (all.length) mapRef.current?.fit(all, mapInset())
    else s.notify('这一天还没有地点，先去添加一个', 'warn', 'alert')
  }

  const handleResetData = async () => {
    const ok = await dialog.confirm({
      kicker: '恢复默认',
      title: '恢复到默认数据？',
      body: '你编辑过的地点、拖动过的位置、排好的行程和收藏都会清空，换回内置的 49 个地点和默认五天安排。建议先「导出备份」。',
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

  /* ---------------- what the workspace shows ---------------- */

  let workNode
  if (detailInWork) {
    workNode = <PlaceDetailView point={selected} dialog={dialog} />
  } else if (view === 'itinerary' || view === 'map') {
    workNode = <ItineraryView dialog={dialog} desktop={desktop} />
  } else if (view === 'explore') {
    workNode = <ExploreView />
  } else if (view === 'overview') {
    workNode = <OverviewView />
  } else if (view === 'saved') {
    workNode = <SavedView />
  } else if (view === 'checklist') {
    workNode = <ChecklistView dialog={dialog} />
  } else if (view === 'settings') {
    workNode = (
      <SettingsView
        dialog={dialog}
        desktop={desktop}
        install={install}
        storage={storageState}
        onImport={handleImport}
        onResetData={handleResetData}
        onInstall={async () => {
          const outcome = await install.install()
          if (outcome === 'accepted') {
            setStorageState(await requestPersistentStorage())
            s.notify('已安装到手机，行程数据也更安全了', 'good', 'checkCircle')
          }
        }}
      />
    )
  }

  const editing = s.panel === 'edit' ? (s.editingId ? s.getPoint(s.editingId) : null) : undefined

  return (
    <div
      className="shell"
      data-rail={railMini ? 'mini' : undefined}
      data-mobile={desktop ? undefined : mobileMap ? 'map' : 'page'}
    >
      {desktop && (
        <Rail
          view={view}
          onView={s.setView}
          pendingChecks={pendingChecks}
          mini={railMini}
          onToggleMini={() => setRailMini((v) => !v)}
          theme={s.theme}
          onTheme={s.cycleTheme}
        />
      )}

      <div className="work">
        <ErrorBoundary compact label="工作区">
          <Suspense fallback={<ViewSkeleton />}>
            <motion.div
              key={detailInWork ? `detail:${s.selectedId}` : view}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={T.card}
              style={{ display: 'contents' }}
            >
              {workNode}
            </motion.div>
          </Suspense>
        </ErrorBoundary>
      </div>

      <div className="shell__map">
        <ErrorBoundary compact label="地图">
          <MapCanvas
            ref={mapRef}
            points={s.points}
            visibleIds={visibleIds}
            metroOn={s.metroOn}
            basemap={s.basemap}
            routeStops={dayStops}
            routeColor={day?.color}
            selectedId={s.selectedId}
            hoverId={s.hoverPointId}
            movingId={s.movingId}
            userPos={s.userPos}
            addMode={s.addMode}
            onSelect={handleSelect}
            onMovePoint={s.movePoint}
            onMoveEnd={() => s.endMove()}
            onPlacePoint={handlePlacePoint}
            onTileTrouble={(bad) =>
              bad
                ? s.notify('底图加载不上，检查网络。地点和行程仍可正常使用', 'warn', 'alert')
                : s.notify('底图已恢复', 'good', 'checkCircle')
            }
          />
        </ErrorBoundary>

        <Ambient />

        {/* Three controls, all about the map itself. Nothing that belongs to
            the itinerary lives out here any more. */}
        <div className="mapctl">
          <GlassButton onClick={s.locate} title="我的位置" aria-label="定位到我的位置">
            <Icon name={s.locating ? 'spinner' : 'target'} size={18} className={s.locating ? 'spin' : ''} />
          </GlassButton>
          <GlassButton onClick={handleFitDay} title="适配当天路线" aria-label="适配当天路线">
            <Icon name="routePath" size={18} />
          </GlassButton>
          <GlassButton
            onClick={() => setShowLayers((v) => !v)}
            title="图层"
            aria-label="图层"
            aria-expanded={showLayers}
          >
            <Icon name="layers" size={18} />
          </GlassButton>
          <AnimatePresence>
            {showLayers && (
              <motion.div
                className="glass maplayers"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={T.card}
              >
                {CAT_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="maplayers__row"
                    aria-pressed={!!s.enabled[k]}
                    onClick={() => s.toggleCat(k)}
                  >
                    <Icon name={CATS[k].icon} size={15} />
                    {CATS[k].name}
                    <Icon name={s.enabled[k] ? 'eye' : 'eyeOff'} size={14} />
                  </button>
                ))}
                <button
                  type="button"
                  className="maplayers__row"
                  aria-pressed={s.metroOn}
                  onClick={s.toggleMetro}
                >
                  <Icon name="train" size={15} />
                  地铁线
                  <Icon name={s.metroOn ? 'eye' : 'eyeOff'} size={14} />
                </button>
                <button
                  type="button"
                  className="maplayers__row"
                  onClick={() => s.setBasemap(s.basemap === 'road' ? 'satellite' : 'road')}
                >
                  <Icon name="layers" size={15} />
                  {s.basemap === 'road' ? '切到卫星图' : '切到街道图'}
                  <Icon name="chevronRight" size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Which colour is which day. Without it the numbered pins are just
            coloured dots. */}
        {s.days.length > 1 && (
          <div className="glass maplegend">
            {s.days.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className="maplegend__i"
                data-off={d.id === day?.id ? undefined : '1'}
                style={{ '--day-c': d.color, border: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
                onClick={() => {
                  s.setActiveDay(d.id)
                  if (!desktop) s.setView('map')
                }}
              >
                <i className="maplegend__sw" />
                D{i + 1}
                <span style={{ opacity: 0.7 }}>{formatDate(d.date).md}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!desktop && <TabBar view={s.view} onView={s.setView} pendingChecks={pendingChecks} />}

      {/* One primary action on phones, anchored above the tab bar. */}
      {!desktop && !mobileMap && (view === 'itinerary' || view === 'explore') && !detailInWork && (
        <div className="fabbar">
          {view === 'itinerary' ? (
            <button type="button" className="wbtn wbtn--primary" onClick={() => s.setView('explore')}>
              <Icon name="plus" size={17} />
              添加地点
            </button>
          ) : (
            <button type="button" className="wbtn wbtn--primary" onClick={() => s.setView('itinerary')}>
              <Icon name="calendar" size={17} />
              回到行程
              {timeline ? `（${day?.items.length} 个）` : ''}
            </button>
          )}
        </div>
      )}

      {/* Phone: the detail opened from the map, as a sheet over it. */}
      <AnimatePresence>
        {detailInSheet && (
          <Panel
            key="sheet"
            solid
            eyebrow={CATS[selected.cat]?.name}
            eyebrowIcon={CATS[selected.cat]?.icon}
            title={selected.name}
            onClose={s.closePanel}
            resetKey={selected.id}
            initialDetent="half"
          >
            <PlaceDetailView point={selected} dialog={dialog} embedded />
          </Panel>
        )}
      </AnimatePresence>

      {/* Editing a place is a focused, temporary job — a modal, not a column. */}
      <Modal open={s.panel === 'edit'} onClose={requestClose} labelledBy="editttl">
        <h2 id="editttl" className="modal__title">
          {editing ? `编辑「${editing.name}」` : '新增地点'}
        </h2>
        <Suspense fallback={<ViewSkeleton />}>
          {s.panel === 'edit' && (
            <EditPanel
              point={editing}
              isNew={!editing}
              onNotify={s.notify}
              onDirtyChange={(d) => (editDirtyRef.current = d)}
              onSave={(data) => {
                editDirtyRef.current = false
                s.savePoint(s.editingId, data)
              }}
              onCancel={() => {
                if (editDirtyRef.current) requestClose()
                else if (editing) s.openDetail(editing.id)
                else s.closePanel()
              }}
            />
          )}
        </Suspense>
      </Modal>

      <ModeStrip
        addMode={s.addMode}
        movingName={s.movingId ? s.getPoint(s.movingId)?.name : null}
        onExit={() => {
          if (s.addMode) s.armAdd()
          else if (s.movingId) s.endMove()
        }}
      />

      <Toast toast={s.toast} onDismiss={s.dismissToast} />
      <Onboarding open={s.showIntro} onClose={s.dismissIntro} />
      <Dialog dialog={dialog} />
    </div>
  )
}
