import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { makePinIcon } from './pinIcon.js'
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
    addMode,
    diyMode,
    onSelect,
    onMovePoint,
    onPlacePoint,
    onTileTrouble,
  },
  ref,
) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  const markersRef = useRef(new Map())
  const linesRef = useRef({ metro: null, route: null, routeHalo: null, draft: null })
  const cbRef = useRef({})

  // Handlers change every render; keep Leaflet bound to a stable box.
  cbRef.current = { onSelect, onMovePoint, onPlacePoint, onTileTrouble }

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

    const root = document.documentElement
    const onMoveStart = () => root.setAttribute('data-map-moving', '1')
    const onMoveEnd = () => root.removeAttribute('data-map-moving')
    map.on('movestart zoomstart', onMoveStart)
    map.on('moveend zoomend', onMoveEnd)

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
        m = L.marker([p.lat, p.lng], { icon: makePinIcon(p), draggable: true, riseOnHover: true })
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

  /* ---------------- markers: visibility + icon state ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const routeIndex = new Map((routeStops || []).map((id, i) => [id, i + 1]))
    const draftIndex = new Map((draftStops || []).map((id, i) => [id, i + 1]))
    const hasRoute = routeIndex.size > 0 || draftIndex.size > 0

    points.forEach((p) => {
      const m = markersRef.current.get(p.id)
      if (!m) return
      const visible = visibleIds.has(p.id)
      if (visible && !map.hasLayer(m)) m.addTo(map)
      if (!visible && map.hasLayer(m)) map.removeLayer(m)
      if (!visible) return

      const seq = draftIndex.get(p.id) || routeIndex.get(p.id) || 0
      m.setIcon(
        makePinIcon(p, {
          seq,
          selected: selectedId === p.id,
          inRoute: seq > 0,
          dim: hasRoute && seq === 0,
        }),
      )
    })
  }, [points, visibleIds, routeStops, draftStops, selectedId])

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
