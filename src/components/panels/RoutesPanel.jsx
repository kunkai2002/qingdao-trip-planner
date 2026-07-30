import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../icons/Icon.jsx'
import { GlassButton, GlassCard } from '../Glass.jsx'
import { Segmented } from '../Segmented.jsx'
import { SectionTitle } from '../Panel.jsx'
import { CATS, catColor } from '../../data/categories.js'
import { walkMinutes } from '../../lib/geo.js'
import { T, SPRING } from '../../lib/motion.js'

function Summary({ count, km }) {
  return (
    <div className="summary">
      <Icon name="routePath" size={13} />
      共 {count} 站
      <span aria-hidden="true">·</span>
      <Icon name="arrowsHorizontal" size={13} />
      直线约 {km.toFixed(1)} km
      {km > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <Icon name="clock" size={13} />
          步行约 {walkMinutes(km)} 分
        </>
      )}
    </div>
  )
}

export function RoutesPanel({
  myRoutes,
  presetRoutes,
  activeRouteId,
  activeRoute,
  diyMode,
  draftStops,
  getPoint,
  distanceOf,
  onShowRoute,
  onClearRoute,
  onDeleteRoute,
  onStartDiy,
  onExitDiy,
  onRemoveDraft,
  onSaveDraft,
  onOpenDetail,
}) {
  const groups = useMemo(() => {
    const byGroup = { 我的: myRoutes }
    presetRoutes.forEach((r) => {
      ;(byGroup[r.group] = byGroup[r.group] || []).push(r)
    })
    return byGroup
  }, [myRoutes, presetRoutes])

  const options = [
    { value: '按天', label: '按天', icon: 'calendar', count: groups['按天']?.length || 0 },
    { value: '主题', label: '主题', icon: 'sparkles', count: groups['主题']?.length || 0 },
    { value: '我的', label: '我的', icon: 'bookmark', count: myRoutes.length },
  ]

  const [tab, setTab] = useState('按天')
  const list = groups[tab] || []

  const draftKm = distanceOf(draftStops)
  const activeKm = activeRoute ? distanceOf(activeRoute.stops) : 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T.card}>
      {/* -------- DIY --------
          A keyed fade rather than AnimatePresence mode="wait": the two states
          replace each other, and the new one must never wait on the old one's
          exit animation to appear. */}
      <div>
        {diyMode ? (
          <motion.div
            key="diy-on"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.soft}
          >
            <div className="callout callout--good">
              <span className="callout__icon">
                <Icon name="routePath" size={16} />
              </span>
              <span>
                正在自建路线：依次点击地图上的点位加入。已选 <b>{draftStops.length}</b> 个。
              </span>
            </div>

            {draftStops.length > 0 && (
              <>
                <div className="stops">
                  <AnimatePresence initial={false}>
                    {draftStops.map((id, i) => {
                      const p = getPoint(id)
                      if (!p) return null
                      return (
                        <motion.div
                          className="stop"
                          key={id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12, height: 0 }}
                          transition={SPRING.soft}
                          layout
                        >
                          <span className="stop__idx">{i + 1}</span>
                          <span className="stop__body">
                            <button
                              type="button"
                              className="stop__name"
                              onClick={() => onOpenDetail(id)}
                            >
                              {p.name}
                            </button>
                            <span className="stop__meta">
                              {CATS[p.cat]?.name}
                              {p.area ? ` · ${p.area}` : ''}
                            </span>
                          </span>
                          <span className="stop__tail">
                            <button
                              type="button"
                              className="row__icon"
                              onClick={() => onRemoveDraft(i)}
                              title="从路线移除"
                              aria-label="从路线移除"
                            >
                              <Icon name="close" size={15} />
                            </button>
                          </span>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
                <Summary count={draftStops.length} km={draftKm} />
              </>
            )}

            <div className="actions">
              <GlassButton
                variant="primary"
                className="btn"
                onClick={onSaveDraft}
                disabled={draftStops.length < 2}
              >
                <Icon name="bookmark" size={16} />
                保存这条路线
              </GlassButton>
              <GlassButton variant="quiet" className="btn" onClick={onExitDiy}>
                退出自建
              </GlassButton>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="diy-off"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.soft}
          >
            <div className="actions" style={{ marginTop: 4 }}>
              <GlassButton variant="primary" className="btn" onClick={onStartDiy}>
                <Icon name="routePath" size={17} />
                开始自建路线
              </GlassButton>
            </div>
          </motion.div>
        )}
      </div>

      {/* -------- route lists -------- */}
      <SectionTitle icon="compass">攻略路线</SectionTitle>
      <Segmented options={options} value={tab} onChange={setTab} id="routes" />

      {list.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="bookmark" size={22} />
          </span>
          <div>
            这里还没有路线。
            <br />
            点上面的「开始自建路线」串一条属于你的。
          </div>
        </div>
      ) : (
        list.map((r, i) => {
          const active = activeRouteId === r.id
          const mine = r.group === '我的'
          return (
            <GlassCard
              className={`row ${active ? 'row--active' : ''}`}
              key={r.id}
              index={i}
              style={{ '--row-c': r.color || 'var(--accent)' }}
              onClick={() => (active ? onClearRoute() : onShowRoute(r.id))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  active ? onClearRoute() : onShowRoute(r.id)
                }
              }}
            >
              <span className="row__lead">
                <Icon name={r.icon || 'routePath'} size={17} />
              </span>
              <span className="row__body">
                <span className="row__name">{r.name}</span>
                <span className="row__meta">
                  {r.stops.length} 站 · 直线约 {distanceOf(r.stops).toFixed(1)} km
                  {mine ? ' · 自建' : ''}
                </span>
              </span>
              <span className="row__tail">
                {mine && (
                  <button
                    type="button"
                    className="row__icon"
                    title="删除这条自建路线"
                    aria-label="删除这条自建路线"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteRoute(r.id)
                    }}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                )}
                <span className="row__go">
                  {active ? (
                    <>
                      <Icon name="check" size={13} />
                      显示中
                    </>
                  ) : (
                    <>
                      查看
                      <Icon name="chevronRight" size={13} />
                    </>
                  )}
                </span>
              </span>
            </GlassCard>
          )
        })
      )}

      {/* -------- active route stops -------- */}
      <AnimatePresence initial={false}>
        {activeRoute && (
          <motion.div
            key={activeRoute.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING.soft}
          >
            <SectionTitle icon="listChecks">「{activeRoute.name}」站点顺序</SectionTitle>
            <div className="stops">
              {activeRoute.stops.map((id, i) => {
                const p = getPoint(id)
                if (!p) return null
                return (
                  <div className="stop" key={id + i}>
                    <span
                      className={`stop__idx ${p.booking ? 'stop__idx--warn' : ''}`}
                      title={p.booking ? '需提前预约' : undefined}
                    >
                      {i + 1}
                    </span>
                    <span className="stop__body">
                      <button type="button" className="stop__name" onClick={() => onOpenDetail(id)}>
                        {p.name}
                      </button>
                      <span className="stop__meta">
                        <span style={{ color: catColor(p.cat) }}>{CATS[p.cat]?.name}</span>
                        {p.area ? ` · ${p.area}` : ''}
                        {p.prices?.[0] ? ` · ${p.prices[0][1]}` : ''}
                      </span>
                    </span>
                    <span className="stop__tail">
                      <button
                        type="button"
                        className="row__icon"
                        onClick={() => onOpenDetail(id)}
                        title="查看详情"
                        aria-label="查看详情"
                      >
                        <Icon name="chevronRight" size={15} />
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
            <Summary count={activeRoute.stops.length} km={activeKm} />
            <div className="actions">
              <GlassButton variant="quiet" className="btn" onClick={onClearRoute}>
                <Icon name="eyeOff" size={16} />
                收起这条路线
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
