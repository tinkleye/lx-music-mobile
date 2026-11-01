import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { applyFullscreenSetting } from '@/core/fullscreen'


import CheckBoxItem from '../../components/CheckBoxItem'

// 【改造】「启动即全屏」开关
export default memo(() => {
  const t = useI18n()
  const val = useSettingValue('common.startupFullscreen')
  const update = (startupFullscreen: boolean) => {
    updateSetting({ 'common.startupFullscreen': startupFullscreen })
    // 即时应用到原生窗口，不需要重启就能看到状态栏出现/消失
    applyFullscreenSetting()
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={val}
        label={t('setting_basic_startup_fullscreen')}
        helpDesc={t('setting_basic_startup_fullscreen_tip')}
        onChange={update} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
    // marginBottom: 15,
  },
})
