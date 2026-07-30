/* Point categories. `icon` names come from the icon registry — never emoji. */

export const CATS = {
  sight: { key: 'sight', name: '景点', icon: 'landmark', varName: '--c-sight' },
  stay: { key: 'stay', name: '住宿', icon: 'bed', varName: '--c-stay' },
  food: { key: 'food', name: '餐厅', icon: 'utensils', varName: '--c-food' },
  fun: { key: 'fun', name: '娱乐', icon: 'sparkles', varName: '--c-fun' },
  metro: { key: 'metro', name: '交通', icon: 'train', varName: '--c-metro' },
}

export const CAT_ORDER = ['sight', 'stay', 'food', 'fun', 'metro']

/** CSS colour reference for a category, resolved by the browser at paint time. */
export function catColor(key) {
  return `var(${CATS[key]?.varName || '--accent'})`
}
