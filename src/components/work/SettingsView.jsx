import { useRef } from 'react'
import { useStore } from '../../store/useStore.js'
import { CATS, CAT_ORDER } from '../../data/categories.js'
import { addDays, formatDate } from '../../data/trip.js'
import { Icon } from '../../icons/Icon.jsx'
import { NAV } from './Rail.jsx'
import { SectionHead } from './bits.jsx'

/* 我的 / 设置 — the trip's own settings, the map's switches, and the data.
   On a phone this is also the way into 总览 / 收藏 / 清单, which have no tab of
   their own: four tabs is the limit before the bar becomes a menu. */

function Row({ label, hint, children }) {
  return (
    <div className="setrow">
      <div className="setrow__t">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="setrow__c">{children}</div>
    </div>
  )
}

export function SettingsView({ dialog, install, storage, onInstall, onImport, onResetData, desktop }) {
  const s = useStore()
  const fileRef = useRef(null)
  const stays = s.points.filter((p) => p.cat === 'stay')

  const renameTrip = async () => {
    const v = await dialog.prompt({
      kicker: '行程',
      title: '给这趟旅行起个名字',
      label: '名称',
      defaultValue: s.trip.title,
      confirmLabel: '保存',
    })
    if (v?.trim()) s.updateTrip({ title: v.trim() })
  }

  return (
    <>
      <header className="work__head">
        <div className="work__headrow">
          <div>
            <h1 className="work__title">{desktop ? '设置' : '我的'}</h1>
            <p className="work__sub">行程、地图与数据</p>
          </div>
        </div>
      </header>

      <div className="work__body">
        {/* Phones only: the sections that lost their tab. */}
        {!desktop && (
          <section className="card" style={{ overflow: 'hidden' }}>
            {NAV.filter((n) => n.key !== 'itinerary' && n.key !== 'explore').map((n) => (
              <button key={n.key} type="button" className="dayrow" onClick={() => s.setView(n.key)}>
                <Icon name={n.icon} size={18} />
                <span style={{ fontSize: 'var(--fs-sub)', fontWeight: 600 }}>{n.label}</span>
                <Icon name="chevronRight" size={16} />
              </button>
            ))}
          </section>
        )}

        <section className="card setcard">
          <SectionHead title="这趟旅行" />
          <Row label="名称">
            <button type="button" className="wbtn wbtn--sm" onClick={renameTrip}>
              {s.trip.title}
              <Icon name="pencil" size={13} />
            </button>
          </Row>
          <Row label="出发日期" hint="改了之后每一天的日期会跟着顺移">
            <input
              className="field"
              type="date"
              style={{ width: 'auto' }}
              value={s.trip.startDate}
              onChange={(e) => e.target.value && s.updateTrip({ startDate: e.target.value })}
            />
          </Row>
          <Row label="同行人数" hint="用来把「每人」估算换算成总花费">
            <div className="wrow" style={{ gap: 4 }}>
              <button
                type="button"
                className="wbtn wbtn--icon"
                onClick={() => s.updateTrip({ travelers: Math.max(1, s.trip.travelers - 1) })}
                aria-label="减少一人"
              >
                <Icon name="minus" size={15} />
              </button>
              <span style={{ minWidth: 34, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>
                {s.trip.travelers}
              </span>
              <button
                type="button"
                className="wbtn wbtn--icon"
                onClick={() => s.updateTrip({ travelers: Math.min(50, s.trip.travelers + 1) })}
                aria-label="增加一人"
              >
                <Icon name="plus" size={15} />
              </button>
            </div>
          </Row>
          <Row label="住哪" hint="优化顺序会从这里出发算">
            <select
              className="field"
              style={{ width: 'auto', maxWidth: 190 }}
              value={s.trip.hotelPointId || ''}
              onChange={(e) => s.updateTrip({ hotelPointId: e.target.value || null })}
            >
              <option value="">未指定</option>
              {stays.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="天数">
            <div className="wrow" style={{ gap: 6 }}>
              <span style={{ fontSize: 'var(--fs-sub)', color: 'var(--tx-2)' }}>
                {s.days.length} 天 · 到 {formatDate(addDays(s.trip.startDate, s.days.length - 1)).md}
              </span>
              <button type="button" className="wbtn wbtn--sm" onClick={() => s.addDay()}>
                <Icon name="plus" size={13} />
                加一天
              </button>
            </div>
          </Row>
        </section>

        <section className="card setcard">
          <SectionHead title="地图" />
          {/* Depth matters here: the old build's switch really did only touch
              the tiles, because the controls were dark glass in both themes.
              Now the workspace has its own dark palette, so this changes both. */}
          <Row label="外观" hint="同时切换界面和地图；「自动」跟随系统">
            <div className="wrow" style={{ gap: 4 }}>
              {[
                ['auto', '自动', 'target'],
                ['light', '浅色', 'sun'],
                ['dark', '深色', 'moon'],
              ].map(([k, label, icon]) => (
                <button
                  key={k}
                  type="button"
                  className="chipx"
                  aria-pressed={s.theme === k}
                  onClick={() => s.setTheme(k)}
                >
                  <Icon name={icon} size={13} />
                  {label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="底图">
            <div className="wrow" style={{ gap: 4 }}>
              {[
                ['road', '街道'],
                ['satellite', '卫星'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className="chipx"
                  aria-pressed={s.basemap === k}
                  onClick={() => s.setBasemap(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="显示的图层">
            <div className="wrow" style={{ gap: 4 }}>
              {CAT_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="chipx"
                  aria-pressed={!!s.enabled[k]}
                  onClick={() => s.toggleCat(k)}
                >
                  <Icon name={CATS[k].icon} size={13} />
                  {CATS[k].name}
                </button>
              ))}
              <button type="button" className="chipx" aria-pressed={s.metroOn} onClick={s.toggleMetro}>
                <Icon name="train" size={13} />
                地铁线
              </button>
            </div>
          </Row>
        </section>

        <section className="card setcard">
          <SectionHead title="数据" />
          {/* The trip exists in this browser and nowhere else. That is the one
              thing this screen has to be honest about. */}
          <p style={{ margin: 0, fontSize: 'var(--fs-sub)', color: 'var(--tx-2)', lineHeight: 1.6 }}>
            行程只存在这台设备的浏览器里，不会上传到任何服务器。换手机、清浏览器数据或卸载都会没有，
            所以定期导出一份备份是唯一的保险。
            {storage?.persisted === true && '（浏览器已答应长期保留这份数据。）'}
            {storage?.persisted === false && '（浏览器还没答应长期保留，空间紧张时可能被清掉。）'}
          </p>
          <div className="wrow">
            <button type="button" className="wbtn wbtn--primary" onClick={s.exportData}>
              <Icon name="download" size={15} />
              导出备份
            </button>
            <button type="button" className="wbtn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} />
              导入备份
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImport(f)
                e.target.value = ''
              }}
            />
            <button type="button" className="wbtn wbtn--danger" onClick={onResetData}>
              <Icon name="refresh" size={15} />
              恢复默认
            </button>
          </div>
          {install?.available && (
            <div className="wrow">
              <button type="button" className="wbtn" onClick={onInstall}>
                <Icon name="pinPlus" size={15} />
                装到手机上
              </button>
            </div>
          )}
        </section>

        <section className="card setcard">
          <SectionHead title="关于" />
          <p style={{ margin: 0, fontSize: 'var(--fs-sub)', color: 'var(--tx-2)', lineHeight: 1.6 }}>
            青岛一图流 · 行程工作台。底图来自高德，路程与用时是按直线距离折算的<b>估算</b>，
            不是真实导航结果。
          </p>
          <div className="wrow">
            <button
              type="button"
              className="wbtn wbtn--sm wbtn--ghost"
              onClick={() => useStore.setState({ showIntro: true })}
            >
              重看使用说明
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
