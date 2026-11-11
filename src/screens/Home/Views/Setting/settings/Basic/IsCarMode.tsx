import { memo } from 'react'
import { View } from 'react-native'

import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { applyFullscreenSetting } from '@/core/fullscreen'

import CheckBoxItem from '../../components/CheckBoxItem'

// 【改造】「车机模式」是唯一的模式开关，全屏已并入：
//   打开 = 车机版排版（大按钮、少信息）+ 自动全屏（隐藏状态栏/导航栏/车机空调栏）
//   关闭 = 回到原版 App，系统栏也一起恢复
// 【v33】改为受控组件：开关状态由 Basic/index 提升（用于联动显隐「界面大小/车机主题」子项）
export default memo(({ enabled, onChange }: {
  enabled: boolean
  onChange: (val: boolean) => void
}) => {
  const t = useI18n()

  const handleChange = (val: boolean) => {
    onChange(val)
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
