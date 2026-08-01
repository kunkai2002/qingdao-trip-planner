import { useStore } from '../../store/useStore.js'
import { Icon } from '../../icons/Icon.jsx'
import { SectionHead } from './bits.jsx'

/* ============================================================
   清单.

   The groups are the ones already in the data — 必带证件 / 预约凭证 / 钱与支付 /
   随身与装备 / 别带别忘 — and not the generic 行前·证件·衣物·设备·预订 buckets,
   because these are about *this* trip: 海军博物馆 checks the original ID of
   every person, 崂山 is 5–8°C colder at the top, the seafood market wants cash.
   Renaming those into generic headings would trade real content for tidiness.
   ============================================================ */

export function ChecklistView({ dialog }) {
  const s = useStore()
  const total = s.checklist.reduce((n, g) => n + g.items.length, 0)
  const done = s.checklist.reduce((n, g) => n + g.items.filter((i) => i.done).length, 0)
  const pct = total ? Math.round((done / total) * 100) : 0

  const add = async (gi) => {
    const text = await dialog.prompt({
      kicker: '备忘清单',
      title: `往「${s.checklist[gi]?.title}」加一条`,
      label: '内容',
      placeholder: '例如：给相机多带一张 SD 卡',
      confirmLabel: '添加',
    })
    if (text) s.addCheckItem(gi, text)
  }

  const reset = async () => {
    const ok = await dialog.confirm({
      kicker: '重置清单',
      title: '重置整份备忘清单？',
      body: '所有勾选状态会清空，你自己加的备忘也会被删除。',
      tone: 'danger',
      confirmLabel: '重置',
    })
    if (ok) s.resetChecklist()
  }

  return (
    <>
      <header className="work__head">
        <div className="work__headrow">
          <div>
            <h1 className="work__title">清单</h1>
            <p className="work__sub">
              {done}/{total} 项已完成
            </p>
          </div>
          <button type="button" className="wbtn wbtn--ghost wbtn--sm" onClick={reset}>
            <Icon name="refresh" size={14} />
            重置
          </button>
        </div>
        <div className="progress" style={{ marginTop: 'var(--sp-3)' }}>
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="work__body">
        {s.checklist.map((g, gi) => {
          const gDone = g.items.filter((i) => i.done).length
          return (
            <section className="chk__group card" key={g.title + gi} style={{ overflow: 'hidden' }}>
              <div style={{ padding: 'var(--sp-3) var(--sp-3) 4px' }}>
                <SectionHead
                  title={
                    <>
                      {g.icon ? <Icon name={g.icon} size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} /> : null}
                      {g.title}
                      {g.subtitle ? (
                        <span style={{ marginLeft: 6, fontSize: 'var(--fs-micro)', color: 'var(--tx-3)', fontWeight: 500 }}>
                          {g.subtitle}
                        </span>
                      ) : null}
                    </>
                  }
                  meta={`${gDone}/${g.items.length}`}
                />
              </div>

              {g.items.map((it, ii) => (
                <div key={ii} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="chkitem"
                    role="checkbox"
                    aria-checked={it.done}
                    onClick={() => s.toggleCheck(gi, ii)}
                  >
                    <span className="chkbox">
                      <Icon name="check" size={13} strokeWidth={2.6} />
                    </span>
                    <span className="chkitem__t">{it.text}</span>
                  </button>
                  {it.custom && (
                    <button
                      type="button"
                      className="wbtn wbtn--ghost wbtn--icon"
                      style={{ position: 'absolute', right: 6, top: 6 }}
                      onClick={() => s.delCheckItem(gi, ii)}
                      aria-label="删除这条备忘"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="wbtn wbtn--ghost wbtn--sm"
                style={{ margin: 'var(--sp-2) var(--sp-3) var(--sp-3)' }}
                onClick={() => add(gi)}
              >
                <Icon name="plus" size={14} />
                加一条
              </button>
            </section>
          )
        })}
      </div>
    </>
  )
}
