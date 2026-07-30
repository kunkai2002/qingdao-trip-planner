import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassSurface, GlassButton } from './Glass.jsx'
import { T, SPRING } from '../lib/motion.js'

const THEME_ICON = { auto: 'layers', light: 'sun', dark: 'moon' }
const THEME_LABEL = {
  auto: '地图外观：跟随系统',
  light: '地图外观：浅色',
  dark: '地图外观：深色',
}

export function TopBar({
  query,
  onQuery,
  onMenu,
  theme,
  onTheme,
  resultCount,
  filtering,
  children,
}) {
  return (
    <div className="topbar">
      <div className="topbar__row">
        <GlassSurface
          className="brand"
          drift
          aria-label="青岛一图流 · 行程规划器"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={T.card}
        >
          <span className="brand__mark" aria-hidden="true">
            <Icon name="brandMark" size={19} />
          </span>
          <span className="brand__text">
            <span className="brand__title">青岛一图流</span>
            <span className="brand__sub">点位可拖动 · 长按空白加点</span>
          </span>
        </GlassSurface>

        <GlassSurface
          className="search"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...T.card, delay: 0.05 }}
        >
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="搜索景点 / 餐厅 / 酒店 / 片区"
            autoComplete="off"
            spellCheck="false"
            aria-label="搜索点位"
          />
          <AnimatePresence>
            {filtering && (
              <motion.span
                key="count"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={T.hover}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {resultCount} 个
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {query && (
              <motion.button
                key="clear"
                type="button"
                className="search__clear"
                aria-label="清除搜索"
                onClick={() => onQuery('')}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                whileTap={{ scale: 0.88 }}
                transition={SPRING.press}
              >
                <Icon name="close" size={13} />
              </motion.button>
            )}
          </AnimatePresence>
        </GlassSurface>

        <GlassButton
          className="iconbtn"
          onClick={onTheme}
          title={THEME_LABEL[theme]}
          aria-label={THEME_LABEL[theme]}
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...T.card, delay: 0.1 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ opacity: 0, rotate: -35, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 35, scale: 0.8 }}
              transition={T.hover}
              style={{ display: 'grid', placeItems: 'center' }}
            >
              <Icon name={THEME_ICON[theme]} size={19} />
            </motion.span>
          </AnimatePresence>
        </GlassButton>

        <GlassButton
          className="iconbtn"
          onClick={onMenu}
          title="菜单与数据"
          aria-label="菜单与数据"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...T.card, delay: 0.14 }}
        >
          <Icon name="sliders" size={19} />
        </GlassButton>
      </div>
      {children}
    </div>
  )
}
