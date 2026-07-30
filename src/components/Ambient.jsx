import { memo } from 'react'

/**
 * Ambient — the soft colour field that sits between the map and the glass.
 * Its whole job is to give the panes something worth refracting; kept faint
 * and blended so map labels stay readable underneath.
 */
/* The page-wide grain overlay was removed: over map tiles it read as dust and
   softened the map's own labels. Grain now lives only on the glass, where it
   belongs. */
export const Ambient = memo(function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient__blob" />
      <span className="ambient__blob" />
      <span className="ambient__blob" />
      <span className="ambient__blob" />
    </div>
  )
})
