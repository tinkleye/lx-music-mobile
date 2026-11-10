import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { getTheme } from '@/theme/themes'
import { applyTheme } from '@/core/theme'
import themeState from '@/store/theme/state'

// 【车机改造】主题三模式：深色（默认）/ 浅色 / 跟随系统
// 内部映射到原有机制：theme.id + common.isAutoTheme
const DARK_THEME_ID = 'black'
const LIGHT_THEME_ID = 'green'

export default memo(() => {
  const t = useI18n()
  const themeMode = useSettingValue('common.themeMode')

  const apply = (mode: 'dark' | 'light' | 'auto') => {
    const isAuto = mode == 'auto'
    const themeId = mode == 'dark' ? DARK_THEME_ID : LIGHT_THEME_ID
    updateSetting({
      'common.themeMode': mode,
      'common.isAutoTheme': isAuto,
      ...(!isAuto ? { 'theme.id': themeId } : {}),
    })
    void getTheme().then(theme => {
      if (theme.id == themeState.theme.id) return
      applyTheme(theme)
    })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={themeMode == 'dark'} label={t('theme_mode_dark')} onChange={() => { apply('dark') }} />
      <CheckBoxItem check={themeMode == 'light'} label={t('theme_mode_light')} onChange={() => { apply('light') }} />
      <CheckBoxItem check={themeMode == 'auto'} label={t('theme_mode_auto')} onChange={() => { apply('auto') }} />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
