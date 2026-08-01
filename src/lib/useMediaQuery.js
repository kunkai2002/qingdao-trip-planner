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
 * The one place the shell's shape is decided.
 *
 * 'desktop' — rail + itinerary + map
 * 'split'   — itinerary + map with the phone's tab bar, for an unfolded
 *             foldable: too small for a rail, far too big to waste on one column
 * 'phone'   — one column, map behind a tab
 *
 * This exists because CSS and JS were deciding it separately, and on a foldable
 * the viewport changes *while the app is running*. For one render they
 * disagreed: the stylesheet had already switched to three columns while React
 * had not yet mounted the rail, so the itinerary was laid into the 72px rail
 * track. Now React decides and publishes `data-layout`, and the stylesheet
 * follows it — they cannot drift apart.
 */
export function useLayoutMode() {
  const wide = useMediaQuery('(min-width: 720px)')
  const roomy = useMediaQuery('(min-width: 600px) and (min-height: 600px)')
  if (wide) return 'desktop'
  return roomy ? 'split' : 'phone'
}

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
