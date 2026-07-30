import { motion } from 'framer-motion'
import { Icon } from '../icons/Icon.jsx'
import { Modal } from './Modal.jsx'
import { GlassButton } from './Glass.jsx'
import { T } from '../lib/motion.js'

const TIPS = [
  {
    icon: 'layers',
    body: (
      <>
        顶部<b>彩色胶囊</b>是图层开关，点一下显示或隐藏某一类点位
      </>
    ),
  },
  {
    icon: 'mapPin',
    body: (
      <>
        点<b>地图上的点位</b>看详情：评分、价位、营业时间、注意事项
      </>
    ),
  },
  {
    icon: 'pencil',
    body: (
      <>
        详情里可<b>编辑或删除</b>；点位也能<b>直接拖动</b>修正位置
      </>
    ),
  },
  {
    icon: 'compass',
    body: (
      <>
        右下 <b>罗盘</b>看攻略路线，也能自己串一条 DIY 路线
      </>
    ),
  },
  {
    icon: 'download',
    body: (
      <>
        菜单里可<b>导出 / 导入备份</b>，换手机也不丢数据
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
        一张地图放下全部行程：景点、住宿、餐厅、娱乐和地铁。所有改动只存在你自己的浏览器里。
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
