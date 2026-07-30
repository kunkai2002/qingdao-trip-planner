import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon.jsx'
import { Modal } from './Modal.jsx'
import { GlassButton } from './Glass.jsx'

/**
 * Promise-based confirm / prompt so the app never falls back to the browser's
 * native dialogs — those cannot be styled, cannot be translated, and break the
 * glass illusion completely.
 *
 *   const dlg = useDialog()
 *   if (await dlg.confirm({ title: '删除？' })) …
 *   const name = await dlg.prompt({ title: '路线名称', defaultValue: '我的路线' })
 */
export function useDialog() {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const open = useCallback((next) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setState(next)
    })
  }, [])

  const settle = useCallback((value) => {
    resolver.current?.(value)
    resolver.current = null
    setState(null)
  }, [])

  return {
    state,
    settle,
    confirm: useCallback((opts) => open({ kind: 'confirm', ...opts }), [open]),
    prompt: useCallback((opts) => open({ kind: 'prompt', ...opts }), [open]),
  }
}

export function Dialog({ dialog }) {
  const { state, settle } = dialog
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (state?.kind === 'prompt') {
      setValue(state.defaultValue || '')
      const t = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 120)
      return () => clearTimeout(t)
    }
  }, [state])

  const isPrompt = state?.kind === 'prompt'
  const danger = state?.tone === 'danger'

  return (
    <Modal
      open={!!state}
      onClose={() => settle(isPrompt ? null : false)}
      labelledBy="dlg-title"
    >
      <div className="modal__kicker" style={danger ? { color: 'var(--bad)' } : undefined}>
        {state?.kicker || (danger ? '需要确认' : '请确认')}
      </div>
      <h2
        className="modal__title"
        id="dlg-title"
        style={{ fontSize: 21, display: 'flex', gap: 10, alignItems: 'center' }}
      >
        {danger && <Icon name="alert" size={21} style={{ color: 'var(--bad)' }} />}
        {state?.title}
      </h2>
      {state?.body && <p className="modal__sub">{state.body}</p>}

      {isPrompt && (
        <div className="field">
          {state.label && <label className="field__label">{state.label}</label>}
          <input
            ref={inputRef}
            className="input"
            value={value}
            placeholder={state.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) settle(value.trim())
            }}
          />
        </div>
      )}

      <div className="actions">
        <GlassButton
          variant={danger ? 'danger' : 'primary'}
          className="btn"
          disabled={isPrompt && !value.trim()}
          onClick={() => settle(isPrompt ? value.trim() : true)}
        >
          {state?.confirmLabel || (danger ? '确认删除' : '确定')}
        </GlassButton>
        <GlassButton
          variant="quiet"
          className="btn"
          onClick={() => settle(isPrompt ? null : false)}
        >
          {state?.cancelLabel || '取消'}
        </GlassButton>
      </div>
    </Modal>
  )
}
