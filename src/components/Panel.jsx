import { useEffect, useRef } from 'react'
import { motion, useDragControls, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassButton } from './Glass.jsx'
import { useScrollFlow } from '../lib/glassPointer.js'
import { useIsDesktop } from '../lib/useMediaQuery.js'
import { panelVariants } from '../lib/motion.js'

/**
 * Panel — bottom sheet on phones, right rail on desktop.
 *
 * On phones the sheet can be dragged shut from the grab handle. Displacement,
 * opacity and scale all read from the same motion value, so the glass responds
 * to the gesture continuously instead of snapping at a threshold.
 */
export function Panel({ eyebrowIcon, eyebrow, title, onClose, children, footer, resetKey }) {
  const desktop = useIsDesktop()
  const reduced = useReducedMotion()
  const controls = useDragControls()
  const bodyRef = useScrollFlow()

  // A new view inside the same pane starts at the top, like a page change.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [resetKey, bodyRef])

  /* Publish how much of the map this pane is covering, so the camera can frame
     into the *visible* rect instead of the whole viewport — the same idea as
     Apple's sheet-as-safe-area-inset and Google's GoogleMap.setPadding. On
     desktop the pane is side-mounted, so it contributes no bottom inset. */
  const paneRef = useRef(null)
  useEffect(() => {
    const root = document.documentElement
    if (desktop) {
      root.style.setProperty('--panel-h', '0px')
      return () => root.style.setProperty('--panel-h', '0px')
    }
    const el = paneRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      root.style.setProperty('--panel-h', Math.round(entry.contentRect.height) + 'px')
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--panel-h', '0px')
    }
  }, [desktop])

  const y = useMotionValue(0)
  const dragOpacity = useTransform(y, [0, 260], [1, 0.42])
  const dragScale = useTransform(y, [0, 260], [1, 0.965])

  return (
    <motion.section
      ref={paneRef}
      className="glass glass--raised glass--drift panel"
      variants={panelVariants(reduced, desktop)}
      initial="hidden"
      animate="show"
      exit="exit"
      style={desktop ? undefined : { y, opacity: dragOpacity, scale: dragScale }}
      drag={desktop || reduced ? false : 'y'}
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 110 || info.velocity.y > 620) onClose()
      }}
      role="dialog"
      aria-modal="false"
      aria-label={title}
    >
      <div
        className="panel__grab"
        onPointerDown={(e) => controls.start(e)}
        aria-hidden="true"
      />

      <header className="panel__head">
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

      <div className="panel__body scroller" ref={bodyRef}>
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
