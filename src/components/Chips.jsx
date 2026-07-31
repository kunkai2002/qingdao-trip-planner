import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassButton } from './Glass.jsx'
import { CATS, CAT_ORDER, catColor } from '../data/categories.js'
import { T, SPRING } from '../lib/motion.js'

/**
 * Layer chips. Each is an independent toggle, so instead of one sliding
 * indicator the selected state grows a translucent capsule fill in place —
 * scaling out from the chip rather than fading flatly.
 */
export function Chips({ counts, enabled, metroOn, onToggleCat, onToggleMetro, onRoutes, routeActive }) {
  const rowRef = useRef(null)

  // drop the fade once there is nothing left to scroll to
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const update = () => {
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
      el.dataset.end = end ? '1' : '0'
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  return (
    <motion.div
      ref={rowRef}
      className="chips no-scrollbar"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...T.card, delay: 0.16 }}
    >
      {CAT_ORDER.map((key, i) => {
        const cat = CATS[key]
        const on = !!enabled[key]
        return (
          <GlassButton
            key={key}
            depth="thin"
            lift={false}
            className={`chip ${on ? 'chip--on' : 'chip--off'}`}
            style={{ '--chip-c': catColor(key) }}
            onClick={() => onToggleCat(key)}
            aria-pressed={on}
            title={`${on ? '隐藏' : '显示'}${cat.name}图层`}
            initial={{ opacity: 0, y: -8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...T.card, delay: 0.18 + i * 0.035 }}
          >
            <AnimatePresence initial={false}>
              {on && (
                <motion.span
                  className="chip__fill"
                  initial={{ opacity: 0, scale: 0.86 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={SPRING.indicator}
                />
              )}
            </AnimatePresence>
            <span className="chip__glyph">
              <Icon name={cat.icon} size={16} state={on ? 'selected' : 'default'} />
            </span>
            {cat.name}
            <span className="chip__count">{counts[key] || 0}</span>
          </GlassButton>
        )
      })}

      <GlassButton
        depth="thin"
        lift={false}
        className={`chip ${metroOn ? 'chip--on' : 'chip--off'}`}
        style={{ '--chip-c': 'var(--c-metro)' }}
        onClick={onToggleMetro}
        aria-pressed={metroOn}
        title={`${metroOn ? '隐藏' : '显示'}地铁示意线`}
        initial={{ opacity: 0, y: -8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...T.card, delay: 0.36 }}
      >
        <AnimatePresence initial={false}>
          {metroOn && (
            <motion.span
              className="chip__fill"
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={SPRING.indicator}
            />
          )}
        </AnimatePresence>
        <span className="chip__glyph">
          <Icon name="routePath" size={16} />
        </span>
        地铁线
      </GlassButton>

      <GlassButton
        depth="thin"
        lift={false}
        className={`chip ${routeActive ? 'chip--on' : ''}`}
        style={{ '--chip-c': 'var(--accent)' }}
        onClick={onRoutes}
        title="攻略路线"
        initial={{ opacity: 0, y: -8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...T.card, delay: 0.4 }}
      >
        <AnimatePresence initial={false}>
          {routeActive && (
            <motion.span
              className="chip__fill"
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={SPRING.indicator}
            />
          )}
        </AnimatePresence>
        <span className="chip__glyph">
          <Icon name="compass" size={16} state={routeActive ? 'selected' : 'default'} />
        </span>
        攻略路线
      </GlassButton>
    </motion.div>
  )
}
