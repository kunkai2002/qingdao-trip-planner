import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useStore } from '../../store/useStore.js'
import { CATS } from '../../data/categories.js'
import {
  DEFAULT_STAY,
  clockToMinutes,
  formatDate,
  formatDistance,
  formatDuration,
  minutesToClock,
  pointCost,
} from '../../data/trip.js'
import { MODES, MODE_ORDER } from '../../lib/transit.js'
import { buildTimeline } from '../../lib/transit.js'
import { Icon } from '../../icons/Icon.jsx'
import { DayMenu, Empty, Note, Pop, PopHead, PopItem, Stat } from './bits.jsx'

/* ============================================================
   The itinerary — the view this whole rebuild exists for.

   A day is an ordered list of stops, and the two things you do to it are
   "reorder" and "how long am I here". Everything else on this screen is a
   consequence of those two, computed and shown rather than typed in.
   ============================================================ */

/* Past this the day stops being a day out. Not a hard rule — a note, with the
   number that triggered it, because "too full" is the user's call. */
const LONG_DAY_MIN = 11 * 60
const LATE_END_MIN = 21 * 60

function TransitLeg({ row, onMode }) {
  const btn = useRef(null)
  const [open, setOpen] = useState(false)
  if (!row.leg) return null
  const m = MODES[row.leg.mode]
  return (
    <div className="leg">
      <button
        ref={btn}
        type="button"
        className="leg__mode"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`交通方式：${m.name}，点击更换`}
      >
        <Icon name={m.icon} size={13} />
        {m.name}
        {row.leg.auto && <span style={{ opacity: 0.6 }}>自动</span>}
      </button>
      <span>
        <b>{formatDuration(row.leg.minutes)}</b> · {formatDistance(row.leg.metres)}
        <span style={{ opacity: 0.75 }}>（估算）</span>
      </span>
      <Pop anchor={btn} open={open} onClose={() => setOpen(false)} width={190} estHeight={200}>
        <PopHead>怎么过去</PopHead>
        <PopItem icon="wand" onClick={() => (onMode('auto'), setOpen(false))}>
          自动按距离选
        </PopItem>
        {MODE_ORDER.map((k) => (
          <PopItem key={k} icon={MODES[k].icon} onClick={() => (onMode(k), setOpen(false))}>
            {MODES[k].name}
          </PopItem>
        ))}
      </Pop>
    </div>
  )
}

function ItemCard({ row, day, days, dialog, flashId, desktop }) {
  const s = useStore()
  const menuBtn = useRef(null)
  const [menu, setMenu] = useState(false)
  const [dayPick, setDayPick] = useState(false)

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.item.id })

  const point = row.point
  const cat = point ? CATS[point.cat] : null
  const cost = row.item.estimatedCost != null ? row.item.estimatedCost : pointCost(point)

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    '--day-c': day.color,
  }

  if (!point) {
    // The place was deleted but the stop survived — say so instead of rendering
    // a card with an empty title.
    return (
      <div ref={setNodeRef} style={style} className="icard" data-missing="1">
        <span className="icard__seq">?</span>
        <div className="icard__col">
          <div className="icard__title">这个地点已被删除</div>
          <div className="icard__meta">从行程移除它，或用「恢复默认数据」找回</div>
        </div>
        <button
          type="button"
          className="wbtn wbtn--ghost wbtn--icon"
          onClick={() => s.removeItem(day.id, row.item.id)}
          aria-label="移除"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
    )
  }

  const askDuration = async () => {
    const cur = row.stay
    const v = await dialog.prompt({
      kicker: point.name,
      title: '打算待多久？',
      label: '分钟',
      defaultValue: String(cur),
      placeholder: '例如 90',
      confirmLabel: '保存',
    })
    if (v == null) return
    const n = Math.max(0, Math.min(1440, Math.round(Number(v))))
    if (!Number.isFinite(n)) {
      s.notify('请输入分钟数，例如 90', 'warn', 'alert')
      return
    }
    s.updateItem(day.id, row.item.id, { durationMinutes: n })
  }

  const askArrival = async () => {
    const v = await dialog.prompt({
      kicker: point.name,
      title: '几点到？',
      body: '固定这一站的时间之后，后面的行程会从它往下顺延。留空则跟着前一站自动推算。',
      label: '时间（24 小时制，如 13:30）',
      defaultValue: row.item.plannedStart != null ? minutesToClock(row.item.plannedStart) : '',
      placeholder: minutesToClock(row.arrive),
      confirmLabel: '保存',
    })
    if (v == null) return
    if (!v.trim()) {
      s.updateItem(day.id, row.item.id, { plannedStart: null })
      return
    }
    const mins = clockToMinutes(v.trim())
    if (mins == null) {
      s.notify('时间格式看不懂，请用 13:30 这样的写法', 'warn', 'alert')
      return
    }
    s.updateItem(day.id, row.item.id, { plannedStart: mins })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`icard${isDragging ? ' icard--dragging' : ''}`}
      data-active={s.selectedId === point.id ? '1' : undefined}
      data-flash={flashId === point.id ? '1' : undefined}
      onClick={() => s.openDetail(point.id)}
      onPointerEnter={() => s.setHover(point.id)}
      onPointerLeave={() => s.setHover(null)}
    >
      {/* The number IS the handle. A separate grip under it added a second
          control, 34px of height the left column had nothing to fill with, and
          a faint glyph that read as a smudge — while the number is already the
          thing you are reordering. Drag stays off the card body: a card-wide
          drag fights the scroll on a phone. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="icard__seq"
        aria-label={`第 ${row.index + 1} 站「${point.name}」，拖动或用方向键调整顺序`}
        title="拖动调整顺序"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        {row.index + 1}
      </button>

      <div className="icard__col">
        <div className="icard__title">{point.name}</div>
        <div className="icard__meta">
          {cat && <span>{cat.name}</span>}
          {point.area && <span>{point.area}</span>}
          {point.rating > 0 && (
            <span className="rating">
              <Icon name="starSolid" size={11} />
              {point.rating.toFixed(1)}
            </span>
          )}
          {cost === 0 ? <span>免费</span> : cost != null ? <span>约 ¥{cost}</span> : null}
        </div>
        <div className="icard__meta">
          {row.item.reservationStatus === 'todo' && (
            <span className="tag tag--book">
              <Icon name="ticket" size={11} />
              待预约
            </span>
          )}
          {row.item.reservationStatus === 'done' && (
            <span className="tag tag--done">
              <Icon name="check" size={11} />
              已预约
            </span>
          )}
          {row.item.locked && (
            <span className="tag tag--lock">
              <Icon name="lock" size={11} />
              已锁定
            </span>
          )}
          {point.warn && (
            <span className="tag tag--book" title={point.warn}>
              <Icon name="alert" size={11} />
              注意
            </span>
          )}
        </div>
      </div>

      {/* On a phone these are text, not buttons: at this size they cannot reach
          44px without overlapping each other, and both actions are already in
          the ⋯ menu, which can. */}
      {/* Time and the ⋯ share a row so the right column is two lines, like the
          left one. Stacked, it was three lines tall and the card grew 51px of
          empty space beside the title. */}
      <div className="icard__side">
        <div className="icard__timerow">
          {desktop ? (
            <button type="button" className="icard__time icard__tbtn" onClick={(e) => (e.stopPropagation(), askArrival())} title="设定到达时间">
              {row.pinned && <Icon name="lock" size={10} className="icard__pin" />}
              {minutesToClock(row.arrive)}
            </button>
          ) : (
            <span className="icard__time">
              {row.pinned && <Icon name="lock" size={10} className="icard__pin" />}
              {minutesToClock(row.arrive)}
            </span>
          )}
          <button
            ref={menuBtn}
            type="button"
            className="wbtn wbtn--ghost wbtn--icon"
            aria-label={`「${point.name}」的更多操作`}
            onClick={(e) => {
              e.stopPropagation()
              setMenu(true)
            }}
          >
            <Icon name="sliders" size={15} />
          </button>
        </div>
        {desktop ? (
          <button type="button" className="icard__timesub icard__tbtn" onClick={(e) => (e.stopPropagation(), askDuration())} title="调整停留时间">
            停留 {formatDuration(row.stay)}
          </button>
        ) : (
          <span className="icard__timesub">停留 {formatDuration(row.stay)}</span>
        )}
      </div>

      <Pop anchor={menuBtn} open={menu} onClose={() => setMenu(false)} estHeight={300}>
        <PopHead>{point.name}</PopHead>
        <PopItem icon="hourglass" onClick={() => (setMenu(false), askDuration())}>
          停留时间（现在 {formatDuration(row.stay)}）
        </PopItem>
        <PopItem icon="clock" onClick={() => (setMenu(false), askArrival())}>
          {row.pinned ? '改到达时间' : '固定到达时间'}
        </PopItem>
        {point.booking && (
          <PopItem
            icon={row.item.reservationStatus === 'done' ? 'checkCircle' : 'ticket'}
            onClick={() => {
              s.updateItem(day.id, row.item.id, {
                reservationStatus: row.item.reservationStatus === 'done' ? 'todo' : 'done',
              })
              setMenu(false)
            }}
          >
            {row.item.reservationStatus === 'done' ? '标为未预约' : '标为已预约'}
          </PopItem>
        )}
        <PopItem
          icon={row.item.locked ? 'lockOpen' : 'lock'}
          onClick={() => {
            s.toggleLock(day.id, row.item.id)
            setMenu(false)
          }}
        >
          {row.item.locked ? '取消锁定' : '锁定，优化时不移动'}
        </PopItem>
        <PopItem
          icon="calendar"
          disabled={days.length < 2}
          onClick={() => {
            setMenu(false)
            setDayPick(true)
          }}
        >
          移到其他日期
        </PopItem>
        <PopItem
          icon="trash"
          tone="danger"
          onClick={() => {
            s.removeItem(day.id, row.item.id)
            setMenu(false)
          }}
        >
          从行程移除
        </PopItem>
      </Pop>

      <DayMenu
        anchor={menuBtn}
        open={dayPick}
        onClose={() => setDayPick(false)}
        days={days.filter((d) => d.id !== day.id)}
        onPick={(toId) => s.moveItemToDay(day.id, row.item.id, toId)}
      />
    </div>
  )
}

export function ItineraryView({ dialog, desktop }) {
  const s = useStore()
  const day = s.activeDay()
  const days = s.days
  const bodyRef = useRef(null)
  const [flashId, setFlashId] = useState(null)

  const sensors = useSensors(
    /* A few pixels of slop, or every tap on a card would start a drag and no
       card would ever open. */
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const timeline = useMemo(() => {
    if (!day) return null
    return buildTimeline(day.items, s.getPoint, {
      startMinutes: clockToMinutes(day.startTime) ?? 540,
      defaultStay: DEFAULT_STAY,
    })
  }, [day, s.points])

  /* Scroll to the card the map just asked for, and flash it. Driven by a
     counter rather than by the id, so clicking the same pin twice still works
     and unrelated re-renders never yank the list around. */
  useEffect(() => {
    if (!s.revealPointId) return
    const el = bodyRef.current?.querySelector(`[data-pid="${CSS_escape(s.revealPointId)}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlashId(s.revealPointId)
    const t = setTimeout(() => setFlashId(null), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.revealSeq])

  const onDragEnd = useCallback(
    (e) => {
      const { active, over } = e
      if (!over || active.id === over.id || !day) return
      const from = day.items.findIndex((it) => it.id === active.id)
      const to = day.items.findIndex((it) => it.id === over.id)
      if (from < 0 || to < 0) return
      s.reorderItems(day.id, from, to)
    },
    [day, s],
  )

  if (!day || !timeline) return null

  const f = formatDate(day.date)
  const stats = {
    count: day.items.length,
    metres: timeline.totalMetres,
    travel: timeline.totalTravel,
    stay: timeline.totalStay,
  }
  const costs = day.items.map((it) =>
    it.estimatedCost != null ? it.estimatedCost : pointCost(s.getPoint(it.pointId)),
  )
  const known = costs.filter((c) => c != null)
  const dayCost = known.reduce((a, b) => a + b, 0)
  const unknownCost = costs.length - known.length

  const areas = [...new Set(day.items.map((it) => s.getPoint(it.pointId)?.area).filter(Boolean))]
  const tooLong = timeline.totalMinutes > LONG_DAY_MIN
  const tooLate = timeline.endMinutes > LATE_END_MIN
  const spread = areas.length >= 4

  return (
    <>
      <header className="work__head">
        <div className="work__headrow">
          <div>
            <h1 className="work__title">{s.trip.title}</h1>
            <p className="work__sub">把每天的地点、路线和时间，放进同一张地图。</p>
          </div>
          <button
            type="button"
            className="wbtn wbtn--ghost wbtn--icon"
            onClick={() => s.setView('settings')}
            aria-label="行程设置"
          >
            <Icon name="sliders" size={17} />
          </button>
        </div>

        <div className="factline">
          <span>
            <b>{days.length}</b> 天
          </span>
          <i className="factline__sep" />
          <span>
            <b>{s.trip.travelers}</b> 人
          </span>
          <i className="factline__sep" />
          <span>
            <b>{days.reduce((n, d) => n + d.items.length, 0)}</b> 个地点
          </span>
          <i className="factline__sep" />
          <span>
            {formatDate(s.trip.startDate).md}–{formatDate(days[days.length - 1].date).md}
          </span>
        </div>

        <div className="daytabs" role="tablist" aria-label="选择日期">
          {days.map((d, i) => {
            const df = formatDate(d.date)
            return (
              <button
                key={d.id}
                role="tab"
                type="button"
                className="daytab"
                aria-selected={d.id === day.id}
                style={{ '--day-c': d.color }}
                onClick={() => s.setActiveDay(d.id)}
              >
                <span className="daytab__top">
                  <i className="daytab__swatch" />D{i + 1}
                  <span style={{ color: 'var(--tx-3)', fontWeight: 500 }}>{df.md}</span>
                </span>
                <span className="daytab__sub">
                  {d.title || df.weekday} · {d.items.length} 个
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className="daytab daytab__add"
            onClick={() => s.addDay()}
            aria-label="加一天"
            title="加一天"
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
      </header>

      <div className="work__body" ref={bodyRef}>
        <section className="card daysum" style={{ '--day-c': day.color }}>
          <div className="daysum__stats">
            <Stat v={stats.count} k="个地点" />
            <Stat v={formatDistance(stats.metres)} k="路程（估算）" />
            <Stat v={formatDuration(stats.travel)} k="在路上" />
            <Stat
              v={known.length ? `¥${dayCost}` : '—'}
              k={unknownCost ? `每人 · ${unknownCost} 项未知` : '每人估算'}
              title={unknownCost ? `${unknownCost} 个地点没有可解析的价格` : undefined}
            />
          </div>

          <div className="wrow" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--fs-sub)', color: 'var(--tx-2)' }}>
              <b style={{ color: 'var(--tx-1)', fontVariantNumeric: 'tabular-nums' }}>
                {day.startTime} – {minutesToClock(timeline.endMinutes)}
              </b>
              　游玩 {formatDuration(stats.stay)}
            </span>
            <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--tx-3)' }}>
              {f.full}
            </span>
          </div>

          {tooLong || tooLate ? (
            <Note tone="warn" icon="alert">
              这一天{tooLate ? `要到 ${minutesToClock(timeline.endMinutes)} 才结束` : ''}
              {tooLong && tooLate ? '，' : ''}
              {tooLong ? `连走带玩 ${formatDuration(timeline.totalMinutes)}` : ''}
              。可以移走 1–2 个地点，或把某一站的停留时间缩短。
            </Note>
          ) : null}
          {spread ? (
            <Note icon="mapPin">
              今天跨了 {areas.length} 个片区（{areas.slice(0, 3).join('、')}
              {areas.length > 3 ? ' 等' : ''}），路上时间会比看起来长。
            </Note>
          ) : null}

          <div className="wrow">
            {/* On a phone the same action is already pinned above the tab bar.
                Two identical primary buttons on one screen is not emphasis,
                it is a question about which one is the real one. */}
            {desktop && (
              <button type="button" className="wbtn wbtn--primary" onClick={() => s.setView('explore')}>
                <Icon name="plus" size={16} />
                添加地点
              </button>
            )}
            <button
              type="button"
              className={`wbtn${desktop ? '' : ' wbtn--primary'}`}
              disabled={day.items.length < 3}
              onClick={async () => {
                const ok = await dialog.confirm({
                  kicker: '优化顺序',
                  title: `重排 ${f.md} 的 ${day.items.length} 个地点？`,
                  body:
                    '按地点之间的直线距离重新排序，让路上少绕一些。它不知道营业时间、也不知道真实路况，' +
                    '所以只是一个起点。锁定的地点不会移动，结果可以撤销。',
                  confirmLabel: '优化',
                })
                if (ok) s.optimiseDay(day.id)
              }}
            >
              <Icon name="wand" size={16} />
              优化顺序
            </button>
            {s.canUndo() && (
              <button type="button" className="wbtn wbtn--ghost" onClick={s.undo}>
                <Icon name="undo" size={16} />
                撤销
              </button>
            )}
          </div>
        </section>

        {day.items.length === 0 ? (
          <Empty
            icon="calendar"
            title={`${f.md} 还没有安排`}
            action={
              <button type="button" className="wbtn wbtn--primary" onClick={() => s.setView('explore')}>
                去挑地点
              </button>
            }
          >
            从「探索」加几个地点进来，路线、时间和花费会自动算出来。
          </Empty>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={day.items.map((it) => it.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="itin">
                {timeline.rows.map((row) => (
                  <Fragment key={row.item.id}>
                    {row.index > 0 && (
                      <TransitLeg
                        row={row}
                        onMode={(mode) => s.updateItem(day.id, row.item.id, { transitMode: mode })}
                      />
                    )}
                    <div data-pid={row.point?.id}>
                      <ItemCard
                        row={row}
                        day={day}
                        days={days}
                        dialog={dialog}
                        flashId={flashId}
                        desktop={desktop}
                      />
                    </div>
                  </Fragment>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </>
  )
}

/* CSS.escape is not in older WebViews, and the ids here are our own
   `u1a2b3c` / seed slugs, so a conservative fallback is enough. */
function CSS_escape(v) {
  return typeof window !== 'undefined' && window.CSS?.escape
    ? window.CSS.escape(v)
    : String(v).replace(/["\\]/g, '\\$&')
}
