import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { spawnRipple } from '../lib/glassPointer.js'
import { SPRING, T } from '../lib/motion.js'

/**
 * GlassSurface — a pane of liquid glass. Non-interactive by default.
 *
 *   depth: 'thin' | 'default' | 'raised'
 *   drift: enable the slow internal light flow (large panes only)
 */
export const GlassSurface = forwardRef(function GlassSurface(
  { depth = 'default', drift = false, className = '', as = 'div', children, ...rest },
  ref,
) {
  const Cmp = motion[as] || motion.div
  const cls = [
    'glass',
    depth === 'thin' && 'glass--thin',
    depth === 'raised' && 'glass--raised',
    drift && 'glass--drift',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <Cmp ref={ref} className={cls} {...rest}>
      {children}
    </Cmp>
  )
})

/**
 * GlassButton — the one interactive glass primitive.
 *
 * Hover lifts 1.5px and brightens the rim; press compresses to 0.97 and
 * releases on a low-elasticity spring; the click point emits a translucent
 * refraction ring. All of it collapses to a plain opacity change under
 * `prefers-reduced-motion`.
 */
export const GlassButton = forwardRef(function GlassButton(
  {
    variant = 'default', // 'default' | 'primary' | 'danger' | 'quiet'
    depth = 'default',
    drift = false,
    lift = true,
    className = '',
    onPointerDown,
    children,
    ...rest
  },
  ref,
) {
  const reduced = useReducedMotion()

  const cls = [
    'glass',
    'gbtn',
    depth === 'thin' && 'glass--thin',
    depth === 'raised' && 'glass--raised',
    drift && 'glass--drift',
    variant !== 'default' && `gbtn--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <motion.button
      ref={ref}
      type="button"
      className={cls}
      whileHover={reduced || !lift ? undefined : { y: -1.5 }}
      whileTap={reduced ? undefined : { scale: 0.97, y: 0 }}
      transition={SPRING.press}
      onPointerDown={(e) => {
        spawnRipple(e)
        onPointerDown?.(e)
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
})

/**
 * GlassCard — a surface that also responds to hover, used for list rows.
 * Tilt is capped at ~1 degree: enough for depth, never a 3-D flip.
 */
export const GlassCard = forwardRef(function GlassCard(
  { className = '', interactive = true, index = 0, children, onPointerDown, ...rest },
  ref,
) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      className={`glass ${className}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...T.card, delay: Math.min(index, 8) * 0.04 }}
      whileHover={reduced || !interactive ? undefined : { y: -2, rotate: -0.25 }}
      whileTap={reduced || !interactive ? undefined : { scale: 0.985 }}
      onPointerDown={(e) => {
        if (interactive) spawnRipple(e)
        onPointerDown?.(e)
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
