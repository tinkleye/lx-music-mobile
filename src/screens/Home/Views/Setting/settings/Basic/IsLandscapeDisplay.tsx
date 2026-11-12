import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'

import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { getLandscapeDisplay, saveLandscapeDisplay } from '@/utils/data'

import CheckBoxItem from '../../components/CheckBoxItem'

// 【v40】「横屏显示」独立开关：
//   车机/超宽屏设备默认开（与旧版行为一致），手机默认关（消除旧版
//   "启动先横屏再转竖屏"的闪现）。切换立即生效（原生 setRequestedOrientation），
//   并持久化到 SharedPreferences 供下次启动第一帧前读取。
//   与「车机模式」解耦：手机上开横屏显示不会启用车机排版，反之亦然。
export default memo(() => {
  const t = useI18n()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void getLandscapeDisplay().then(setEnabled)
  }, [])

  const handleChange = (val: boolean) => {
    setEnabled(val)
    saveLandscapeDisplay(val)
    toast(t('setting_basic_landscape_tip'), 'short')
  }

  return (
    <View style={styles.content}>
      {
        enabled === null
          ? null
          : (
              <CheckBoxItem
                check={enabled}
                label={t('setting_basic_landscape')}
                helpDesc={t('setting_basic_landscape_desc')}
                onChange={handleChange} />
            )
      }
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
