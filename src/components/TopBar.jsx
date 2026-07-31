import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { GlassSurface, GlassButton } from './Glass.jsx'
import { CATS, catColor } from '../data/categories.js'
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
  results = [],
  onPick,
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

        <div className="searchwrap">
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

        {/* Filtering the map alone is not search: if the only match sits off
            screen the user sees an unchanged map and assumes nothing matched.
            Every major map app answers a query with a LIST. */}
        <AnimatePresence>
          {filtering && (
            <motion.div
              className="glass glass--raised results"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99, transition: { duration: 0.14 } }}
              transition={T.card}
              role="listbox"
              aria-label="搜索结果"
            >
              {results.length === 0 ? (
                <div className="results__empty">
                  <Icon name="search" size={18} />
                  <span>
                    没有匹配「{query}」的点位
                    <br />
                    试试片区名，例如「五四广场」「台东」
                  </span>
                </div>
              ) : (
                <div className="results__list scroller">
                  {results.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="results__row"
                      onClick={() => onPick(p.id)}
                    >
                      <span
                        className="results__icon"
                        style={{ '--row-c': catColor(p.cat) }}
                      >
                        <Icon name={CATS[p.cat]?.icon} size={15} />
                      </span>
                      <span className="results__body">
                        <span className="results__name">{p.name}</span>
                        <span className="results__meta">
                          {CATS[p.cat]?.name}
                          {p.area ? ` · ${p.area}` : ''}
                          {p.prices?.[0] ? ` · ${p.prices[0][1]}` : ''}
                        </span>
                      </span>
                      {p.rating > 0 && <span className="results__rating">{p.rating.toFixed(1)}</span>}
                      <Icon name="chevronRight" size={14} />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>

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
