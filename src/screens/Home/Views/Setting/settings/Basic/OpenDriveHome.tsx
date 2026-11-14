import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'

/**
 * 【v55】启动后打开驾驶舱：启动应用时直接落在驾驶舱页（仅车机模式下显示）。
 * 【v56】说明：该选项只对应用（重新）启动生效，返回桌面/切后台再回前台不改变当前页。
 */
export default memo(() => {
  const t = useI18n()
  const openDriveHome = useSettingValue('common.openDriveHome')
  const setOpenDriveHome = (val: boolean) => {
    updateSetting({ 'common.openDriveHome': val })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={openDriveHome}
        label={t('setting_basic_open_drive_home')}
        helpDesc={t('setting_basic_open_drive_home_desc')}
        onChange={setOpenDriveHome} />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
