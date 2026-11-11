import { memo } from 'react'

import Theme from './Theme'
import IsAutoTheme from './IsAutoTheme'
import IsHideBgDark from './IsHideBgDark'
import IsDynamicBg from './IsDynamicBg'
import IsFontShadow from './IsFontShadow'
import { isCarModeEnabled } from '@/config/carMode'

// 【车机改造】车机模式下：车机主题已归组到「车机模式」区块内（v33），
// 本区块整体隐藏，避免同一设置出现两份；车机开关在启动最早期确定。
// 非车机模式（取消勾选车机模式）完全恢复原版设置。
const carMode = isCarModeEnabled()

export default memo(() => {
  if (carMode) return null
  return (
    <>
      <Theme />
      <IsAutoTheme />
      <IsHideBgDark />
      <IsDynamicBg />
      <IsFontShadow />
    </>
  )
})
