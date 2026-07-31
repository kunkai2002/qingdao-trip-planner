import { Component } from 'react'
import { KEYS } from '../lib/storage.js'

/* ============================================================
   ErrorBoundary
   ------------------------------------------------------------
   The app had none. A single throw inside MapCanvas rendered the entire page
   blank with nothing but a console message — observed for real while working
   on the map layer.

   The recovery UI deliberately reads localStorage DIRECTLY rather than going
   through the store: the whole point is that it still works when React is
   broken, and the user's trip is the only irreplaceable thing here. Exporting
   the backup must be possible even if nothing else renders.
   ============================================================ */

function rescueExport() {
  try {
    const raw = localStorage.getItem(KEYS.data)
    const chk = localStorage.getItem(KEYS.checklist)
    const payload = {
      v: 2,
      rescued: true,
      exported: new Date().toISOString(),
      ...(raw ? JSON.parse(raw) : {}),
      ...(chk ? { checklist: JSON.parse(chk).groups } : {}),
    }
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `青岛行程备份-救援-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return true
  } catch {
    return false
  }
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[qingdao] render failure', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // A scoped boundary (e.g. around the map) degrades in place instead of
    // taking the whole page with it.
    if (this.props.compact) {
      return (
        <div className="failbox">
          <strong>{this.props.label || '这个部分'}加载失败</strong>
          <span>其余功能仍可使用。刷新页面通常就能恢复。</span>
          <button type="button" onClick={() => this.setState({ error: null })}>
            重试
          </button>
        </div>
      )
    }

    return (
      <div className="failpage">
        <div className="glass glass--raised failpage__card">
          <div>
            <div className="modal__kicker">出了点问题</div>
            <h1 className="modal__title">页面没能正常加载</h1>
            <p className="modal__sub">
              你的行程数据还完整保存在这台设备的浏览器里，没有丢失。
              建议先导出一份备份，再刷新页面。
            </p>
            <pre className="failpage__detail">{String(error?.message || error)}</pre>
            <div className="actions">
              <button
                type="button"
                className="failpage__btn failpage__btn--primary"
                onClick={rescueExport}
              >
                导出备份
              </button>
              <button
                type="button"
                className="failpage__btn"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
