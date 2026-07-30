import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassSurface, GlassButton } from './Glass.jsx'
import { T, SPRING } from '../lib/motion.js'

function Badge({ value }) {
  return (
    <AnimatePresence>
      {value > 0 && (
        <motion.span
          className="dock__badge"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, rotate: [0, -7, 6, 0] }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ ...SPRING.press, rotate: { duration: 0.44, ease: 'easeOut' } }}
        >
          {value > 99 ? '99+' : value}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/** A dock button plus an optional badge, wrapped so the badge is not clipped. */
function DockButton({ badge, delay = 0, children, ...rest }) {
  return (
    <motion.div
      style={{ position: 'relative' }}
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...T.card, delay }}
    >
      <GlassButton {...rest}>{children}</GlassButton>
      {badge != null && <Badge value={badge} />}
    </motion.div>
  )
}

export function Dock({
  onZoomIn,
  onZoomOut,
  onFit,
  onChecklist,
  onRoutes,
  onAdd,
  addArmed,
  diyActive,
  pendingChecks,
  draftCount,
}) {
  return (
    <div className="dock">
      <GlassSurface
        depth="thin"
        style={{ '--radius': '17px', overflow: 'hidden', width: 50 }}
        initial={{ opacity: 0, y: 16, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...T.card, delay: 0.06 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <GlassButton
            depth="thin"
            lift={false}
            onClick={onZoomIn}
            title="放大"
            aria-label="放大"
            style={{
              width: 50,
              height: 42,
              borderRadius: 0,
              background: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              boxShadow: 'none',
              color: 'var(--ink-2)',
            }}
          >
            <Icon name="plus" size={18} />
          </GlassButton>
          <span
            aria-hidden="true"
            style={{ height: 1, margin: '0 10px', background: 'var(--g-hairline)' }}
          />
          <GlassButton
            depth="thin"
            lift={false}
            onClick={onZoomOut}
            title="缩小"
            aria-label="缩小"
            style={{
              width: 50,
              height: 42,
              borderRadius: 0,
              background: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              boxShadow: 'none',
              color: 'var(--ink-2)',
            }}
          >
            <Icon name="minus" size={18} />
          </GlassButton>
        </div>
      </GlassSurface>

      <DockButton
        className="dock__btn"
        onClick={onFit}
        title="复位到全部点位"
        aria-label="复位到全部点位"
        delay={0.1}
      >
        <Icon name="target" size={21} />
      </DockButton>

      <DockButton
        className="dock__btn"
        onClick={onChecklist}
        title="证件与备忘清单"
        aria-label="证件与备忘清单"
        badge={pendingChecks}
        delay={0.14}
      >
        <Icon name="clipboardCheck" size={21} />
      </DockButton>

      <DockButton
        className={`dock__btn ${diyActive ? 'dock__btn--armed' : ''}`}
        onClick={onRoutes}
        title="攻略路线"
        aria-label="攻略路线"
        badge={diyActive ? draftCount : null}
        delay={0.18}
      >
        <Icon name="compass" size={21} />
      </DockButton>

      <DockButton
        className={`dock__btn dock__btn--main ${addArmed ? 'dock__btn--armed' : ''}`}
        variant={addArmed ? 'default' : 'primary'}
        onClick={onAdd}
        title={addArmed ? '取消新增' : '新增点位'}
        aria-label={addArmed ? '取消新增' : '新增点位'}
        delay={0.22}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={addArmed ? 'x' : '+'}
            initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
            transition={SPRING.press}
            style={{ display: 'grid', placeItems: 'center' }}
          >
            <Icon name={addArmed ? 'close' : 'pinPlus'} size={24} />
          </motion.span>
        </AnimatePresence>
      </DockButton>
    </div>
  )
}
