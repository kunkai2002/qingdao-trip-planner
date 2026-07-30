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

const LONG_PRESS_MS = 520

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
 * speck and half the screen becomes sea. Trimming to the 8th–92nd percentile
 * frames where the points actually are. The "复位" button still fits
 * everything, because that is an explicit request to see the lot.
 */
function coreBounds(coords) {
  if (coords.length < 5) return L.latLngBounds(coords)
  const lats = coords.map((c) => c[0]).sort((a, b) => a - b)
  const lngs = coords.map((c) => c[1]).sort((a, b) => a - b)
  const q = (arr, p) => arr[Math.max(0, Math.min(arr.length - 1, Math.round((arr.length - 1) * p)))]
  return L.latLngBounds([q(lats, 0.08), q(lngs, 0.08)], [q(lats, 0.92), q(lngs, 0.92)])
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
  const zoomTickRef = useRef(0)
  const didFitRef = useRef(false)
  const linesRef = useRef({ metro: null, route: null, routeHalo: null, draft: null })
  const cbRef = useRef({})
  const [clusterTick, setClusterTick] = useState(0)

  // Handlers change every render; keep Leaflet bound to a stable box.
  cbRef.current = { onSelect, onMovePoint, onMoveEnd, onPlacePoint, onTileTrouble }

  /* ---------------- create once ---------------- */
  useEffect(() => {
    const map = L.map(hostRef.current, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.5,
      wheelPxPerZoomLevel: 110,
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

    const root = document.documentElement
    const onMoveStart = () => root.setAttribute('data-map-moving', '1')
    const onMoveEnd = () => root.removeAttribute('data-map-moving')
    map.on('movestart zoomstart', onMoveStart)
    map.on('moveend zoomend', onMoveEnd)
    // recluster once the view settles
    map.on('zoomend moveend', () => setClusterTick((n) => n + 1))

    /* Long-press on empty map drops a new point there. Leaflet still emits a
       click on release, so swallow the next one once the press has fired. */
    let pressTimer = 0
    let pressLatLng = null
    let swallowClick = false
    const clearPress = () => {
      if (pressTimer) clearTimeout(pressTimer)
      pressTimer = 0
      pressLatLng = null
    }
    map.on('mousedown', (e) => {
      clearPress()
      swallowClick = false
      pressLatLng = e.latlng
      pressTimer = window.setTimeout(() => {
        pressTimer = 0
        if (!pressLatLng) return
        swallowClick = true
        cbRef.current.onPlacePoint?.(pressLatLng, true)
      }, LONG_PRESS_MS)
    })
    map.on('mouseup movestart zoomstart dragstart', clearPress)

    map.on('click', (e) => {
      if (swallowClick) {
        swallowClick = false
        return
      }
      cbRef.current.onPlacePoint?.(e.latlng, false)
    })

    let tileErrors = 0
    const onTileError = () => {
      tileErrors += 1
      if (tileErrors === 8) cbRef.current.onTileTrouble?.()
    }
    map.on('tileerror', onTileError)

    return () => {
      map.off()
      clearPress()
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

    // individual markers
    points.forEach((p) => {
      const m = markersRef.current.get(p.id)
      if (!m) return
      const show = soloIds.has(p.id)
      if (show && !map.hasLayer(m)) m.addTo(map)
      if (!show && map.hasLayer(m)) map.removeLayer(m)
      if (!show) return
      const seq = draftIndex.get(p.id) || routeIndex.get(p.id) || 0
      m.setIcon(
        makePinIcon(p, {
          seq,
          selected: selectedId === p.id,
          inRoute: seq > 0,
          dim: hasRoute && seq === 0,
          moving: movingId === p.id,
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
  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(1),
    zoomOut: () => mapRef.current?.zoomOut(1),
    fit(coords, padRight) {
      const map = mapRef.current
      if (!map || !coords?.length) return
      map.fitBounds(L.latLngBounds(coords), {
        paddingTopLeft: [24, 130],
        paddingBottomRight: [padRight || 24, 96],
        animate: true,
        duration: 0.6,
        easeLinearity: 0.24,
      })
    },
    focus(lat, lng, offsetX = 0) {
      const map = mapRef.current
      if (!map) return
      const target = map.project([lat, lng], map.getZoom()).subtract([offsetX / 2, 40])
      map.panTo(map.unproject(target, map.getZoom()), { animate: true, duration: 0.45 })
    },
  }))

  return <div className="map" ref={hostRef} role="application" aria-label="青岛行程地图" />
})
