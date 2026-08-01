import { useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import {
  DEFAULT_STAY,
  clockToMinutes,
  formatDate,
  formatDistance,
  formatDuration,
  pointCost,
} from '../../data/trip.js'
import { buildTimeline } from '../../lib/transit.js'
import { Icon } from '../../icons/Icon.jsx'
import { Note, SectionHead, Stat } from './bits.jsx'

/* ============================================================
   总览 answers one question: how ready is this trip?

   Which means it has to be willing to say "not very". Every number here is
   derived from the days, so an empty day shows up as an empty day rather than
   as a tidy dashboard that happens to be describing nothing.
   ============================================================ */

/* The city, drawn rather than photographed — a photo would be another network
   dependency and another thing to go stale. */
function CoastArt() {
  return (
    <svg
      className="hero__art"
      viewBox="0 0 400 76"
      preserveAspectRatio="none"
      aria-hidden="true"
      /* Without an explicit width the SVG takes its 400px intrinsic size and
         sticks out of a narrow hero. It is clipped, but a stray 400px box also
         drags the hero's own min-content along with it. */
      width="100%"
      height="76"
    >
      <path
        d="M0 54h44l10-14 12 14h30l14-22 16 22h26l12-16 14 16h40l16-24 18 24h32l12-14 14 14h80v22H0Z"
        fill="rgba(255,255,255,.16)"
      />
      <path
        d="M0 64q26-7 52 0t52 0 52 0 52 0 52 0 52 0 52 0 52 0v12H0Z"
        fill="rgba(255,255,255,.12)"
      />
    </svg>
  )
}

export function OverviewView() {
  const s = useStore()

  const per = useMemo(
    () =>
      s.days.map((d) => {
        const tl = buildTimeline(d.items, s.getPoint, {
          startMinutes: clockToMinutes(d.startTime) ?? 540,
          defaultStay: DEFAULT_STAY,
        })
        const costs = d.items.map((it) =>
          it.estimatedCost != null ? it.estimatedCost : pointCost(s.getPoint(it.pointId)),
        )
        return {
          day: d,
          tl,
          cost: costs.filter((c) => c != null).reduce((a, b) => a + b, 0),
          unknown: costs.filter((c) => c == null).length,
          booking: d.items.filter((it) => it.reservationStatus === 'todo').length,
        }
      }),
    [s.days, s.points],
  )

  const totals = per.reduce(
    (a, p) => ({
      places: a.places + p.day.items.length,
      metres: a.metres + p.tl.totalMetres,
      cost: a.cost + p.cost,
      unknown: a.unknown + p.unknown,
      booking: a.booking + p.booking,
    }),
    { places: 0, metres: 0, cost: 0, unknown: 0, booking: 0 },
  )

  const scheduledIds = new Set(s.days.flatMap((d) => d.items.map((it) => it.pointId)))
  const savedUnplanned = s.savedIds.filter((id) => !scheduledIds.has(id)).length
  const emptyDays = per.filter((p) => p.day.items.length === 0)
  const busyDays = per.filter((p) => p.tl.totalMinutes > 11 * 60)

  const chkTotal = s.checklist.reduce((n, g) => n + g.items.length, 0)
  const chkDone = s.checklist.reduce((n, g) => n + g.items.filter((i) => i.done).length, 0)
  const chkPct = chkTotal ? Math.round((chkDone / chkTotal) * 100) : 0

  const stay = s.trip.hotelPointId ? s.getPoint(s.trip.hotelPointId) : null
  const stayPoints = s.points.filter((p) => p.cat === 'stay')
  const maxPlaces = Math.max(1, ...per.map((p) => p.day.items.length))

  const f0 = formatDate(s.trip.startDate)
  const f1 = formatDate(s.days[s.days.length - 1]?.date || s.trip.endDate)

  return (
    <>
      <header className="work__head">
        <div className="work__headrow">
          <div>
            <h1 className="work__title">总览</h1>
            <p className="work__sub">这趟准备得怎么样了</p>
          </div>
        </div>
      </header>

      <div className="work__body">
        <section className="hero">
          <CoastArt />
          <div className="hero__kicker">Qingdao</div>
          <h2>{s.trip.title}</h2>
          <div className="hero__dates">
            {f0.md} – {f1.md} · {s.days.length} 天 · {s.trip.travelers} 人
          </div>
          <div className="hero__stats">
            <Stat v={totals.places} k="个地点" />
            <Stat v={formatDistance(totals.metres)} k="总路程（估算）" />
            <Stat
              v={totals.cost ? `¥${totals.cost}` : '—'}
              k={totals.unknown ? `每人 · ${totals.unknown} 项未知` : '每人估算'}
            />
          </div>
        </section>

        {(emptyDays.length > 0 || busyDays.length > 0 || totals.booking > 0) && (
          <section style={{ display: 'grid', gap: 8 }}>
            {totals.booking > 0 && (
              <Note tone="warn" icon="ticket">
                有 <b>{totals.booking}</b> 个地点还没预约。海军博物馆这类是限量放票的，
                去之前先把票定下来。
              </Note>
            )}
            {emptyDays.length > 0 && (
              <Note icon="calendar">
                {emptyDays.map((p) => formatDate(p.day.date).md).join('、')} 还是空的。
              </Note>
            )}
            {busyDays.length > 0 && (
              <Note icon="alert">
                {busyDays.map((p) => formatDate(p.day.date).md).join('、')} 排得偏满，
                连走带玩超过 11 小时。
              </Note>
            )}
          </section>
        )}

        <section className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 'var(--sp-3) var(--sp-3) 6px' }}>
            <SectionHead title="每天" meta={`${s.days.length} 天`} />
          </div>
          {per.map((p, i) => {
            const df = formatDate(p.day.date)
            return (
              <button
                key={p.day.id}
                type="button"
                className="dayrow"
                style={{ '--day-c': p.day.color }}
                onClick={() => {
                  s.setActiveDay(p.day.id)
                  s.setView('itinerary')
                }}
              >
                <span className="dayrow__bar" />
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 650, fontSize: 'var(--fs-sub)' }}>
                    D{i + 1} · {df.md} {p.day.title || df.weekday}
                  </span>
                  <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--tx-3)' }}>
                    {/* A one-stop day has no legs, so "0 m" is not a small
                        distance — it is the absence of one. */}
                    {p.day.items.length
                      ? [
                          `${p.day.items.length} 个地点`,
                          p.day.items.length > 1 ? formatDistance(p.tl.totalMetres) : null,
                          `到 ${String(Math.floor(p.tl.endMinutes / 60)).padStart(2, '0')}:${String(
                            p.tl.endMinutes % 60,
                          ).padStart(2, '0')}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : '还没有安排'}
                  </span>
                </span>
                <span className="dayrow__load" aria-hidden="true">
                  {Array.from({ length: Math.max(1, p.day.items.length) }).map((_, j) => (
                    <i
                      key={j}
                      style={{
                        height: p.day.items.length
                          ? `${6 + (14 * (j + 1)) / maxPlaces}px`
                          : '3px',
                        opacity: p.day.items.length ? undefined : 0.25,
                      }}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </section>

        <section className="card" style={{ padding: 'var(--sp-3)', display: 'grid', gap: 10 }}>
          <SectionHead title="出行准备" meta={`${chkDone}/${chkTotal}`} />
          <div className="progress">
            <div className="progress__fill" style={{ width: `${chkPct}%` }} />
          </div>
          <div className="wrow" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--fs-sub)', color: 'var(--tx-2)' }}>
              还剩 <b style={{ color: 'var(--tx-1)' }}>{chkTotal - chkDone}</b> 项没打勾
            </span>
            <button type="button" className="wbtn wbtn--sm" onClick={() => s.setView('checklist')}>
              去清单
            </button>
          </div>
        </section>

        <section className="card" style={{ padding: 'var(--sp-3)', display: 'grid', gap: 10 }}>
          <SectionHead title="住宿" />
          {stay ? (
            <div className="wrow" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--fs-sub)' }}>
                <b>{stay.name}</b>
                <span style={{ color: 'var(--tx-3)' }}>　{stay.area}</span>
              </span>
              <button type="button" className="wbtn wbtn--sm" onClick={() => s.openDetail(stay.id)}>
                查看
              </button>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 'var(--fs-sub)', color: 'var(--tx-2)', lineHeight: 1.6 }}>
                还没有指定住哪。选一个之后，「优化顺序」会从酒店出发算，每天的路线才是真的。
              </p>
              <div className="wrow">
                {stayPoints.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="wbtn wbtn--sm"
                    onClick={() => s.updateTrip({ hotelPointId: p.id })}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {savedUnplanned > 0 && (
          <button
            type="button"
            className="card"
            style={{
              padding: 'var(--sp-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
              textAlign: 'left',
            }}
            onClick={() => s.setView('saved')}
          >
            <Icon name="star" size={18} />
            <span style={{ flex: 1, fontSize: 'var(--fs-sub)' }}>
              收藏里还有 <b>{savedUnplanned}</b> 个地点没排进任何一天
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
        )}
      </div>
    </>
  )
}
