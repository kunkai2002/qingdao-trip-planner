import { motion } from 'framer-motion'
import { CATS, CAT_ORDER, catColor } from '../data/categories.js'
import { T } from '../lib/motion.js'

export function Legend({ enabled }) {
  return (
    <motion.aside
      className="glass glass--thin legend"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...T.card, delay: 0.28 }}
      aria-label="图例"
    >
      <div>
        {CAT_ORDER.map((key) => (
          <div
            className="legend__row"
            key={key}
            style={{
              '--legend-c': catColor(key),
              opacity: enabled[key] ? 1 : 0.4,
              transition: 'opacity var(--t-hover) var(--e-out)',
            }}
          >
            <span className="legend__dot" />
            {CATS[key].name}
          </div>
        ))}
      </div>
    </motion.aside>
  )
}
