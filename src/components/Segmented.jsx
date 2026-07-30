import { motion, useReducedMotion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { SPRING } from '../lib/motion.js'

/**
 * Segmented — a translucent capsule slides between options and stretches to
 * each label's width. This is the one place a single sliding indicator is the
 * right pattern, because the options are mutually exclusive.
 */
export function Segmented({ options, value, onChange, id = 'seg' }) {
  const reduced = useReducedMotion()
  return (
    <div className="glass glass--thin seg" role="tablist" aria-label="分组">
      <div className="seg__track">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`seg__opt ${active ? 'seg__opt--on' : ''}`}
              onClick={() => onChange(o.value)}
            >
              {active && (
                <motion.span
                  layoutId={`${id}-indicator`}
                  className="seg__pill"
                  transition={reduced ? { duration: 0.01 } : SPRING.indicator}
                />
              )}
              <span className="seg__label">
                {o.icon && <Icon name={o.icon} size={14} state={active ? 'selected' : 'default'} />}
                {o.label}
                {o.count != null && <span className="seg__count">{o.count}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
