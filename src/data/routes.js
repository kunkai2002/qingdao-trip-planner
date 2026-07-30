/* Curated itineraries. `icon` is an icon-registry name — the emoji that used
   to sit in each label is gone, replaced by a real vector glyph. */

export const PRESET_ROUTES = [
  {
    id: 'd1',
    group: '按天',
    name: 'D1 · 9/29 海军 + 趕海',
    icon: 'calendar',
    stops: ['navy', 'kaihai', 'taiping', 'wusi'],
    color: '#0c6b78',
  },
  {
    id: 'd2',
    group: '按天',
    name: 'D2 · 9/30 崂山一日',
    icon: 'calendar',
    stops: ['laoshan'],
    color: '#0c6b78',
  },
  {
    id: 'd3',
    group: '按天',
    name: 'D3 · 10/1 会师 + 室内',
    icon: 'calendar',
    stops: ['qianhai', 'beer', 'taidong', 'wusi'],
    color: '#0c6b78',
  },
  {
    id: 'd4',
    group: '按天',
    name: 'D4 · 10/2 老城线',
    icon: 'calendar',
    stops: ['badaguan', 'church', 'xiaoyu', 'zhan', 'chunhe'],
    color: '#0c6b78',
  },
  {
    id: 'd5',
    group: '按天',
    name: 'D5 · 10/3 娱乐 + 升级局',
    icon: 'calendar',
    stops: ['jinsha', 'yiqing', 'xiaoli'],
    color: '#0c6b78',
  },
  {
    id: 'photo',
    group: '主题',
    name: '拍照打卡线',
    icon: 'camera',
    stops: ['xiaoyu', 'xinhao', 'daxue', 'badaguan', 'wusi'],
    color: '#b0561f',
  },
  {
    id: 'foodline',
    group: '主题',
    name: '觅食线',
    icon: 'utensils',
    stops: ['chunhe', 'qianhai', 'chuange', 'kaihai', 'yingkou'],
    color: '#cd6c2b',
  },
  {
    id: 'sea',
    group: '主题',
    name: '海边线',
    icon: 'waves',
    stops: ['zhan', 'luxun', 'xiaoqd', 'taiping', 'shilaoren'],
    color: '#2980b9',
  },
]

export const PRESET_GROUP_ORDER = ['按天', '主题']
