import { Icon } from '../../icons/Icon.jsx'

/* ============================================================
   Primary navigation.

   Five destinations and nothing else. The old build put 定位 / 复位 / 清单 /
   路线 / 新增点位 in one vertical stack of floating buttons, which mixed
   "where am I in the app" with "do a thing to the map" — so neither read as
   either. Actions now live next to the thing they act on; this is only for
   moving between sections.
   ============================================================ */

export const NAV = [
  { key: 'overview', label: '总览', icon: 'home' },
  { key: 'itinerary', label: '行程', icon: 'calendar' },
  { key: 'explore', label: '探索', icon: 'compass' },
  { key: 'saved', label: '收藏', icon: 'star' },
  { key: 'checklist', label: '清单', icon: 'clipboardCheck' },
]

/** Phones get four, and one of them is the map — which on desktop is simply
    always on screen and therefore not a destination at all. */
export const TABS = [
  { key: 'itinerary', label: '行程', icon: 'calendar' },
  { key: 'map', label: '地图', icon: 'mapPin' },
  { key: 'explore', label: '探索', icon: 'compass' },
  { key: 'settings', label: '我的', icon: 'sliders' },
]

export function Rail({ view, onView, pendingChecks, mini, onToggleMini, theme, onTheme }) {
  return (
    <nav className="rail" aria-label="主导航">
      <span className="rail__brand" aria-hidden="true">
        <Icon name="brandMark" size={22} />
      </span>

      <div className="rail__nav">
        {NAV.map((n) => (
          <button
            key={n.key}
            type="button"
            className="railbtn"
            aria-current={view === n.key ? 'page' : undefined}
            title={mini ? n.label : undefined}
            onClick={() => onView(n.key)}
          >
            <Icon name={n.icon} size={20} />
            <span className="railbtn__label">{n.label}</span>
            {n.key === 'checklist' && pendingChecks > 0 && (
              <span className="railbtn__dot" aria-hidden="true">
                {pendingChecks > 99 ? '99+' : pendingChecks}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Settings, theme and the rail's own width sit at the bottom: they are
          not part of planning a trip and should not compete with what is. */}
      <div className="rail__foot">
        <button
          type="button"
          className="railbtn"
          onClick={onTheme}
          title={`地图外观：${{ auto: '跟随系统', light: '浅色', dark: '深色' }[theme]}`}
        >
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={20} />
          <span className="railbtn__label">外观</span>
        </button>
        <button
          type="button"
          className="railbtn"
          aria-current={view === 'settings' ? 'page' : undefined}
          onClick={() => onView('settings')}
        >
          <Icon name="sliders" size={20} />
          <span className="railbtn__label">设置</span>
        </button>
        <button
          type="button"
          className="railbtn"
          onClick={onToggleMini}
          aria-label={mini ? '展开导航栏' : '收起导航栏'}
          title={mini ? '展开导航栏' : '收起导航栏'}
        >
          <Icon name={mini ? 'chevronRight' : 'chevronLeft'} size={18} />
        </button>
      </div>
    </nav>
  )
}

export function TabBar({ view, onView, pendingChecks }) {
  /* 收藏 / 清单 / 总览 are reachable from 我的, so highlight that tab while the
     user is inside one of them rather than leaving nothing selected. */
  const current = TABS.some((t) => t.key === view) ? view : 'settings'
  return (
    <nav className="tabbar" aria-label="主导航">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className="tabbtn"
          aria-current={current === t.key ? 'page' : undefined}
          onClick={() => onView(t.key)}
        >
          <Icon name={t.icon} size={22} state={current === t.key ? 'selected' : 'default'} />
          <span>{t.label}</span>
          {t.key === 'settings' && pendingChecks > 0 && (
            <span className="tabbtn__dot" aria-hidden="true">
              {pendingChecks > 99 ? '99+' : pendingChecks}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
