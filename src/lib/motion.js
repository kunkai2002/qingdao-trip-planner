/* ============================================================
   Motion system — the JS mirror of the CSS tokens.
   Durations and curves live in one place so a button, a card and a
   modal all move like parts of the same object.
   ============================================================ */

export const EASE_OUT = [0.22, 1, 0.36, 1] // entrances, settling
export const EASE_IN = [0.4, 0, 1, 1] // exits, leaving the screen
export const EASE_INOUT = [0.4, 0, 0.2, 1] // continuous / reversible

/** milliseconds, matching --t-* in tokens.css */
export const DUR = {
  micro: 0.16,
  hover: 0.2,
  press: 0.13,
  card: 0.28,
  modal: 0.34,
  page: 0.42,
}

/** Low-elasticity springs. Glass has inertia; it is not jelly. */
export const SPRING = {
  press: { type: 'spring', stiffness: 440, damping: 32, mass: 0.6 },
  soft: { type: 'spring', stiffness: 340, damping: 30, mass: 0.8 },
  drawer: { type: 'spring', stiffness: 300, damping: 34, mass: 0.9 },
  indicator: { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 },
}

export const T = {
  hover: { duration: DUR.hover, ease: EASE_OUT },
  press: { duration: DUR.press, ease: EASE_OUT },
  card: { duration: DUR.card, ease: EASE_OUT },
  cardOut: { duration: DUR.hover, ease: EASE_IN },
  modal: { duration: DUR.modal, ease: EASE_OUT },
  modalOut: { duration: DUR.hover, ease: EASE_IN },
}

/* ---- reusable variants ---------------------------------------------- */

/** Cards rise 8–16px into place and fade in; they shrink slightly on exit. */
export function cardVariants(reduced) {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.14 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    }
  }
  return {
    hidden: { opacity: 0, y: 14, scale: 0.985 },
    show: (i = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { ...T.card, delay: Math.min(i, 8) * 0.042 },
    }),
    exit: { opacity: 0, scale: 0.975, transition: T.cardOut },
  }
}

/** Modals: scale 0.96 → 1 with opacity, coordinated with the scrim blur. */
export function modalVariants(reduced) {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.14 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    }
  }
  return {
    hidden: { opacity: 0, scale: 0.96, y: 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: T.modal },
    exit: { opacity: 0, scale: 0.97, y: 6, transition: T.modalOut },
  }
}

/** Drawers slide in from the edge they belong to, with real inertia. */
export function panelVariants(reduced, desktop) {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.14 } },
      exit: { opacity: 0, transition: { duration: 0.12 } },
    }
  }
  const axis = desktop ? 'x' : 'y'
  const from = desktop ? 40 : 60
  return {
    hidden: { opacity: 0, [axis]: from, scale: 0.985 },
    show: { opacity: 1, [axis]: 0, scale: 1, transition: SPRING.drawer },
    exit: { opacity: 0, [axis]: from * 0.7, scale: 0.99, transition: T.cardOut },
  }
}

/** Menus grow out of the control that opened them. */
export const popVariants = {
  hidden: { opacity: 0, scale: 0.94, y: -6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: DUR.hover, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.14, ease: EASE_IN } },
}
