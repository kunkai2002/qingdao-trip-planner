import { useEffect, useState } from 'react'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** true when the layout is the desktop right-rail form factor */
export const useIsDesktop = () => useMediaQuery('(min-width: 720px)')

/**
 * "There is a mouse attached."
 *
 * The single gate for everything decorative and always-on: the ambient light,
 * the glass drift, the flowing route dashes, the pin pulse, cluster backdrop
 * blur. All of them are continuous GPU work, and on a battery they cost real
 * heat for an effect sized for a desktop showcase. Deliberately NOT a width
 * check — a tablet is wide and still runs on a battery.
 */
const FINE_POINTER = '(hover: hover) and (pointer: fine)'
export const useFinePointer = () => useMediaQuery(FINE_POINTER)
export const isFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia(FINE_POINTER).matches
