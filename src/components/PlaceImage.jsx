import { useState } from 'react'
import { CATS } from '../data/categories.js'

/* ============================================================
   Covers for place cards.

   The seed data has no photographs and there is no image service to call — the
   whole app is meant to keep working offline and to still open in three years.
   A grey box would be worse than nothing: a list of grey boxes reads as broken,
   not as "no photo".

   So every place gets a drawn cover instead: a small vector scene chosen by
   category and varied by a hash of the point id, so 栈桥 always looks like
   itself and never like 八大关. No network, no layout shift, no broken image.
   ============================================================ */

/* FNV-1a. Any stable hash would do; this one is four lines and has no bias
   problems at this size. */
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return Math.abs(h)
}

/* Palettes stay inside the app's own colour world — coast blues, sand, roof
   red — so a wall of covers reads as one product rather than as clip art. */
const SCENES = {
  sight: { sky: ['#CFE6EF', '#EAF3F6'], ink: '#134D66', accent: '#B64A3E' },
  food: { sky: ['#F6E3D2', '#FBF2E8'], ink: '#8A4B2A', accent: '#C07A18' },
  stay: { sky: ['#DCE4EC', '#F1F4F7'], ink: '#3D5A6C', accent: '#087EA4' },
  fun: { sky: ['#E5DCEF', '#F4EFF8'], ink: '#5C3D77', accent: '#C0568F' },
  metro: { sky: ['#DAE7E4', '#EFF5F3'], ink: '#2F5F58', accent: '#357A7A' },
}

function Scene({ cat, seed }) {
  const s = SCENES[cat] || SCENES.sight
  const r = (n, mod) => (seed >> n) % mod

  if (cat === 'food') {
    return (
      <>
        <path d="M18 46h60a30 30 0 0 1-60 0Z" fill={s.ink} opacity=".9" />
        <rect x="14" y="44" width="68" height="4" rx="2" fill={s.accent} />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${34 + i * 14} 34c-4-5 4-8 0-13`}
            stroke={s.ink}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            opacity={0.35 + i * 0.12}
          />
        ))}
      </>
    )
  }

  if (cat === 'stay') {
    return (
      <>
        <rect x="20" y="24" width="56" height="34" rx="4" fill={s.ink} opacity=".9" />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={26 + (i % 2) * 26}
            y={30 + Math.floor(i / 2) * 14}
            width="18"
            height="9"
            rx="1.5"
            fill={i === r(3, 4) ? s.accent : '#FAF7F0'}
            opacity={i === r(3, 4) ? 1 : 0.75}
          />
        ))}
        <rect x="16" y="56" width="64" height="4" rx="2" fill={s.accent} opacity=".8" />
      </>
    )
  }

  if (cat === 'fun') {
    return (
      <>
        {[0, 1, 2, 3, 4].map((i) => {
          const x = 18 + i * 15
          const h = 14 + ((seed >> (i * 2)) % 18)
          return <rect key={i} x={x} y={54 - h} width="9" height={h} rx="3" fill={s.ink} opacity={0.55 + i * 0.09} />
        })}
        <circle cx={30 + r(5, 40)} cy="22" r="5" fill={s.accent} />
        <rect x="14" y="54" width="68" height="4" rx="2" fill={s.accent} opacity=".7" />
      </>
    )
  }

  if (cat === 'metro') {
    return (
      <>
        <path d="M30 58 44 22h8L38 58Z" fill={s.ink} opacity=".75" />
        <path d="M66 58 52 22h-8l14 36Z" fill={s.ink} opacity=".75" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x="34" y={28 + i * 11} width="28" height="3.5" rx="1.75" fill={s.accent} opacity=".85" />
        ))}
      </>
    )
  }

  /* 景点 — the red-roof skyline over water that is the whole visual idea of
     this city, with the pier silhouette shifted by the hash so neighbouring
     cards do not look stamped. */
  const shift = r(2, 12)
  return (
    <>
      {/* Kept away from the top-right corner: at the 76px card size a small
          red disc parked in the corner reads as a notification badge. */}
      <circle cx={30 + shift} cy="17" r="6.5" fill={s.accent} opacity=".8" />
      <path
        d={`M8 48 ${18 + shift} 36l8 6 10-12 9 9 12-14 11 12 8-5v12Z`}
        fill={s.ink}
        opacity=".85"
      />
      <path d="M6 52h84" stroke={s.ink} strokeWidth="2" opacity=".25" />
      {[0, 1].map((i) => (
        <path
          key={i}
          d={`M${10 + i * 8} ${58 + i * 4}q12 -4 24 0t24 0t24 0`}
          stroke={s.ink}
          strokeWidth="1.8"
          fill="none"
          opacity={0.3 - i * 0.1}
          strokeLinecap="round"
        />
      ))}
    </>
  )
}

/** The drawn cover on its own. */
export function PlaceCover({ point, className = '', rounded = 14 }) {
  const cat = CATS[point?.cat] ? point.cat : 'sight'
  const seed = hash(point?.id || point?.name || 'x')
  const s = SCENES[cat]
  const gid = `cv${seed % 100000}`
  return (
    <svg
      className={`cover ${className}`}
      viewBox="0 0 96 72"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="96" height="72" rx={rounded} fill={`url(#${gid})`} />
      <Scene cat={cat} seed={seed} />
    </svg>
  )
}

/**
 * A photo when the point has one, the drawn cover when it does not — and also
 * when the photo fails, which is the case that otherwise leaves a broken-image
 * glyph sitting in the middle of a card.
 */
export function PlaceImage({ point, className = '', rounded = 14 }) {
  const [failed, setFailed] = useState(false)
  if (point?.imageUrl && !failed) {
    return (
      <img
        className={`cover ${className}`}
        src={point.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    )
  }
  return <PlaceCover point={point} className={className} rounded={rounded} />
}
