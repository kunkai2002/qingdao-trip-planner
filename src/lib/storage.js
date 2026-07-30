/* Local persistence. Every read is defensive: a corrupt or full quota must
   never take the map down. */

const PREFIX = 'qd_planner_v2'

export const KEYS = {
  data: PREFIX,
  checklist: PREFIX + '_chk',
  theme: PREFIX + '_theme',
  basemap: PREFIX + '_basemap',
  seen: PREFIX + '_seen',
}

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Migrate v1 data (the single-file prototype) so nobody loses their edits. */
export function readLegacy() {
  const v1 = read('qd_planner_v1')
  const v1chk = read('qd_planner_v1_chk')
  return { data: v1, checklist: v1chk }
}
