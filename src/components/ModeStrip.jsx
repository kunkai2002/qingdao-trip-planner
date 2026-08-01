import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassButton } from './Glass.jsx'
import { SPRING, T } from '../lib/motion.js'

/**
 * ModeStrip — a persistent banner for the modes that change what a tap does.
 *
 * Add-mode and move-mode both silently reinterpret taps on the map, and the
 * only sign of either was inside a panel that is usually closed while you use
 * them. Arm add-mode, get distracted, come back, and the next tap drops a point
 * you did not want. Every mode now says it is on and offers a way out from
 * wherever you are.
 */
export function ModeStrip({ addMode, movingName, onExit }) {
  const mode = addMode
    ? {
        key: 'add',
        icon: 'pinPlus',
        text: '点击地图放置新点位',
        hint: '长按空白处也可以',
        exit: '取消',
      }
    : movingName
      ? {
          key: 'move',
          icon: 'gripDots',
          text: `正在调整「${movingName}」的位置`,
          hint: '拖动那个点位，其余地方仍可平移',
          exit: '完成',
        }
      : null

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          key={mode.key}
          className="glass glass--raised modestrip"
          initial={{ opacity: 0, y: -14, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -10, x: '-50%', transition: T.cardOut }}
          transition={SPRING.soft}
          role="status"
          aria-live="polite"
        >
          <span className="modestrip__icon">
            <Icon name={mode.icon} size={17} />
          </span>
          <span className="modestrip__body">
            <span className="modestrip__text">{mode.text}</span>
            <span className="modestrip__hint">{mode.hint}</span>
          </span>
          <GlassButton depth="thin" className="modestrip__exit" onClick={onExit}>
            {mode.exit}
          </GlassButton>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
