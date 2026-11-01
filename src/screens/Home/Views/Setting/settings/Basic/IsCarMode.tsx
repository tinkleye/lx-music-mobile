import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'

import { getCarMode, saveCarMode } from '@/utils/data'
import { setCarModeEnabled } from '@/config/carMode'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'

import CheckBoxItem from '../../components/CheckBoxItem'

// 【改造】「车机模式」开关：重新排版 + 整体放大，适合车机远距离观看和触摸
export default memo(() => {
  const t = useI18n()
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    void getCarMode().then(setEnabled)
  }, [])

  const handleChange = (val: boolean) => {
    setEnabled(val)
    // 立即更新内存中的开关，页面布局在下次启动读取时才生效
    setCarModeEnabled(val)
    void saveCarMode(val)
    toast(t('setting_basic_car_mode_restart_tip'), 'long')
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={enabled}
        label={t('setting_basic_car_mode')}
        helpDesc={t('setting_basic_car_mode_tip')}
        onChange={handleChange} />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
