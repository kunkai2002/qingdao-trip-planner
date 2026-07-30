import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '../../icons/Icon.jsx'
import { DrawCheck } from '../../icons/motionIcons.jsx'
import { GlassButton } from '../Glass.jsx'
import { SectionTitle } from '../Panel.jsx'
import { T, SPRING, EASE_OUT } from '../../lib/motion.js'

export function ChecklistPanel({ groups, onToggle, onAdd, onDelete, onReset }) {
  const reduced = useReducedMotion()
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const done = groups.reduce((n, g) => n + g.items.filter((i) => i.done).length, 0)
  const pct = total ? done / total : 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T.card}>
      <div className="callout callout--good" style={{ marginTop: 4 }}>
        <span className="callout__icon">
          <Icon name={done === total && total > 0 ? 'checkCircle' : 'listChecks'} size={16} />
        </span>
        <span style={{ flex: 1 }}>
          <div className="meter">
            <span className="meter__track">
              <motion.span
                className="meter__fill"
                initial={{ width: 0 }}
                animate={{ width: `${pct * 100}%` }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              />
            </span>
            <span className="meter__val">
              {done} / {total}
            </span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            勾选状态自动保存在本机浏览器
          </span>
        </span>
      </div>

      {groups.map((g, gi) => (
        <div key={g.title}>
          <SectionTitle icon={g.icon}>
            {g.title}
            {g.subtitle ? `（${g.subtitle}）` : ''}
          </SectionTitle>

          <AnimatePresence initial={false}>
            {g.items.map((it, ii) => (
              <motion.label
                className={`check ${it.done ? 'check--done' : ''}`}
                key={it.text}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                transition={SPRING.soft}
                layout
              >
                <input
                  type="checkbox"
                  className="sronly"
                  checked={it.done}
                  onChange={() => onToggle(gi, ii)}
                />
                <motion.span
                  className="check__box"
                  whileTap={reduced ? undefined : { scale: 0.88 }}
                  transition={SPRING.press}
                >
                  <AnimatePresence>{it.done && <DrawCheck reduced={reduced} />}</AnimatePresence>
                </motion.span>
                <span className="check__text">{it.text}</span>
                {it.custom && (
                  <button
                    type="button"
                    className="check__del"
                    title="删除这条备忘"
                    aria-label="删除这条备忘"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDelete(gi, ii)
                    }}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </motion.label>
            ))}
          </AnimatePresence>

          <button type="button" className="textlink" onClick={() => onAdd(gi)}>
            <Icon name="plus" size={14} />
            往「{g.title}」加一条
          </button>
        </div>
      ))}

      <div className="actions">
        <GlassButton variant="quiet" className="btn" onClick={onReset}>
          <Icon name="refresh" size={16} />
          重置整份清单
        </GlassButton>
      </div>
    </motion.div>
  )
}
