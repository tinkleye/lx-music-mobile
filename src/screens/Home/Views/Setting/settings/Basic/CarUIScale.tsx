import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { getCarUIScale, saveCarUIScale } from '@/utils/data'
import { setCarUIScale } from '@/config/carMode'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'

// 【改造】车机模式下的界面大小：不同车机的屏幕密度差别很大，
// 同一套尺寸在某些车上偏大、在另一些车上偏小，这里给三档手动微调。
const LIST = [1, 1.15, 1.3] as const

export default memo(() => {
  const t = useI18n()
  const [scale, setScale] = useState<number>(1.15)

  useEffect(() => {
    void getCarUIScale().then(setScale)
  }, [])

  const handleChange = (val: number) => {
    setScale(val)
    setCarUIScale(val)
    void saveCarUIScale(val)
    toast(t('setting_basic_car_mode_restart_tip'), 'long')
  }

  return (
    <SubTitle title={t('setting_basic_car_ui_scale')}>
      <View style={styles.list}>
        {
          LIST.map(size => <CheckBox
            key={size}
            marginRight={8}
            check={scale == size}
            label={`${Math.round(size * 100)}%`}
            onChange={() => { handleChange(size) }}
            need />)
        }
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
