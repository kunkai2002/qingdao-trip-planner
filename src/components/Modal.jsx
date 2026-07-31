import { useEffect, useRef } from 'react'
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

  const paneRef = useRef(null)

  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  /* aria-modal alone does not stop Tab walking into the map and the panels
     behind the dialog. Trap focus, hide the rest of the app from assistive
     tech, and put focus back where it came from on close. */
  useEffect(() => {
    if (!open) return
    const root = document.getElementById('root')
    const previous = document.activeElement
    const shell = root?.firstElementChild

    const SEL =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const focusables = () =>
      [...(paneRef.current?.querySelectorAll(SEL) || [])].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    const t = setTimeout(() => {
      const list = focusables()
      ;(list[0] || paneRef.current)?.focus?.()
    }, 60)

    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (!paneRef.current?.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    if (shell) shell.setAttribute('aria-hidden', 'true')

    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      if (shell) shell.removeAttribute('aria-hidden')
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus()
    }
  }, [open])

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
            ref={paneRef}
            tabIndex={-1}
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
