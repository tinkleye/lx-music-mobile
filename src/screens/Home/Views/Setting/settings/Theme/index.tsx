import { memo } from 'react'

// import Section from '../../components/Section'
import Theme from './Theme'
import ThemeMode from './ThemeMode'
import IsAutoTheme from './IsAutoTheme'
import IsHideBgDark from './IsHideBgDark'
import IsDynamicBg from './IsDynamicBg'
import IsFontShadow from './IsFontShadow'
// import { useI18n } from '@/lang/i18n'
import { isCarModeEnabled } from '@/config/carMode'

// 【车机改造】车机模式下主题区块只显示「车机主题」三选一（专属深/浅主题），
// 隐藏原版的主题颜色/跟随系统亮暗/动态背景等选项，避免两套语义打架。
// 非车机模式（取消勾选车机模式）完全恢复原版设置。
// 车机开关在启动最早期确定，模块级取值与 Mylist 等改造处一致。
const carMode = isCarModeEnabled()

export default memo(() => {
  if (carMode) {
    return (
      <>
        <ThemeMode />
      </>
    )
  }
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
