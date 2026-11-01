import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'

import { getCarMode, saveCarMode } from '@/utils/data'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { applyFullscreenSetting } from '@/core/fullscreen'

import CheckBoxItem from '../../components/CheckBoxItem'

// 【改造】「车机模式」现在是唯一的模式开关，全屏已经并进来了：
//   打开 = 车机版排版（大按钮、少信息）+ 自动全屏（隐藏状态栏/导航栏/车机空调栏）
//   关闭 = 回到原版 App，系统栏也一起恢复
// 排版依赖 createStyle 在模块加载时求值，所以切换后需要重启 App 才能完整生效；
// 全屏部分走原生窗口，可以立即生效。
export default memo(() => {
  const t = useI18n()
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    void getCarMode().then(setEnabled)
  }, [])

  const handleChange = (val: boolean) => {
    setEnabled(val)
    void saveCarMode(val)
    // 全屏即时切换，不用等重启就能看到状态栏出现/消失。
    // 这里刻意不调用 setCarModeEnabled：避免界面一半新一半旧，
    // 排版统一留到重启后一次性生效。
    applyFullscreenSetting(val)
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
