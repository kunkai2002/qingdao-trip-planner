import { createElement, forwardRef, memo } from 'react'
import { ICONS, opticalStroke } from './registry.js'

/**
 * Icon — the single React entry point for the whole icon set.
 *
 *   <Icon name="search" />                     20px, current colour
 *   <Icon name="star" size={16} />             optical stroke bumped for legibility
 *   <Icon name="trash" state="disabled" />     dimmed but still readable
 *   <Icon name="clock" badge={3} />            notification badge, top-right
 *
 * Colour always resolves to `currentColor`, so an icon inherits from whatever
 * glass container it sits in. Nothing is baked in: no background, no fixed
 * palette, no fixed size.
 */
export const Icon = memo(
  forwardRef(function Icon(
    {
      name,
      size = 20,
      strokeWidth,
      state = 'default',
      badge,
      title,
      className = '',
      style,
      ...rest
    },
    ref,
  ) {
    const els = ICONS[name]
    if (!els) {
      if (import.meta.env.DEV) console.warn(`[Icon] unknown icon: ${name}`)
      return null
    }

    const sw = strokeWidth ?? opticalStroke(size)
    const selected = state === 'selected'
    const disabled = state === 'disabled'

    const svg = createElement(
      'svg',
      {
        ref,
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: selected ? sw + 0.25 : sw,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: `icn${className ? ' ' + className : ''}`,
        style: {
          display: 'block',
          flex: 'none',
          opacity: disabled ? 0.4 : undefined,
          ...style,
        },
        role: title ? 'img' : undefined,
        'aria-hidden': title ? undefined : true,
        'aria-label': title || undefined,
        ...rest,
      },
      title ? createElement('title', { key: 't' }, title) : null,
      els.map(([tag, attrs], i) => {
        const { _solid, ...a } = attrs
        return createElement(tag, {
          key: i,
          ...a,
          ...(_solid ? { fill: 'currentColor', stroke: 'none' } : null),
        })
      }),
    )

    if (badge == null || badge === false) return svg

    return createElement(
      'span',
      { className: 'icnwrap', style: { position: 'relative', display: 'inline-flex' } },
      svg,
      createElement(
        'span',
        { className: 'icnbadge', key: 'b' },
        badge === true ? null : String(badge),
      ),
    )
  }),
)
