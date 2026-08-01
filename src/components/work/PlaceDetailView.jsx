import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { CATS } from '../../data/categories.js'
import {
  DEFAULT_STAY,
  formatDate,
  formatDuration,
  minutesToClock,
  pointCost,
} from '../../data/trip.js'
import { Icon } from '../../icons/Icon.jsx'
import { PlaceImage } from '../PlaceImage.jsx'
import { DayMenu, Note, SectionHead } from './bits.jsx'

/* ============================================================
   One place, in full.

   On desktop this replaces the workspace column while the map keeps the pin on
   screen — which is the requirement that made the three-column layout worth it
   in the first place. On a phone the same component renders inside the bottom
   sheet, so the pin is still visible above it.
   ============================================================ */

function KV({ icon, label, children }) {
  if (!children) return null
  return (
    <div className="kvw">
      <Icon name={icon} size={15} />
      <div>
        <div className="kvw__k">{label}</div>
        <div className="kvw__v">{children}</div>
      </div>
    </div>
  )
}

export function PlaceDetailView({ point, dialog, embedded = false }) {
  const s = useStore()
  const addBtn = useRef(null)
  const [pick, setPick] = useState(false)
  if (!point) return null

  const cat = CATS[point.cat] || CATS.sight
  const cost = pointCost(point)
  const onDays = s.daysOfPoint(point.id)
  const saved = s.savedIds.includes(point.id)
  const amap = `https://uri.amap.com/marker?position=${point.lng.toFixed(6)},${point.lat.toFixed(
    6,
  )}&name=${encodeURIComponent(point.name)}&src=qingdao-planner&coordinate=gaode`

  const body = (
    <>
      <div className="detail__hero">
        <PlaceImage point={point} rounded={0} />
        <div className="detail__heroin">
          <span className="tag">{cat.name}</span>
          {point.rating > 0 && (
            <span className="tag">
              <Icon name="starSolid" size={11} />
              {point.rating.toFixed(1)}
              {point.reviews > 0 ? `（${point.reviews}）` : ''}
            </span>
          )}
          {cost === 0 ? <span className="tag">免费</span> : cost != null ? <span className="tag">约 ¥{cost} / 人</span> : null}
          {point.booking && (
            <span className="tag tag--book">
              <Icon name="ticket" size={11} />
              需预约
            </span>
          )}
        </div>
      </div>

      {/* Scheduling first: if this place is already on a day, the useful
          controls are about that visit, not about the place. */}
      {onDays.length > 0 ? (
        <section className="card setcard">
          <SectionHead title="在行程里" />
          {onDays.map((d) => {
            const i = s.dayIndex(d.id)
            const item = d.items.find((it) => it.pointId === point.id)
            const df = formatDate(d.date)
            const stay = item.durationMinutes ?? DEFAULT_STAY[point.cat] ?? 60
            return (
              <div key={d.id} className="setrow" style={{ '--day-c': d.color }}>
                <div className="setrow__t">
                  <span>
                    <span className="onday">
                      <i className="onday__dot" />D{i + 1}
                    </span>
                    　{df.md} 第 {s.seqInDay(d.id, point.id)} 站
                  </span>
                  <small>
                    停留 {formatDuration(stay)}
                    {item.plannedStart != null ? ` · 固定 ${minutesToClock(item.plannedStart)} 到` : ''}
                    {item.locked ? ' · 已锁定' : ''}
                  </small>
                </div>
                <div className="setrow__c">
                  <div className="wrow" style={{ gap: 4 }}>
                    <button
                      type="button"
                      className="wbtn wbtn--sm"
                      onClick={() => {
                        s.setActiveDay(d.id)
                        s.setView('itinerary')
                        s.reveal(point.id)
                      }}
                    >
                      去这天
                    </button>
                    <button
                      type="button"
                      className="wbtn wbtn--sm wbtn--ghost"
                      onClick={() => s.removeItem(d.id, item.id)}
                      aria-label="从这天移除"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ) : null}

      <div className="wrow">
        <button
          ref={addBtn}
          type="button"
          className={`wbtn${onDays.length ? '' : ' wbtn--primary'}`}
          onClick={() => setPick(true)}
        >
          <Icon name={onDays.length ? 'calendarPlus' : 'plus'} size={16} />
          {onDays.length ? '再加一天' : '加入行程'}
        </button>
        <button
          type="button"
          className="wbtn"
          aria-pressed={saved}
          onClick={() => s.toggleSaved(point.id)}
        >
          <Icon name={saved ? 'starSolid' : 'star'} size={16} />
          {saved ? '已收藏' : '收藏'}
        </button>
        <button
          type="button"
          className="wbtn"
          onClick={() => window.open(amap, '_blank', 'noopener')}
          title="在高德地图中打开"
        >
          <Icon name="navigation" size={16} />
          导航
        </button>
      </div>

      {point.prices?.length > 0 && (
        <section className="card setcard">
          <SectionHead title="价格" />
          {point.prices.map(([k, v], i) => (
            <div className="setrow" key={i}>
              <div className="setrow__t">
                <span>{k}</span>
              </div>
              <div className="setrow__c" style={{ fontSize: 'var(--fs-sub)', alignItems: 'center' }}>
                {v}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card setcard">
        <KV icon="mapPin" label="地址">
          {point.address}
          {point.area ? <span style={{ color: 'var(--tx-3)' }}> · {point.area}</span> : null}
        </KV>
        <KV icon="clock" label="营业时间">
          {point.hours}
        </KV>
        <KV icon="phone" label="电话">
          {point.tel ? <a href={`tel:${point.tel}`}>{point.tel}</a> : null}
        </KV>
      </section>

      {point.note && <Note icon="info">{point.note}</Note>}
      {point.warn && (
        <Note tone="warn" icon="alert">
          {point.warn}
        </Note>
      )}

      {point.tags?.length > 0 && (
        <div className="wrow" style={{ gap: 5 }}>
          {point.tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="wrow">
        <button type="button" className="wbtn wbtn--sm" onClick={() => s.openEdit(point.id)}>
          <Icon name="pencil" size={14} />
          编辑
        </button>
        <button
          type="button"
          className={`wbtn wbtn--sm${s.movingId === point.id ? ' wbtn--danger' : ''}`}
          onClick={() => (s.movingId === point.id ? s.endMove() : s.startMove(point.id))}
        >
          <Icon name={s.movingId === point.id ? 'check' : 'gripDots'} size={14} />
          {s.movingId === point.id ? '完成位置调整' : '调整位置'}
        </button>
        <button
          type="button"
          className="wbtn wbtn--sm wbtn--ghost"
          style={{ color: 'var(--alert-tx)' }}
          onClick={async () => {
            const ok = await dialog.confirm({
              kicker: '删除地点',
              title: `删除「${point.name}」？`,
              body: '这个地点会从地图、收藏和所有日程里移除。可以用「恢复默认数据」拿回内置点位。',
              tone: 'danger',
              confirmLabel: '删除',
            })
            if (ok) s.deletePoint(point.id)
          }}
        >
          <Icon name="trash" size={14} />
          删除
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--fs-micro)', color: 'var(--tx-3)', lineHeight: 1.6 }}>
        坐标为近似值。点「调整位置」之后，只有这一个地点可以在地图上拖动，其余时候拖地图就是平移。
      </p>

      <DayMenu
        anchor={addBtn}
        open={pick}
        onClose={() => setPick(false)}
        days={s.days}
        markIds={new Set(onDays.map((d) => d.id))}
        onPick={(dayId) => s.addToDay(dayId, point.id)}
      />
    </>
  )

  if (embedded) return <div className="detail detail--embedded">{body}</div>

  return (
    <>
      <header className="work__head">
        <div className="work__headrow">
          <button
            type="button"
            className="wbtn wbtn--ghost wbtn--icon"
            onClick={s.closePanel}
            aria-label="返回"
            style={{ flex: 'none', marginTop: 2 }}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <div>
            <h1 className="work__title">{point.name}</h1>
            <p className="work__sub">
              {cat.name}
              {point.area ? ` · ${point.area}` : ''}
            </p>
          </div>
        </div>
      </header>
      <div className="work__body detail">{body}</div>
    </>
  )
}
