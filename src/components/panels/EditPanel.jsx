import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../icons/Icon.jsx'
import { GlassButton } from '../Glass.jsx'
import { CATS, CAT_ORDER } from '../../data/categories.js'
import { SectionTitle } from '../Panel.jsx'
import { T, SPRING } from '../../lib/motion.js'

const BLANK = {
  cat: 'sight',
  name: '',
  rating: '',
  reviews: '',
  prices: [['', '']],
  address: '',
  area: '',
  hours: '',
  tel: '',
  tags: '',
  note: '',
  warn: '',
  booking: false,
}

function toForm(p) {
  if (!p) return { ...BLANK, prices: [['', '']] }
  return {
    cat: p.cat || 'sight',
    name: p.name || '',
    rating: p.rating ? String(p.rating) : '',
    reviews: p.reviews ? String(p.reviews) : '',
    prices: p.prices?.length ? p.prices.map(([a, b]) => [a, b]) : [['', '']],
    address: p.address || '',
    area: p.area || '',
    hours: p.hours || '',
    tel: p.tel || '',
    tags: (p.tags || []).join('，'),
    note: p.note || '',
    warn: p.warn || '',
    booking: !!p.booking,
  }
}

export function EditPanel({ point, isNew, onSave, onCancel, onNotify, onDirtyChange }) {
  const [f, setF] = useState(() => toForm(point))
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  /* Tell the shell whether there is unsaved work, so closing the sheet can ask
     before discarding it. The form lives entirely in local state, so without
     this a stray Escape or a tap on the map silently threw the edits away. */
  const pristine = useRef(JSON.stringify(toForm(point)))
  useEffect(() => {
    pristine.current = JSON.stringify(toForm(point))
  }, [point])
  useEffect(() => {
    onDirtyChange?.(JSON.stringify(f) !== pristine.current)
    return () => onDirtyChange?.(false)
  }, [f, onDirtyChange])

  const catOptions = useMemo(
    () => CAT_ORDER.map((k) => ({ value: k, label: CATS[k].name })),
    [],
  )

  const updatePrice = (i, j, v) =>
    setF((s) => {
      const prices = s.prices.map((row, ri) =>
        ri === i ? row.map((cell, ci) => (ci === j ? v : cell)) : row,
      )
      return { ...s, prices }
    })

  const submit = () => {
    const name = f.name.trim()
    if (!name) {
      onNotify('请先填写名称', 'warn', 'alert')
      return
    }
    const rating = Math.max(0, Math.min(5, parseFloat(f.rating) || 0))
    const data = {
      cat: f.cat,
      name,
      rating,
      reviews: Math.max(0, parseInt(f.reviews, 10) || 0),
      prices: f.prices
        .map(([a, b]) => [a.trim(), b.trim()])
        .filter(([a, b]) => a || b),
      address: f.address.trim(),
      area: f.area.trim(),
      hours: f.hours.trim(),
      tel: f.tel.trim(),
      tags: f.tags
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean),
      note: f.note.trim(),
      warn: f.warn.trim() || undefined,
      booking: f.booking,
    }
    onSave(data)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T.card}>
      <div className="field">
        <label className="field__label" htmlFor="f-name">
          <Icon name="tag" size={12} />
          名称
        </label>
        <input
          id="f-name"
          className="input"
          value={f.name}
          onChange={set('name')}
          placeholder="例如：栈桥 + 回澜阁"
          autoFocus={isNew}
        />
      </div>

      <div className="grid2">
        <div className="field">
          <label className="field__label" htmlFor="f-cat">
            <Icon name="layers" size={12} />
            分类
          </label>
          <select id="f-cat" className="input" value={f.cat} onChange={set('cat')}>
            {catOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-area">
            <Icon name="mapPin" size={12} />
            片区
          </label>
          <input
            id="f-area"
            className="input"
            value={f.area}
            onChange={set('area')}
            placeholder="五四广场"
          />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label className="field__label" htmlFor="f-rating">
            <Icon name="star" size={12} />
            评分 0–5
          </label>
          <input
            id="f-rating"
            className="input"
            type="number"
            step="0.1"
            min="0"
            max="5"
            inputMode="decimal"
            value={f.rating}
            onChange={set('rating')}
            placeholder="4.6"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-reviews">
            <Icon name="listChecks" size={12} />
            点评数
          </label>
          <input
            id="f-reviews"
            className="input"
            type="number"
            min="0"
            inputMode="numeric"
            value={f.reviews}
            onChange={set('reviews')}
            placeholder="2200"
          />
        </div>
      </div>

      <SectionTitle icon="ticket">价位与套餐</SectionTitle>
      <AnimatePresence initial={false}>
        {f.prices.map((row, i) => (
          <motion.div
            className="pricerow"
            key={i}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING.soft}
          >
            <input
              className="input"
              value={row[0]}
              onChange={(e) => updatePrice(i, 0, e.target.value)}
              placeholder="标签，如：门票"
              aria-label={`第 ${i + 1} 档标签`}
            />
            <input
              className="input"
              value={row[1]}
              onChange={(e) => updatePrice(i, 1, e.target.value)}
              placeholder="价格，如：60元"
              aria-label={`第 ${i + 1} 档价格`}
            />
            <GlassButton
              depth="thin"
              className="pricerow__del"
              onClick={() =>
                setF((s) => ({
                  ...s,
                  prices: s.prices.length > 1 ? s.prices.filter((_, ri) => ri !== i) : [['', '']],
                }))
              }
              title="删除这一档"
              aria-label="删除这一档"
            >
              <Icon name="close" size={15} />
            </GlassButton>
          </motion.div>
        ))}
      </AnimatePresence>
      <button
        type="button"
        className="textlink"
        onClick={() => setF((s) => ({ ...s, prices: [...s.prices, ['', '']] }))}
      >
        <Icon name="plus" size={14} />
        再加一档价格
      </button>

      <SectionTitle icon="info">明细</SectionTitle>

      <div className="field">
        <label className="field__label" htmlFor="f-address">
          <Icon name="mapPin" size={12} />
          地址
        </label>
        <input id="f-address" className="input" value={f.address} onChange={set('address')} />
      </div>

      <div className="grid2">
        <div className="field">
          <label className="field__label" htmlFor="f-hours">
            <Icon name="clock" size={12} />
            营业时间
          </label>
          <input id="f-hours" className="input" value={f.hours} onChange={set('hours')} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-tel">
            <Icon name="phone" size={12} />
            电话
          </label>
          <input id="f-tel" className="input" value={f.tel} onChange={set('tel')} />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="f-tags">
          <Icon name="tag" size={12} />
          标签（逗号分隔）
        </label>
        <input
          id="f-tags"
          className="input"
          value={f.tags}
          onChange={set('tags')}
          placeholder="夜景，免费，住处旁"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="f-note">
          <Icon name="info" size={12} />
          说明 / 攻略
        </label>
        <textarea id="f-note" className="input" value={f.note} onChange={set('note')} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="f-warn">
          <Icon name="alert" size={12} />
          注意事项（会以警示样式单独显示）
        </label>
        <textarea id="f-warn" className="input" value={f.warn} onChange={set('warn')} />
      </div>

      <label className="switchrow">
        <span className="switchrow__text">
          <span className="switchrow__title">需预约 / 提前订</span>
          <span className="switchrow__sub">开启后地图上的点位会带一个警示标记</span>
        </span>
        <input
          type="checkbox"
          className="sronly"
          checked={f.booking}
          onChange={(e) => setF((s) => ({ ...s, booking: e.target.checked }))}
        />
        <span className={`switch ${f.booking ? 'switch--on' : ''}`} aria-hidden="true">
          <motion.span
            className="switch__knob"
            animate={{ x: f.booking ? 19 : 0 }}
            transition={SPRING.soft}
          />
        </span>
      </label>

      <div className="actions">
        <GlassButton variant="primary" className="btn" onClick={submit}>
          <Icon name="check" size={17} />
          保存
        </GlassButton>
        <GlassButton variant="quiet" className="btn" onClick={onCancel}>
          取消
        </GlassButton>
      </div>
    </motion.div>
  )
}
