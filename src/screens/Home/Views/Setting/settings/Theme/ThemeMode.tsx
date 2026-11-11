import { memo } from 'react'
import { View } from 'react-native'

// 【车机改造】车机主题选择器：车机深色 / 车机浅色 / 跟随系统（三选一）
// 映射到专属车机主题 car_dark / car_light（getTheme 内按车机模式分支读取）
// 注意：createStyle 等工具函数必须显式导入（v31 崩溃教训，见 06-pitfalls.md）
import CheckBoxItem from '../../components/CheckBoxItem'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { getTheme } from '@/theme/themes'
import { applyTheme } from '@/core/theme'
import themeState from '@/store/theme/state'

export default memo(() => {
  const t = useI18n()
  const themeMode = useSettingValue('common.themeMode')

  const setMode = (mode: LX.AppSetting['common.themeMode']) => {
    updateSetting({ 'common.themeMode': mode })
    void getTheme().then(theme => {
      if (theme.id == themeState.theme.id) return
      applyTheme(theme)
    })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={themeMode == 'dark'} label={t('setting_basic_theme_car_dark')} onChange={() => { setMode('dark') }} />
      <CheckBoxItem check={themeMode == 'light'} label={t('setting_basic_theme_car_light')} onChange={() => { setMode('light') }} />
      <CheckBoxItem check={themeMode == 'auto'} label={t('setting_basic_theme_car_auto')} onChange={() => { setMode('auto') }} />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
