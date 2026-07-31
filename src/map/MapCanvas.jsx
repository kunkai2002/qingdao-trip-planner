import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { makePinIcon, makeClusterIcon } from './pinIcon.js'
import { METRO_LINES } from '../data/metro.js'
import { wgs2gcj } from '../lib/geo.js'

const TILES = {
  road: {
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    subdomains: ['1', '2', '3', '4'],
  },
  satellite: {
    url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    subdomains: ['1', '2', '3', '4'],
  },
}

/* Clustering: bucket points into a pixel grid at the current zoom. A grid is
   enough here (a few dozen points) and, unlike leaflet.markercluster, it keeps
   marker ownership in this component so the existing reconcile-by-id and
   icon-state logic stays intact. Above CLUSTER_MAX_ZOOM everything is far
   enough apart to show individually. */
const CLUSTER_CELL = 52
const CLUSTER_MAX_ZOOM = 15

/**
 * Bounds of the dense core, ignoring outliers.
 *
 * Fitting ALL points is wrong for the opening view: 崂山 (120.68), 金沙滩
 * (120.256) and 青岛北站 stretch the box so wide that the city collapses to a
 * speck and half the screen becomes sea. An 8th–92nd percentile band was still
 * too wide — measured zoom 11.5 on a 375px portrait phone, which is most of
 * Jiaozhou Bay. The interquartile band lands on 老城 + 五四广场, where the trip
 * actually happens. The "复位" button still fits everything, because that is an
 * explicit request to see the lot.
 */
function coreBounds(coords) {
  if (coords.length < 5) return L.latLngBounds(coords)
  const lats = coords.map((c) => c[0]).sort((a, b) => a - b)
  const lngs = coords.map((c) => c[1]).sort((a, b) => a - b)
  const q = (arr, p) => arr[Math.max(0, Math.min(arr.length - 1, Math.round((arr.length - 1) * p)))]
  return L.latLngBounds([q(lats, 0.25), q(lngs, 0.25)], [q(lats, 0.75), q(lngs, 0.75)])
}

/**
 * MapCanvas owns the Leaflet instance imperatively. React drives *what* is on
 * the map through props; Leaflet keeps owning the DOM inside #map. Markers are
 * reconciled by id so panning never rebuilds the layer.
 */
export const MapCanvas = forwardRef(function MapCanvas(
  {
    points,
    visibleIds,
    metroOn,
    basemap = 'road',
    routeStops,
    routeColor,
    draftStops,
    selectedId,
    movingId,
    userPos,
    addMode,
    diyMode,
    onSelect,
    onMovePoint,
    onMoveEnd,
    onPlacePoint,
    onTileTrouble,
  },
  ref,
) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  const markersRef = useRef(new Map())
  const clusterLayerRef = useRef(null)
  const userLayerRef = useRef(null)
  const zoomTickRef = useRef(0)
  const didFitRef = useRef(false)
  const linesRef = useRef({ metro: null, route: null, routeHalo: null, draft: null })
  const cbRef = useRef({})
  const [clusterTick, setClusterTick] = useState(0)

  // Handlers change every render; keep Leaflet bound to a stable box.
  cbRef.current = { onSelect, onMovePoint, onMoveEnd, onPlacePoint, onTileTrouble }
  const modeRef = useRef({})
  modeRef.current = { addMode, diyMode }

  /* ---------------- create once ---------------- */
  useEffect(() => {
    const map = L.map(hostRef.current, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.5,
      wheelPxPerZoomLevel: 110,
      // needed so Android/touch long-press raises `contextmenu` too
      tapHold: true,
    }).setView(wgs2gcj(36.062, 120.384), 13)
    mapRef.current = map
    if (import.meta.env.DEV) window.__map = map

    const metro = L.layerGroup().addTo(map)
    linesRef.current.metro = metro
    METRO_LINES.forEach((line) => {
      const pts = line.pts.map(([lat, lng]) => wgs2gcj(lat, lng))
      L.polyline(pts, {
        color: line.color,
        weight: 4,
        opacity: 0.6,
        dashArray: '2 8',
        lineCap: 'round',
        className: 'metro-line',
        interactive: false,
      }).addTo(metro)
    })

    const clusters = L.layerGroup().addTo(map)
    clusterLayerRef.current = clusters
    userLayerRef.current = L.layerGroup().addTo(map)

    const root = document.documentElement
    const onMoveStart = () => root.setAttribute('data-map-moving', '1')
    const onMoveEnd = () => root.removeAttribute('data-map-moving')
    map.on('movestart zoomstart', onMoveStart)
    map.on('moveend zoomend', onMoveEnd)
    // recluster once the view settles
    map.on('zoomend moveend', () => setClusterTick((n) => n + 1))

    /* Long-press on empty map drops a new point there.
       This used to be a 520ms timer armed on Leaflet's `mousedown`. That is
       dead on touch: Leaflet binds only DOM mouse events to the container, and
       the compat mousedown/mouseup pair is dispatched back-to-back after
       touchend, so the timer could never elapse — on the one form factor where
       long-press is the natural gesture. `contextmenu` is the single event that
       covers desktop right-click, iOS TapHold and Android native long-press,
       and Leaflet preventDefaults it so no OS menu appears. */
    map.on('contextmenu', (e) => {
      const el = e.originalEvent?.target
      if (el instanceof Element && el.closest('.leaflet-marker-icon')) return
      cbRef.current.onPlacePoint?.(e.latlng, true)
    })

    map.on('click', (e) => cbRef.current.onPlacePoint?.(e.latlng, false))

    let tileErrors = 0
    const onTileError = () => {
      tileErrors += 1
      if (tileErrors === 8) cbRef.current.onTileTrouble?.()
    }
    map.on('tileerror', onTileError)

    return () => {
      map.off()
      onMoveEnd()
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  /* ---------------- basemap ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const spec = TILES[basemap] || TILES.road
    const layer = L.tileLayer(spec.url, {
      subdomains: spec.subdomains,
      maxZoom: 19,
      minZoom: 8,
      keepBuffer: 3,
      updateWhenIdle: false,
    })
    layer.addTo(map)
    layer.bringToBack()
    const prev = tileRef.current
    tileRef.current = layer
    // Swap after the new layer has had a chance to paint, so no grey flash.
    const t = setTimeout(() => prev && map.removeLayer(prev), 320)
    return () => clearTimeout(t)
  }, [basemap])

  /* ---------------- markers: create / remove ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const live = markersRef.current
    const seen = new Set()

    points.forEach((p) => {
      seen.add(p.id)
      let m = live.get(p.id)
      if (!m) {
        // draggable:false by design — dragging a marker must never steal a map pan.
        // Dragging is enabled for one armed marker only, in the effect below.
        m = L.marker([p.lat, p.lng], { icon: makePinIcon(p), draggable: false, riseOnHover: true })
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          /* With add-mode armed, a pin's 44x44 hit disc used to swallow the tap
             and open its detail instead of placing the new point — add-mode was
             never consulted and never cleared. Dense areas are exactly where
             you want to add something. */
          if (modeRef.current.addMode) {
            cbRef.current.onPlacePoint?.(e.latlng ?? m.getLatLng(), false)
            return
          }
          cbRef.current.onSelect?.(p.id)
        })
        m.on('dragstart', () => {
          if (m._icon) m._icon.style.zIndex = 999
        })
        m.on('dragend', (e) => {
          const ll = e.target.getLatLng()
          cbRef.current.onMovePoint?.(p.id, ll.lat, ll.lng)
          cbRef.current.onMoveEnd?.(p.id)
        })
        live.set(p.id, m)
      } else {
        const ll = m.getLatLng()
        if (Math.abs(ll.lat - p.lat) > 1e-9 || Math.abs(ll.lng - p.lng) > 1e-9) {
          m.setLatLng([p.lat, p.lng])
        }
      }
    })

    live.forEach((m, id) => {
      if (!seen.has(id)) {
        map.removeLayer(m)
        live.delete(id)
      }
    })
  }, [points])

  /* ---------------- markers: clustering, visibility, icon state ---------------- */
  useEffect(() => {
    const map = mapRef.current
    const clusters = clusterLayerRef.current
    if (!map || !clusters) return

    const routeIndex = new Map((routeStops || []).map((id, i) => [id, i + 1]))
    const draftIndex = new Map((draftStops || []).map((id, i) => [id, i + 1]))
    const hasRoute = routeIndex.size > 0 || draftIndex.size > 0
    const zoom = map.getZoom()

    /* Points on a shown route, being moved, or currently selected are never
       folded into a bubble — hiding the thing the user just clicked would be
       actively confusing. */
    const mustShow = (id) =>
      routeIndex.has(id) || draftIndex.has(id) || id === selectedId || id === movingId

    const visible = points.filter((p) => visibleIds.has(p.id))
    const solo = []
    const buckets = new Map()

    if (zoom > CLUSTER_MAX_ZOOM) {
      solo.push(...visible)
    } else {
      visible.forEach((p) => {
        if (mustShow(p.id)) {
          solo.push(p)
          return
        }
        const pt = map.project([p.lat, p.lng], zoom)
        const key = `${Math.floor(pt.x / CLUSTER_CELL)}:${Math.floor(pt.y / CLUSTER_CELL)}`
        const b = buckets.get(key)
        if (b) b.push(p)
        else buckets.set(key, [p])
      })
      buckets.forEach((group) => {
        if (group.length === 1) solo.push(group[0])
      })
    }

    const soloIds = new Set(solo.map((p) => p.id))

    /* Fan out pins that land on the same pixel, so none is unreachable. */
    const nudges = new Map()
    const cell = new Map()
    solo.forEach((p) => {
      const pt = map.project([p.lat, p.lng], zoom)
      const key = `${Math.round(pt.x / 14)}:${Math.round(pt.y / 14)}`
      const group = cell.get(key)
      if (group) group.push(p.id)
      else cell.set(key, [p.id])
    })
    cell.forEach((group) => {
      if (group.length < 2) return
      const r = 13 + group.length
      group.forEach((id, i) => {
        const a = (i / group.length) * Math.PI * 2 - Math.PI / 2
        nudges.set(id, [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.7)])
      })
    })

    // individual markers
    points.forEach((p) => {
      const m = markersRef.current.get(p.id)
      if (!m) return
      const show = soloIds.has(p.id)
      if (show && !map.hasLayer(m)) m.addTo(map)
      if (!show && map.hasLayer(m)) map.removeLayer(m)
      if (!show) return
      const seq = draftIndex.get(p.id) || routeIndex.get(p.id) || 0
      const nudge = nudges.get(p.id)
      /* Rebuilding the icon re-parses the whole pin subtree including its SVG
         and restarts every CSS animation on it — the selected pin's pulse and
         the armed pin's lift were resetting on every pan and every keystroke.
         Only rebuild when the rendered state actually changed. */
      const key = [
        seq,
        selectedId === p.id ? 1 : 0,
        seq > 0 ? 1 : 0,
        hasRoute && seq === 0 ? 1 : 0,
        movingId === p.id ? 1 : 0,
        nudge ? nudge.join(',') : '',
      ].join('|')
      if (m._iconKey === key) return
      m._iconKey = key
      m.setIcon(
        makePinIcon(p, {
          seq,
          selected: selectedId === p.id,
          inRoute: seq > 0,
          dim: hasRoute && seq === 0,
          moving: movingId === p.id,
          nudge,
        }),
      )
    })

    // cluster bubbles
    clusters.clearLayers()
    buckets.forEach((group) => {
      if (group.length < 2) return
      const lat = group.reduce((s, p) => s + p.lat, 0) / group.length
      const lng = group.reduce((s, p) => s + p.lng, 0) / group.length
      const cats = [...new Set(group.map((p) => p.cat))]
      const marker = L.marker([lat, lng], {
        icon: makeClusterIcon(group.length, cats),
        zIndexOffset: -200,
      })
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        const bounds = L.latLngBounds(group.map((p) => [p.lat, p.lng]))
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          // every point in the bubble shares one coordinate — just zoom in
          map.setView(bounds.getCenter(), Math.min(map.getZoom() + 3, 18), { animate: true })
        } else {
          map.fitBounds(bounds.pad(0.5), { animate: true, maxZoom: 17 })
        }
      })
      marker.addTo(clusters)
    })
  }, [points, visibleIds, routeStops, draftStops, selectedId, movingId, clusterTick])

  /* ---------------- exactly one marker may be dragged ---------------- */
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      if (!m.dragging) return
      if (id === movingId) m.dragging.enable()
      else m.dragging.disable()
    })
  }, [movingId, points])

  /* ---------------- opening view: frame the points, not the sea ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || didFitRef.current) return
    const coords = points.filter((p) => visibleIds.has(p.id)).map((p) => [p.lat, p.lng])
    if (coords.length < 3) return
    didFitRef.current = true
    map.fitBounds(coreBounds(coords), {
      paddingTopLeft: [26, 128],
      paddingBottomRight: [26, 96],
      animate: false,
    })
    setClusterTick((n) => n + 1)
  }, [points, visibleIds])

  /* ---------------- the user's own position ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = userLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!userPos) return
    if (userPos.accuracy > 0) {
      L.circle([userPos.lat, userPos.lng], {
        radius: userPos.accuracy,
        className: 'userpos__halo',
        interactive: false,
        stroke: false,
      }).addTo(layer)
    }
    L.marker([userPos.lat, userPos.lng], {
      icon: L.divIcon({ className: 'userpos-wrap', html: '<span class="userpos"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      interactive: false,
      zIndexOffset: 800,
    }).addTo(layer)
  }, [userPos])

  /* ---------------- metro visibility ---------------- */
  useEffect(() => {
    const map = mapRef.current
    const metro = linesRef.current.metro
    if (!map || !metro) return
    if (metroOn && !map.hasLayer(metro)) metro.addTo(map)
    if (!metroOn && map.hasLayer(metro)) map.removeLayer(metro)
  }, [metroOn])

  /* ---------------- route + draft polylines ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const lines = linesRef.current

    const draw = (key, stops, color, flow) => {
      if (lines[key]) {
        map.removeLayer(lines[key])
        lines[key] = null
      }
      const coords = (stops || [])
        .map((id) => points.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => [p.lat, p.lng])
      if (coords.length < 2) return
      lines[key] = L.polyline(coords, {
        color,
        weight: flow ? 4 : 9,
        opacity: flow ? 0.95 : 0.2,
        lineCap: 'round',
        lineJoin: 'round',
        className: flow ? 'route-line route-line--flow' : 'route-line--halo',
        interactive: false,
      }).addTo(map)
    }

    // halo underneath, animated dashes on top
    draw('routeHalo', routeStops, routeColor || '#0c6b78', false)
    draw('route', routeStops, routeColor || '#0c6b78', true)
    draw('draft', draftStops, '#b0561f', true)

    return () => {
      ;['route', 'routeHalo', 'draft'].forEach((k) => {
        if (lines[k]) {
          map.removeLayer(lines[k])
          lines[k] = null
        }
      })
    }
  }, [points, routeStops, routeColor, draftStops])

  /* ---------------- cursor affordance ---------------- */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.style.cursor = addMode ? 'crosshair' : diyMode ? 'copy' : ''
  }, [addMode, diyMode])

  /* ---------------- imperative API ---------------- */
  /* Both camera helpers take the same inset object describing how much of the
     viewport is currently covered by chrome (top bar, right rail, bottom
     sheet), so they always frame into the rect the user can actually see. */
  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(1),
    zoomOut: () => mapRef.current?.zoomOut(1),
    /* Used to make searching a non-destructive excursion: the view is
       snapshotted on the first keystroke and put back when the query clears. */
    getView() {
      const map = mapRef.current
      return map ? { center: map.getCenter(), zoom: map.getZoom() } : null
    },
    restoreView(v) {
      const map = mapRef.current
      if (map && v) map.setView(v.center, v.zoom, { animate: false })
    },
    fit(coords, inset = {}) {
      const map = mapRef.current
      if (!map || !coords?.length) return
      const { top = 0, right = 0, bottom = 0, left = 0 } = inset
      map.fitBounds(L.latLngBounds(coords), {
        paddingTopLeft: [24 + left, 130 + top],
        paddingBottomRight: [24 + right, 96 + bottom],
        animate: true,
        duration: 0.6,
        easeLinearity: 0.24,
      })
    },
    /* ADD, not subtract. Centring on point-minus-offset puts the point on the
       covered side — it used to pan the selected pin straight under the panel
       that had just opened over it. Centring on point-plus-offset pushes it
       into the visible half. */
    focus(lat, lng, inset = {}) {
      const map = mapRef.current
      if (!map) return
      const { right = 0, bottom = 0, top = 0, left = 0 } = inset
      const z = map.getZoom()
      const dest = map.unproject(
        map.project([lat, lng], z).add([(right - left) / 2, (bottom - top) / 2]),
        z,
      )
      /* Decide the animation explicitly. Leaflet quietly declines to animate a
         pan longer than roughly one viewport, and the request is then dropped
         rather than applied — which showed up as selecting a far-away point
         (崂山, 金沙滩) simply not moving the map at all. */
      const offset = map
        .latLngToContainerPoint(dest)
        .subtract(map.latLngToContainerPoint(map.getCenter()))
      const size = map.getSize()
      const near = Math.abs(offset.x) <= size.x * 0.8 && Math.abs(offset.y) <= size.y * 0.8
      /* setView, never panTo: panTo drops the request outright when it decides
         the distance is too long or another pan is still settling, so selecting
         a distant point silently did nothing. setView always applies the view
         and merely decides whether to animate getting there. */
      map.setView(dest, z, { animate: near, duration: 0.45 })
    },
  }))

  return <div className="map" ref={hostRef} role="application" aria-label="青岛行程地图" />
})
