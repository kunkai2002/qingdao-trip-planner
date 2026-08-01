import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useDragControls, useReducedMotion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassButton } from './Glass.jsx'
import { useScrollFlow } from '../lib/glassPointer.js'
import { useIsDesktop } from '../lib/useMediaQuery.js'
import { panelVariants, SPRING, T } from '../lib/motion.js'

/**
 * Panel — a multi-detent bottom sheet on phones, a right rail on desktop.
 *
 * The sheet used to have exactly one height, so opening anything buried the map
 * underneath it. Apple Maps, Google Maps and Amap all use a sheet you can rest
 * at several heights, because on a map the thing behind the sheet IS the
 * content. Three detents:
 *
 *   peek  — title and the first line or two; the map stays the subject
 *   half  — the default for a POI card
 *   full  — for reading a long list (checklist, routes)
 *
 * Dragging the handle moves between them and flicking down past peek dismisses.
 * The resting height is published as --panel-h so the camera keeps framing into
 * the visible part of the map.
 */

const DETENTS = ['peek', 'half', 'full']

export function Panel({
  eyebrowIcon,
  eyebrow,
  title,
  onClose,
  children,
  footer,
  resetKey,
  initialDetent = 'half',
  onBack,
  backLabel,
}) {
  const desktop = useIsDesktop()
  const reduced = useReducedMotion()
  const controls = useDragControls()
  const bodyRef = useScrollFlow()
  const paneRef = useRef(null)
  const headRef = useRef(null)

  const [detent, setDetent] = useState(initialDetent)
  const [metrics, setMetrics] = useState({ h: 0, head: 0 })

  // A new view inside the same pane starts at the top, like a page change.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [resetKey, bodyRef])

  // A different view wants a different resting height.
  useEffect(() => setDetent(initialDetent), [initialDetent, resetKey])

  /* Measure the sheet and its header once laid out. Everything below is derived
     from these two numbers, so they are read synchronously before paint. */
  useLayoutEffect(() => {
    if (desktop) return
    const measure = () => {
      const h = paneRef.current?.offsetHeight || 0
      const head = headRef.current?.offsetHeight || 0
      setMetrics((m) => (m.h === h && m.head === head ? m : { h, head }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (paneRef.current) ro.observe(paneRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [desktop, resetKey])

  /* Visible height at each detent. `peek` shows the header plus a sliver so the
     card is recognisable without covering the map. */
  const visibleFor = useCallback(
    (name) => {
      const { h, head } = metrics
      if (!h) return 0
      if (name === 'full') return h
      if (name === 'half') return Math.min(h, Math.max(head + 120, h * 0.56))
      return Math.min(h, head + 56)
    },
    [metrics],
  )

  const offsetFor = useCallback((name) => Math.max(0, metrics.h - visibleFor(name)), [metrics, visibleFor])

  /* Publish the covered height for the camera insets. Desktop's rail is
     side-mounted and contributes no bottom inset. */
  useEffect(() => {
    const root = document.documentElement
    const v = desktop ? 0 : Math.round(visibleFor(detent))
    root.style.setProperty('--panel-h', v + 'px')
    return () => root.style.setProperty('--panel-h', '0px')
  }, [desktop, detent, visibleFor])

  const settle = (info) => {
    const { h } = metrics
    if (!h) return
    const current = offsetFor(detent) + info.offset.y
    // a decisive flick counts for more than raw distance
    const projected = current + info.velocity.y * 0.14
    if (projected > offsetFor('peek') + 90) {
      onClose()
      return
    }
    let best = DETENTS[0]
    let bestGap = Infinity
    for (const name of DETENTS) {
      const gap = Math.abs(offsetFor(name) - projected)
      if (gap < bestGap) {
        bestGap = gap
        best = name
      }
    }
    setDetent(best)
  }

  const bodyMax = Math.max(120, visibleFor(detent) - metrics.head)

  return (
    <motion.section
      ref={paneRef}
      className={`glass glass--raised glass--drift panel panel--${detent}`}
      style={desktop ? undefined : { touchAction: 'none' }}
      {...(desktop
        ? {
            variants: panelVariants(reduced, desktop),
            initial: 'hidden',
            animate: 'show',
            exit: 'exit',
          }
        : {
            /* Explicit values rather than the shared variants: on a sheet the
               resting position is a detent offset, not a fixed slide-in. */
            initial: { y: metrics.h || 800, opacity: 0 },
            animate: { y: offsetFor(detent), opacity: 1 },
            exit: { y: metrics.h || 800, opacity: 0, transition: T.cardOut },
            transition: reduced ? { duration: 0.12 } : SPRING.drawer,
            drag: reduced ? false : 'y',
            dragListener: false,
            dragControls: controls,
            dragConstraints: { top: 0, bottom: metrics.h || 0 },
            dragElastic: { top: 0.03, bottom: 0.25 },
            onDragEnd: (_, info) => settle(info),
          })}
      role="dialog"
      aria-modal="false"
      aria-label={title}
    >
      <div
        className="panel__grab"
        onPointerDown={(e) => !desktop && controls.start(e)}
        onClick={() => {
          if (desktop) return
          // tapping the handle steps up, then wraps back to peek
          const i = DETENTS.indexOf(detent)
          setDetent(DETENTS[(i + 1) % DETENTS.length])
        }}
        role="button"
        tabIndex={desktop ? -1 : 0}
        aria-label={`调整面板高度，当前${{ peek: '收起', half: '一半', full: '展开' }[detent]}`}
        onKeyDown={(e) => {
          if (desktop) return
          const i = DETENTS.indexOf(detent)
          if (e.key === 'ArrowUp') setDetent(DETENTS[Math.min(DETENTS.length - 1, i + 1)])
          if (e.key === 'ArrowDown') {
            if (i === 0) onClose()
            else setDetent(DETENTS[i - 1])
          }
        }}
      />

      <header className="panel__head" ref={headRef}>
        {onBack && (
          <GlassButton
            depth="thin"
            className="panel__back"
            onClick={onBack}
            title={backLabel ? `返回${backLabel}` : '返回'}
            aria-label={backLabel ? `返回${backLabel}` : '返回'}
          >
            <Icon name="chevronLeft" size={16} />
          </GlassButton>
        )}
        <div className="panel__titles">
          {eyebrow && (
            <div className="panel__eyebrow">
              {eyebrowIcon && <Icon name={eyebrowIcon} size={13} />}
              {eyebrow}
            </div>
          )}
          <h2 className="panel__title">{title}</h2>
        </div>
        <GlassButton
          depth="thin"
          className="panel__close"
          onClick={onClose}
          title="关闭"
          aria-label="关闭"
        >
          <Icon name="close" size={16} />
        </GlassButton>
      </header>

      <div
        className="panel__body scroller"
        ref={bodyRef}
        style={desktop ? undefined : { maxHeight: bodyMax }}
      >
        {children}
      </div>

      {footer}
    </motion.section>
  )
}


/** Section heading used throughout the panels. */
export function SectionTitle({ icon, children, trailing }) {
  return (
    <div className="sectitle">
      {icon && <Icon name={icon} size={13} />}
      <span>{children}</span>
      <span className="sectitle__line" />
      {trailing}
    </div>
  )
}
