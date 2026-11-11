import { memo, useEffect, useState } from 'react'

import Theme from '../Theme'
import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import Source from './Source'
import SourceName from './SourceName'
import Language from './Language'
import FontSize from './FontSize'
import ShareType from './ShareType'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from './IsStartupPushPlayDetailScreen'
import IsAutoHidePlayBar from './IsAutoHidePlayBar'
import IsHomePageScroll from './IsHomePageScroll'
import IsAllowProgressBarSeek from './IsAllowProgressBarSeek'
import IsUseSystemFileSelector from './IsUseSystemFileSelector'
import IsAlwaysKeepStatusbarHeight from './IsAlwaysKeepStatusbarHeight'
import IsCarMode from './IsCarMode'
import CarUIScale from './CarUIScale'
import IsShowBackBtn from './IsShowBackBtn'
import IsShowExitBtn from './IsShowExitBtn'
import DrawerLayoutPosition from './DrawerLayoutPosition'
import ThemeMode from '../Theme/ThemeMode'
import { useI18n } from '@/lang/i18n'
import { getCarMode, saveCarMode } from '@/utils/data'

// 【v33】车机模式归组：勾选「车机模式」后才显示「界面大小」与「车机主题」两个子项；
// 未勾选时隐藏，同时独立主题区块（Theme）在车机模式下自身也不再渲染。
export default memo(() => {
  const t = useI18n()
  const [carMode, setCarMode] = useState(true)

  useEffect(() => {
    void getCarMode().then(setCarMode)
  }, [])

  const handleCarModeChange = (val: boolean) => {
    setCarMode(val)
    void saveCarMode(val)
  }

  return (
    <Section title={t('setting_basic')}>
      <IsStartupAutoPlay />
      <IsStartupPushPlayDetailScreen />
      <IsShowBackBtn />
      <IsShowExitBtn />
      <IsAutoHidePlayBar />
      <IsHomePageScroll />
      <IsAllowProgressBarSeek />
      <IsUseSystemFileSelector />
      {/* 【改造】「启动时进入全屏」已并入「车机模式」，不再单独提供开关 */}
      <IsCarMode enabled={carMode} onChange={handleCarModeChange} />
      {
        carMode
          ? (
              <>
                <CarUIScale />
                <SubTitle title={t('setting_basic_theme_car')}>
                  <ThemeMode />
                </SubTitle>
              </>
            )
          : null
      }
      <IsAlwaysKeepStatusbarHeight />
      <Theme />
      <DrawerLayoutPosition />
      <Language />
      <FontSize />
      <ShareType />
      <Source />
      <SourceName />
    </Section>
  )
})
