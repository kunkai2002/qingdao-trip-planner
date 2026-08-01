import { useStore } from '../../store/useStore.js'
import { Empty, SectionHead } from './bits.jsx'
import { PlaceCard } from './PlaceCard.jsx'

/* 收藏 is the shortlist: places you want but have not committed to a day.
   Splitting the list on that line is the whole point — a starred place that is
   already scheduled is no longer a decision you owe yourself. */
export function SavedView() {
  const s = useStore()
  const saved = s.savedIds.map((id) => s.getPoint(id)).filter(Boolean)
  const undecided = saved.filter((p) => !s.isScheduled(p.id))
  const scheduled = saved.filter((p) => s.isScheduled(p.id))

  return (
    <>
      <header className="work__head">
        <div className="work__headrow">
          <div>
            <h1 className="work__title">收藏</h1>
            <p className="work__sub">
              {saved.length ? `${saved.length} 个，其中 ${undecided.length} 个还没排进行程` : '还没有收藏'}
            </p>
          </div>
        </div>
      </header>

      <div className="work__body">
        {saved.length === 0 ? (
          <Empty
            icon="star"
            title="还没有收藏"
            action={
              <button type="button" className="wbtn wbtn--primary" onClick={() => s.setView('explore')}>
                去探索
              </button>
            }
          >
            在「探索」里看到想去的地方，点一下收藏，先存着，晚点再决定放哪天。
          </Empty>
        ) : (
          <>
            {undecided.length > 0 && (
              <section>
                <SectionHead title="还没安排" meta={`${undecided.length} 个`} />
                <div className="stack">
                  {undecided.map((p, i) => (
                    <PlaceCard key={p.id} point={p} index={i} />
                  ))}
                </div>
              </section>
            )}
            {scheduled.length > 0 && (
              <section>
                <SectionHead title="已在行程里" meta={`${scheduled.length} 个`} />
                <div className="stack">
                  {scheduled.map((p, i) => (
                    <PlaceCard key={p.id} point={p} index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
