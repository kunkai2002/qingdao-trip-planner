import { memo } from 'react'

/**
 * Ambient — the soft colour field that sits between the map and the glass.
 * Its whole job is to give the panes something worth refracting; kept faint
 * and blended so map labels stay readable underneath.
 */
export const Ambient = memo(function Ambient() {
  return (
    <>
      <div className="ambient" aria-hidden="true">
        <span className="ambient__blob" />
        <span className="ambient__blob" />
        <span className="ambient__blob" />
        <span className="ambient__blob" />
      </div>
      <div className="grain" aria-hidden="true" />
    </>
  )
})
