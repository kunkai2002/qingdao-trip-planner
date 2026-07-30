import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useScrollFlow } from '../lib/glassPointer.js'
import { modalVariants, T } from '../lib/motion.js'

/**
 * Modal — scrim dims and blurs first, then the pane scales up from 0.96 while
 * a single band of edge-light sweeps across it. Escape and scrim clicks close.
 */
export function Modal({ open, onClose, labelledBy, children, dismissible = true }) {
  const reduced = useReducedMotion()
  const bodyRef = useScrollFlow()

  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: T.modalOut }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={dismissible ? onClose : undefined}
        >
          <motion.div
            className="glass glass--raised glass--drift modal"
            variants={modalVariants(reduced)}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
          >
            {!reduced && <span className="modal__sweep" aria-hidden="true" />}
            <div className="modal__inner scroller" ref={bodyRef}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
