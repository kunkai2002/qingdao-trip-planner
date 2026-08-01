import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { CATS } from '../../data/categories.js'
import { pointCost } from '../../data/trip.js'
import { Icon } from '../../icons/Icon.jsx'
import { PlaceImage } from '../PlaceImage.jsx'
import { DayMenu, PlaceMeta } from './bits.jsx'

/**
 * One place, everywhere it appears outside the itinerary.
 *
 * The card has to carry enough to decide with — rating, area, price, whether it
 * needs booking, and whether it is already on a day — because the alternative
 * is opening every one of 49 places to find out.
 */
export function PlaceCard({ point, index = 0 }) {
  const s = useStore()
  const addBtn = useRef(null)
  const [pick, setPick] = useState(false)

  const cat = CATS[point.cat]
  const cost = pointCost(point)
  const onDays = s.daysOfPoint(point.id)
  const saved = s.savedIds.includes(point.id)

  return (
    <article
      className="pcard"
      onClick={() => s.openDetail(point.id)}
      onPointerEnter={() => s.setHover(point.id)}
      onPointerLeave={() => s.setHover(null)}
    >
      <div className="pcard__cover">
        <PlaceImage point={point} />
      </div>

      <div className="pcard__col">
        <div className="pcard__title">{point.name}</div>
        <PlaceMeta
          point={point}
          cost={cost}
          extra={cat ? <span className="tag">{cat.name}</span> : null}
        />

        {onDays.length > 0 && (
          <div className="pcard__meta">
            {onDays.map((d) => {
              const i = s.dayIndex(d.id)
              return (
                <span className="onday" key={d.id} style={{ '--day-c': d.color }}>
                  <i className="onday__dot" />D{i + 1} 第 {s.seqInDay(d.id, point.id)} 站
                </span>
              )
            })}
          </div>
        )}

        {point.note && <p className="pcard__note">{point.note}</p>}

        <div className="pcard__actions" onClick={(e) => e.stopPropagation()}>
          <button
            ref={addBtn}
            type="button"
            className={`wbtn wbtn--sm${onDays.length ? '' : ' wbtn--primary'}`}
            onClick={() => setPick(true)}
          >
            <Icon name={onDays.length ? 'calendarPlus' : 'plus'} size={14} />
            {onDays.length ? '再加一天' : '加入行程'}
          </button>
          {onDays.length > 0 && (
            <button
              type="button"
              className="wbtn wbtn--sm wbtn--ghost"
              onClick={() => s.removePoint(point.id)}
            >
              <Icon name="minus" size={14} />
              移出
            </button>
          )}
          <button
            type="button"
            className="wbtn wbtn--sm wbtn--ghost"
            aria-pressed={saved}
            onClick={() => s.toggleSaved(point.id)}
            aria-label={saved ? '取消收藏' : '收藏'}
          >
            <Icon name={saved ? 'starSolid' : 'star'} size={14} />
            {saved ? '已收藏' : '收藏'}
          </button>
        </div>
      </div>

      <DayMenu
        anchor={addBtn}
        open={pick}
        onClose={() => setPick(false)}
        days={s.days}
        markIds={new Set(onDays.map((d) => d.id))}
        onPick={(dayId) => s.addToDay(dayId, point.id)}
      />
    </article>
  )
}
