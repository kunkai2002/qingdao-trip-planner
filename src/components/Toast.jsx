import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { SPRING, T } from '../lib/motion.js'

const TONE = {
  info: { color: 'var(--accent)', icon: 'info' },
  good: { color: 'var(--good)', icon: 'checkCircle' },
  warn: { color: 'var(--warn)', icon: 'alert' },
  bad: { color: 'var(--bad)', icon: 'alert' },
}

export function Toast({ toast, onDismiss }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => onDismiss(toast.id), 2600)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  const tone = TONE[toast?.tone] || TONE.info

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className="glass glass--raised toast"
          style={{ '--toast-c': tone.color, x: '-50%' }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97, transition: T.cardOut }}
          transition={SPRING.soft}
          role="status"
          aria-live="polite"
        >
          <span className="toast__icon">
            <Icon name={toast.icon || tone.icon} size={17} />
          </span>
          <span>{toast.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
