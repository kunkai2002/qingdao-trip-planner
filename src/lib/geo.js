/* ============================================================
   Geodesy
   ------------------------------------------------------------
   Seed coordinates are WGS-84. AutoNavi (高德) raster tiles are GCJ-02,
   so every seed point is shifted once on first load. Points already in
   local storage are stored post-shift and must never be shifted twice.
   ============================================================ */

const A = 6378245.0
const EE = 0.00669342162296594323

function outOfChina(lng, lat) {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55)
}

function tLat(x, y) {
  let r =
    -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  r += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3
  r += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3
  return r
}

function tLng(x, y) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  r += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3
  r += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3
  return r
}

/** WGS-84 [lat, lng] → GCJ-02 [lat, lng] */
export function wgs2gcj(lat, lng) {
  if (outOfChina(lng, lat)) return [lat, lng]
  let dLat = tLat(lng - 105, lat - 35)
  let dLng = tLng(lng - 105, lat - 35)
  const rad = (lat / 180) * Math.PI
  let m = Math.sin(rad)
  m = 1 - EE * m * m
  const sm = Math.sqrt(m)
  dLat = (dLat * 180) / (((A * (1 - EE)) / (m * sm)) * Math.PI)
  dLng = (dLng * 180) / ((A / sm) * Math.cos(rad) * Math.PI)
  return [lat + dLat, lng + dLng]
}

/** Great-circle distance in km between [lat,lng] pairs. */
export function haversine(a, b) {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Total straight-line length of an ordered point list. */
export function pathLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1], points[i])
  }
  return total
}

/**
 * Rough walking time in minutes for a straight-line distance.
 * Straight lines under-report real streets, so apply a 1.32 detour factor
 * on top of a 4.6 km/h pace.
 */
export function walkMinutes(km) {
  return Math.round(((km * 1.32) / 4.6) * 60)
}
