import { useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { CATS, CAT_ORDER } from '../../data/categories.js'
import { THEME_ROUTES, pointCost } from '../../data/trip.js'
import { runSearch } from '../../lib/search.js'
import { haversine } from '../../lib/geo.js'
import { Icon } from '../../icons/Icon.jsx'
import { DayMenu, Empty, SectionHead } from './bits.jsx'
import { PlaceCard } from './PlaceCard.jsx'

/* ============================================================
   探索 — browsing places as a list, not as pins.

   The map is good at "where"; it is bad at "which of these is worth a morning".
   That question needs the rating, the price and the caveat side by side, which
   is a list.

   The filters offered are exactly the ones the data can answer. 室内/室外 and
   「适合什么时段」 would be useful and are in no field we have — inventing them
   from the notes would produce confident nonsense, so they are absent rather
   than guessed.
   ============================================================ */

const SORTS = [
  { key: 'match', label: '推荐' },
  { key: 'rating', label: '评分' },
  { key: 'cheap', label: '价格低' },
  { key: 'near', label: '离当天近' },
]

export function ExploreView() {
  const s = useStore()
  const [cats, setCats] = useState([])
  const [area, setArea] = useState('')
  const [flags, setFlags] = useState({ free: false, booking: false, unplanned: false, top: false })
  const [sort, setSort] = useState('match')
  const themeBtn = useRef(null)
  const [themePick, setThemePick] = useState(null)

  const search = useMemo(() => runSearch(s), [s.points, s.enabled, s.query])
  const base = search.query ? search.matched : s.points

  const areas = useMemo(
    () => [...new Set(s.points.map((p) => p.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh')),
    [s.points],
  )

  const day = s.activeDay()
  const anchor = useMemo(() => {
    const first = day?.items.map((it) => s.getPoint(it.pointId)).find(Boolean)
    return first ? [first.lat, first.lng] : null
  }, [day, s.points])

  const list = useMemo(() => {
    let out = base.filter((p) => {
      if (cats.length && !cats.includes(p.cat)) return false
      if (area && p.area !== area) return false
      if (flags.free && pointCost(p) !== 0) return false
      if (flags.booking && !p.booking) return false
      if (flags.unplanned && s.isScheduled(p.id)) return false
      if (flags.top && !(p.rating >= 4.5)) return false
      return true
    })
    if (sort === 'rating') out = [...out].sort((a, b) => (b.rating || 0) - (a.rating || 0))
    else if (sort === 'cheap') {
      /* Places with no parsable price sink to the bottom rather than pretending
         to be free — an unknown price is not a cheap one. */
      const v = (p) => {
        const c = pointCost(p)
        return c == null ? Number.POSITIVE_INFINITY : c
      }
      out = [...out].sort((a, b) => v(a) - v(b))
    } else if (sort === 'near' && anchor) {
      out = [...out].sort(
        (a, b) => haversine(anchor, [a.lat, a.lng]) - haversine(anchor, [b.lat, b.lng]),
      )
    }
    return out
  }, [base, cats, area, flags, sort, anchor, s.days, s.points])

  const counts = useMemo(() => {
    const c = {}
    for (const p of base) c[p.cat] = (c[p.cat] || 0) + 1
    return c
  }, [base])

  const toggleCat = (k) => setCats((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
  const toggleFlag = (k) => setFlags((f) => ({ ...f, [k]: !f[k] }))
  const anyFilter = cats.length || area || Object.values(flags).some(Boolean) || s.query

  return (
    <>
      <header className="work__head">
        <div className="work__headrow">
          <div>
            <h1 className="work__title">探索</h1>
            <p className="work__sub">{s.points.length} 个地点，挑好了加到某一天。</p>
          </div>
        </div>

        <div className="searchwrap">
          <Icon name="search" size={16} className="searchwrap__icon" />
          <input
            className="field field--icon"
            value={s.query}
            onChange={(e) => s.setQuery(e.target.value)}
            placeholder="搜地点、片区、分类，例如 海鲜、八大关、酒店"
            aria-label="搜索地点"
          />
          {s.query && (
            <button
              type="button"
              className="wbtn wbtn--ghost wbtn--icon searchwrap__clear"
              onClick={() => s.setQuery('')}
              aria-label="清空搜索"
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        <div className="wrow" style={{ marginTop: 'var(--sp-2)', gap: 6 }}>
          {CAT_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              className="chipx"
              aria-pressed={cats.includes(k)}
              onClick={() => toggleCat(k)}
            >
              <Icon name={CATS[k].icon} size={13} />
              {CATS[k].name}
              <span className="chipx__n">{counts[k] || 0}</span>
            </button>
          ))}
        </div>

        <div className="wrow" style={{ marginTop: 6, gap: 6 }}>
          <button type="button" className="chipx" aria-pressed={flags.unplanned} onClick={() => toggleFlag('unplanned')}>
            未安排
          </button>
          <button type="button" className="chipx" aria-pressed={flags.free} onClick={() => toggleFlag('free')}>
            免费
          </button>
          <button type="button" className="chipx" aria-pressed={flags.top} onClick={() => toggleFlag('top')}>
            4.5 分以上
          </button>
          <button type="button" className="chipx" aria-pressed={flags.booking} onClick={() => toggleFlag('booking')}>
            需预约
          </button>
        </div>

        <div className="wrow" style={{ marginTop: 6, gap: 6 }}>
          <select
            className="field field--sm"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            aria-label="按片区筛选"
          >
            <option value="">全部片区</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className="field field--sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="排序方式"
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key} disabled={o.key === 'near' && !anchor}>
                {o.label}
              </option>
            ))}
          </select>
          {anyFilter ? (
            <button
              type="button"
              className="wbtn wbtn--ghost wbtn--sm"
              onClick={() => {
                setCats([])
                setArea('')
                setFlags({ free: false, booking: false, unplanned: false, top: false })
                s.setQuery('')
              }}
            >
              清除筛选
            </button>
          ) : null}
        </div>
      </header>

      <div className="work__body">
        {/* Themed routes are not days and never became days — they are a way to
            drop a curated set into whichever day you pick. */}
        {!anyFilter && (
          <section>
            <SectionHead title="主题线路" meta={`${THEME_ROUTES.length} 条`} />
            <div className="wrow" style={{ gap: 6 }}>
              {THEME_ROUTES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="wbtn wbtn--sm"
                  ref={themePick === r.id ? themeBtn : undefined}
                  onClick={(e) => {
                    themeBtn.current = e.currentTarget
                    setThemePick(r.id)
                  }}
                >
                  <Icon name={r.icon} size={14} />
                  {r.name}
                  <span style={{ color: 'var(--tx-3)' }}>{r.stops.length}</span>
                </button>
              ))}
            </div>
            <DayMenu
              anchor={themeBtn}
              open={!!themePick}
              onClose={() => setThemePick(null)}
              days={s.days}
              onPick={(dayId) => {
                const r = THEME_ROUTES.find((x) => x.id === themePick)
                r?.stops.forEach((pid) => s.addToDay(dayId, pid))
              }}
            />
          </section>
        )}

        <section>
          <SectionHead title={anyFilter ? '筛选结果' : '全部地点'} meta={`${list.length} 个`} />
          {list.length === 0 ? (
            <Empty icon="search" title="没有符合条件的地点">
              放宽一点筛选，或换个关键词试试。
            </Empty>
          ) : (
            <div className="stack">
              {list.map((p, i) => (
                <PlaceCard key={p.id} point={p} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
