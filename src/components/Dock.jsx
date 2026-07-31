import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassButton } from './Glass.jsx'
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

/* The zoom +/- pair was removed: scroll, pinch and double-tap all already
   zoom, so it was three ways to do one thing and made the dock a tall stack. */
export function Dock({
  onFit,
  onLocate,
  locating,
  located,
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
      <DockButton
        className={`dock__btn ${located ? 'dock__btn--located' : ''}`}
        onClick={onLocate}
        title="定位到我的位置"
        aria-label="定位到我的位置"
        aria-busy={locating || undefined}
        delay={0.03}
      >
        <motion.span
          style={{ display: 'grid', placeItems: 'center' }}
          animate={locating ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
          transition={locating ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
        >
          <Icon name="navigation" size={20} />
        </motion.span>
      </DockButton>

      <DockButton
        className="dock__btn"
        onClick={onFit}
        title="复位到全部点位"
        aria-label="复位到全部点位"
        delay={0.06}
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
