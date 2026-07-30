import { useEffect, useRef } from 'react'

/* ============================================================
   Pointer-tracked specular highlight
   ------------------------------------------------------------
   Exactly ONE document-level listener for the whole app, throttled to
   one write per animation frame, and it only ever touches the glass
   element currently under the cursor. No per-component listeners, no
   state churn, no React re-render — just two CSS custom properties.
   ============================================================ */

let installed = false

export function initGlassPointer() {
  if (installed || typeof window === 'undefined') return () => {}

  // Touch devices have no hover: tracking there is wasted work.
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!canHover || reduced) return () => {}

  installed = true
  let frame = 0
  let pending = null
  let current = null

  const flush = () => {
    frame = 0
    if (!pending) return
    const { el, x, y } = pending
    pending = null
    if (current && current !== el) {
      current.style.removeProperty('--gx')
      current.style.removeProperty('--gy')
    }
    current = el
    el.style.setProperty('--gx', x.toFixed(1) + '%')
    el.style.setProperty('--gy', y.toFixed(1) + '%')
  }

  const onMove = (e) => {
    const el = e.target instanceof Element ? e.target.closest('.glass') : null
    if (!el) {
      if (current && !frame) {
        current.style.removeProperty('--gx')
        current.style.removeProperty('--gy')
        current = null
      }
      return
    }
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    pending = {
      el,
      x: ((e.clientX - r.left) / r.width) * 100,
      // Bias upward: real glass catches light near the lit edge, and this
      // keeps the hotspot off the text most of the time.
      y: ((e.clientY - r.top) / r.height) * 78 - 6,
    }
    if (!frame) frame = requestAnimationFrame(flush)
  }

  const onLeave = () => {
    if (current) {
      current.style.removeProperty('--gx')
      current.style.removeProperty('--gy')
      current = null
    }
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerleave', onLeave, { passive: true })

  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
    if (frame) cancelAnimationFrame(frame)
    onLeave()
    installed = false
  }
}

/**
 * useScrollFlow — as a scroller moves, the trapped light inside its glass
 * drifts. Amplitude stays under the 8–16px parallax ceiling, and the whole
 * thing collapses to a no-op under reduced motion.
 */
export function useScrollFlow() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const pane = el.closest('.glass') || el
    let frame = 0

    const apply = () => {
      frame = 0
      const max = Math.max(1, el.scrollHeight - el.clientHeight)
      const p = Math.min(1, el.scrollTop / max)
      pane.style.setProperty('--sheen-shift', (28 + p * 44).toFixed(1) + '%')
      el.style.setProperty('--flow', (p * 12).toFixed(2) + 'px')
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      pane.style.removeProperty('--sheen-shift')
    }
  }, [])

  return ref
}

/**
 * spawnRipple — the click-time refraction ring. Appended imperatively and
 * removed on animationend so it never lingers in the React tree.
 */
export function spawnRipple(event, host) {
  const el = host || event.currentTarget
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = el.getBoundingClientRect()
  const size = Math.max(r.width, r.height) * 2.2
  const span = document.createElement('span')
  span.className = 'ripple'
  span.style.width = span.style.height = size + 'px'
  span.style.left = (event.clientX ?? r.left + r.width / 2) - r.left + 'px'
  span.style.top = (event.clientY ?? r.top + r.height / 2) - r.top + 'px'
  span.addEventListener('animationend', () => span.remove(), { once: true })
  el.appendChild(span)
  window.setTimeout(() => span.remove(), 700)
}
