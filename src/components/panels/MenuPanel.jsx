import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../icons/Icon.jsx'
import { GlassButton, GlassCard } from '../Glass.jsx'
import { Segmented } from '../Segmented.jsx'
import { SectionTitle } from '../Panel.jsx'
import { CATS, CAT_ORDER, catColor } from '../../data/categories.js'
import { T } from '../../lib/motion.js'

const THEME_OPTIONS = [
  { value: 'auto', label: '跟随系统', icon: 'layers' },
  { value: 'light', label: '浅色', icon: 'sun' },
  { value: 'dark', label: '深色', icon: 'moon' },
]

const BASEMAP_OPTIONS = [
  { value: 'road', label: '街道图', icon: 'routePath' },
  { value: 'satellite', label: '卫星图', icon: 'layers' },
]

export function MenuPanel({
  points,
  myRoutes,
  counts,
  theme,
  onTheme,
  basemap,
  onBasemap,
  onExport,
  onImport,
  onReset,
  onOpenDetail,
  onReplayIntro,
}) {
  const fileRef = useRef(null)
  const booking = points.filter((p) => p.booking)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T.card}>
      <div className="callout callout--info" style={{ marginTop: 4 }}>
        <span className="callout__icon">
          <Icon name="database" size={16} />
        </span>
        <span>
          共 <b>{points.length}</b> 个点位、<b>{myRoutes.length}</b> 条自建路线。所有修改只保存在这台设备的浏览器里，不会上传。
        </span>
      </div>

      <SectionTitle icon="layers">图层统计</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CAT_ORDER.map((k) => (
          <span
            className="badge badge--soft"
            key={k}
            style={{ '--badge-c': catColor(k), paddingLeft: 7 }}
          >
            <Icon name={CATS[k].icon} size={13} />
            {CATS[k].name} {counts[k] || 0}
          </span>
        ))}
      </div>

      <SectionTitle icon="sun">外观</SectionTitle>
      <Segmented options={THEME_OPTIONS} value={theme} onChange={onTheme} id="theme" />

      <SectionTitle icon="layers">底图</SectionTitle>
      <Segmented options={BASEMAP_OPTIONS} value={basemap} onChange={onBasemap} id="basemap" />

      <SectionTitle icon="clock">
        需预约 / 提前订
        <span style={{ marginLeft: 4, color: 'var(--warn)' }}>{booking.length}</span>
      </SectionTitle>
      {booking.map((p, i) => (
        <GlassCard
          className="row"
          key={p.id}
          index={i}
          style={{ '--row-c': 'var(--warn)' }}
          onClick={() => onOpenDetail(p.id)}
          role="button"
          tabIndex={0}
        >
          <span className="row__lead">
            <Icon name="alert" size={17} />
          </span>
          <span className="row__body">
            <span className="row__name">{p.name}</span>
            <span className="row__meta">{p.warn || p.note || CATS[p.cat]?.name}</span>
          </span>
          <span className="row__tail">
            <Icon name="chevronRight" size={16} />
          </span>
        </GlassCard>
      ))}

      <SectionTitle icon="database">数据</SectionTitle>
      <div className="actions" style={{ marginTop: 0 }}>
        <GlassButton variant="primary" className="btn" onClick={onExport}>
          <Icon name="download" size={16} />
          导出备份
        </GlassButton>
        <GlassButton className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={16} />
          导入备份
        </GlassButton>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="sronly"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onImport(f)
          e.target.value = ''
        }}
      />
      <div className="actions" style={{ marginTop: 8 }}>
        <GlassButton variant="quiet" className="btn" onClick={onReplayIntro}>
          <Icon name="info" size={16} />
          再看一次用法
        </GlassButton>
        <GlassButton variant="quiet" className="btn" onClick={onReset}>
          <Icon name="refresh" size={16} />
          恢复默认数据
        </GlassButton>
      </div>

      <p className="footnote">
        数据源：携程 / Tripadvisor 点评均值 + 官方渠道。人均为非官方牌价，国庆期间普遍上浮；点位坐标为近似值，可拖动修正。
        换设备时先「导出备份」把 JSON 发给自己，再在新设备「导入备份」。
      </p>
    </motion.div>
  )
}
