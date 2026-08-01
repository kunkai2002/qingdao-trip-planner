import { motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { Modal } from './Modal.jsx'
import { GlassButton } from './Glass.jsx'
import { T } from '../lib/motion.js'

/* Three lines, not six.
   The old version explained 图层 / 点位 / 编辑 / 长按新增 / 路线 / 备份 — six
   things, which is what you write when the interface cannot explain itself.
   These three are the loop the whole app is built around; everything else is
   discoverable from where it lives. */
const TIPS = [
  {
    icon: 'calendar',
    body: (
      <>
        左边是<b>某一天的行程</b>，右边是地图。切换 D1–D5，地图只亮那天的路线
      </>
    ),
  },
  {
    icon: 'gripDots',
    body: (
      <>
        <b>拖动卡片</b>换顺序，路线、时间和路程立刻跟着重算
      </>
    ),
  },
  {
    icon: 'compass',
    body: (
      <>
        去<b>探索</b>挑地点，加进任意一天。收藏是「想去但还没定哪天」的暂存区
      </>
    ),
  },
]

export function Onboarding({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="intro-title">
      <div className="modal__kicker">开始之前</div>
      <h1 className="modal__title" id="intro-title">
        青岛一图流
      </h1>
      <p className="modal__sub">
        把每天的地点、路线和时间，放进同一张地图。所有改动只存在你自己的浏览器里，不会上传。
      </p>

      <ul className="tips">
        {TIPS.map((t, i) => (
          <motion.li
            className="tip"
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...T.card, delay: 0.14 + i * 0.05 }}
          >
            <span className="tip__icon">
              <Icon name={t.icon} size={17} />
            </span>
            <span>{t.body}</span>
          </motion.li>
        ))}
      </ul>

      <div className="actions">
        <GlassButton variant="primary" className="btn" onClick={onClose}>
          开始规划
          <Icon name="arrowRight" size={17} />
        </GlassButton>
      </div>
    </Modal>
  )
}
