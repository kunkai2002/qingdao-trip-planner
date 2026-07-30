import { motion } from 'framer-motion'
import { Icon } from '../../icons/Icon.jsx'
import { StarMeter } from '../../icons/motionIcons.jsx'
import { GlassButton, GlassSurface } from '../Glass.jsx'
import { CATS, catColor } from '../../data/categories.js'
import { T } from '../../lib/motion.js'

function Field({ icon, label, children }) {
  return (
    <div className="kv">
      <span className="kv__icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="kv__body">
        <span className="kv__k">{label}</span>
        <span className="kv__v">{children}</span>
      </span>
    </div>
  )
}

export function DetailPanel({ point, onAddToRoute, onEdit, onDelete, inDraft }) {
  if (!point) return null
  const cat = CATS[point.cat] || CATS.sight
  const amap = `https://uri.amap.com/marker?position=${point.lng.toFixed(6)},${point.lat.toFixed(
    6,
  )}&name=${encodeURIComponent(point.name)}&src=qingdao-planner&coordinate=gaode`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={T.card}
      key={point.id}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          flexWrap: 'wrap',
          marginBottom: 2,
        }}
      >
        <span className="badge" style={{ '--badge-c': catColor(point.cat) }}>
          <Icon name={cat.icon} size={13} />
          {cat.name}
        </span>

        {point.rating > 0 && (
          <span className="rating">
            <span style={{ color: '#e8a318' }}>
              <StarMeter value={point.rating} size={13} />
            </span>
            <span className="rating__val">{point.rating.toFixed(1)}</span>
            {point.reviews > 0 && (
              <span className="rating__count">
                {point.reviews >= 1000
                  ? (point.reviews / 1000).toFixed(1) + 'k'
                  : point.reviews}{' '}
                条点评
              </span>
            )}
          </span>
        )}

        {point.booking && (
          <span className="badge badge--soft" style={{ '--badge-c': 'var(--warn)' }}>
            <Icon name="clock" size={13} />
            需预约 / 提前订
          </span>
        )}
      </div>

      {point.prices?.length > 0 && (
        <div className="prices">
          {point.prices.map(([k, v], i) => (
            <GlassSurface
              depth="thin"
              className="price"
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...T.card, delay: 0.04 + i * 0.035 }}
            >
              <span>
                <span className="price__k">{k}</span> <span className="price__v">{v}</span>
              </span>
            </GlassSurface>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {point.address && (
          <Field icon="mapPin" label="地址">
            {point.address}
            {point.area && <span className="rating__count"> · {point.area}</span>}
          </Field>
        )}
        {point.hours && (
          <Field icon="clock" label="营业时间">
            {point.hours}
          </Field>
        )}
        {point.tel && (
          <Field icon="phone" label="电话">
            <a href={`tel:${point.tel}`}>{point.tel}</a>
          </Field>
        )}
      </div>

      {point.note && (
        <div className="callout callout--info">
          <span className="callout__icon">
            <Icon name="info" size={16} />
          </span>
          <span>{point.note}</span>
        </div>
      )}
      {point.warn && (
        <div className="callout callout--warn">
          <span className="callout__icon">
            <Icon name="alert" size={16} />
          </span>
          <span>{point.warn}</span>
        </div>
      )}

      {point.tags?.length > 0 && (
        <div className="tags">
          {point.tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="actions">
        <GlassButton
          variant={inDraft ? 'default' : 'primary'}
          className="btn"
          onClick={() => onAddToRoute(point.id)}
          disabled={inDraft}
        >
          <Icon name={inDraft ? 'checkCircle' : 'plus'} size={17} />
          {inDraft ? '已在 DIY 路线中' : '加入 DIY 路线'}
        </GlassButton>
      </div>
      <div className="actions" style={{ marginTop: 8 }}>
        <GlassButton
          className="btn"
          title="在高德地图中打开这个位置"
          onClick={() => window.open(amap, '_blank', 'noopener')}
        >
          <Icon name="navigation" size={16} />
          导航
        </GlassButton>
        <GlassButton variant="quiet" className="btn" onClick={() => onEdit(point.id)}>
          <Icon name="pencil" size={16} />
          编辑
        </GlassButton>
        <GlassButton
          variant="quiet"
          className="btn btn--tight"
          onClick={() => onDelete(point.id)}
          title="删除这个点位"
          style={{ color: 'var(--bad)' }}
        >
          <Icon name="trash" size={16} />
        </GlassButton>
      </div>

      <p className="footnote">
        坐标为近似值，可在地图上直接拖动这个点位来修正位置，改动会自动保存在本机。
      </p>
    </motion.div>
  )
}
