import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../icons/Icon.jsx'
import { formatDate } from '../../data/trip.js'

/* Small shared pieces. Nothing here reaches into the store — they take props,
   so the same card renders from 探索, 收藏 and the day list. */

export function Stat({ v, k, title }) {
  return (
    <div className="stat" title={title}>
      <div className="stat__v">{v}</div>
      <div className="stat__k">{k}</div>
    </div>
  )
}

export function Note({ tone = 'info', icon = 'info', children }) {
  return (
    <p className={`note${tone === 'warn' ? ' note--warn' : ''}`}>
      <Icon name={icon} size={15} className="note__icon" />
      <span>{children}</span>
    </p>
  )
}

export function SectionHead({ title, meta, action }) {
  return (
    <div className="sectionhead">
      <h3>{title}</h3>
      {action || (meta ? <span>{meta}</span> : null)}
    </div>
  )
}

export function Empty({ icon = 'compass', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={24} />
      </span>
      <h4>{title}</h4>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  )
}

/* ------------------------------------------------------------
   Anchored popover

   In a portal on purpose: these open from inside the workspace column, which
   scrolls and clips its overflow. As a child, a menu near the bottom of the
   list would be cut in half.
   ------------------------------------------------------------ */

export function Pop({ anchor, open, onClose, width = 230, estHeight = 240, label, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!open || !anchor?.current) return
    const r = anchor.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    // right-align to the anchor, flip above when there is no room below
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8)
    setPos({
      left,
      top: below > estHeight + 12 ? r.bottom + 6 : Math.max(8, r.top - estHeight - 6),
      width,
    })
  }, [open, anchor, width, estHeight])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return
      if (anchor?.current?.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), onClose())
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    /* An anchored popover that survives a scroll ends up pointing at whatever
       has scrolled into its place, which is worse than closing. */
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, onClose, anchor])

  if (!open || !pos) return null
  return createPortal(
    <div className="pop" ref={ref} style={pos} role="menu" aria-label={label}>
      {children}
    </div>,
    document.body,
  )
}

export function PopItem({ icon, children, onClick, tone, disabled }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`pop__row${tone === 'danger' ? ' pop__row--danger' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size={16} /> : <span style={{ width: 16 }} />}
      <span>{children}</span>
    </button>
  )
}

export function PopHead({ children }) {
  return <div className="pop__head">{children}</div>
}

/**
 * "Add to which day" — deliberately a choice, never a default.
 *
 * Dropping a place into whichever day happens to be selected is the kind of
 * helpfulness that costs more to undo than to skip: you find out three screens
 * later, on the wrong day.
 */
export function DayMenu({ anchor, open, onClose, days, onPick, markIds }) {
  const marked = markIds || new Set()
  return (
    <Pop
      anchor={anchor}
      open={open}
      onClose={onClose}
      width={236}
      estHeight={Math.min(days.length * 46 + 46, 330)}
      label="选择日期"
    >
      <PopHead>加到哪一天</PopHead>
      <div className="pop__scroll">
        {days.map((d, i) => {
          const f = formatDate(d.date)
          return (
            <button
              key={d.id}
              type="button"
              role="menuitem"
              className="pop__row pop__row--day"
              style={{ '--day-c': d.color }}
              onClick={() => {
                onPick(d.id)
                onClose()
              }}
            >
              <span className="pop__sw" />
              <span className="pop__daytext">
                <b>
                  D{i + 1} · {f.md}
                </b>
                <span>{d.title || f.weekday}</span>
              </span>
              {marked.has(d.id) ? <Icon name="check" size={15} /> : null}
            </button>
          )
        })}
      </div>
    </Pop>
  )
}

/** Rating, area, price, booking — the row that lets you judge a place. */
export function PlaceMeta({ point, cost, extra }) {
  const bits = []
  if (point.rating > 0) {
    bits.push(
      <span className="rating" key="r">
        <Icon name="starSolid" size={12} />
        {point.rating.toFixed(1)}
        {point.reviews > 0 && (
          <span className="rating__n">
            ({point.reviews > 999 ? `${Math.round(point.reviews / 100) / 10}k` : point.reviews})
          </span>
        )}
      </span>,
    )
  }
  if (point.area) bits.push(<span key="a">{point.area}</span>)
  if (cost === 0) bits.push(<span key="c">免费</span>)
  else if (cost != null) bits.push(<span key="c">约 ¥{cost}</span>)
  if (point.booking) {
    bits.push(
      <span className="tag tag--book" key="b">
        <Icon name="ticket" size={11} />
        需预约
      </span>,
    )
  }
  if (extra) bits.push(<span key="x">{extra}</span>)
  return <div className="pcard__meta">{bits}</div>
}
