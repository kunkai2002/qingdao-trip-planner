import { motion } from 'framer-motion'
import { useId } from 'react'
import { ICONS, opticalStroke } from './registry.js'
import { EASE_OUT } from '../lib/motion.js'

/**
 * DrawCheck — a check mark that draws itself rather than popping in.
 * Used for checkbox and success states (spec: SVG path drawing animation).
 */
export function DrawCheck({ size = 14, strokeWidth, reduced = false }) {
  const d = ICONS.check[0][1].d
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? opticalStroke(size) + 0.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <motion.path
        d={d}
        initial={reduced ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
        transition={
          reduced
            ? { duration: 0.01 }
            : { pathLength: { duration: 0.26, ease: EASE_OUT }, opacity: { duration: 0.08 } }
        }
      />
    </svg>
  )
}

/**
 * StarMeter — a rating rendered as five stars with a fractional fill.
 * The outline is one shape, the fill is the same shape clipped to a width,
 * so line → half-filled is a real interpolation instead of an icon swap.
 */
export function StarMeter({ value = 0, size = 13, gap = 1.5 }) {
  const uid = useId().replace(/[:]/g, '')
  const pct = Math.max(0, Math.min(1, value / 5))
  const total = size * 5 + gap * 4
  const outline = ICONS.star[0][1].d

  return (
    <svg
      width={total}
      height={size}
      viewBox={`0 0 ${total} ${size}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <clipPath id={`sm-${uid}`}>
          <motion.rect
            x="0"
            y="0"
            height={size}
            initial={{ width: 0 }}
            animate={{ width: total * pct }}
            transition={{ duration: 0.42, ease: EASE_OUT }}
          />
        </clipPath>
        <g id={`sr-${uid}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <g key={i} transform={`translate(${i * (size + gap)} 0) scale(${size / 24})`}>
              <path d={outline} />
            </g>
          ))}
        </g>
      </defs>
      <use
        href={`#sr-${uid}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinejoin="round"
        opacity="0.32"
      />
      <use href={`#sr-${uid}`} fill="currentColor" clipPath={`url(#sm-${uid})`} />
    </svg>
  )
}

/**
 * Spinner — a soft low-speed rotation, no strobing.
 */
export function Spinner({ size = 18 }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={opticalStroke(size)}
      strokeLinecap="round"
      aria-hidden="true"
      style={{ display: 'block' }}
      animate={{ rotate: 360, opacity: [0.55, 1, 0.55] }}
      transition={{
        rotate: { duration: 1.15, ease: 'linear', repeat: Infinity },
        opacity: { duration: 1.6, ease: 'easeInOut', repeat: Infinity },
      }}
    >
      <path d={ICONS.spinner[0][1].d} />
    </motion.svg>
  )
}
