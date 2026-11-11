import { memo, useEffect, useState } from 'react'

import Theme from '../Theme'
import Section from '../../components/Section'
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
import { useI18n } from '@/lang/i18n'
import { getCarMode, saveCarMode } from '@/utils/data'

// 【v35】车机主题已移除，恢复原版主题选择；归组仅保留「界面大小」子项。
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
      {carMode ? <CarUIScale /> : null}
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
