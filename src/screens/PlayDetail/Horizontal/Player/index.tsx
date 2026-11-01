import { memo } from 'react'
import { View } from 'react-native'

// import Title from './components/Title'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import PlayInfo from './PlayInfo'
import ControlBtn from './ControlBtn'
import { marginLeftRaw } from '../constant'
import { isCarModeEnabled } from '@/config/carMode'

// 【改造】车机模式下播放器独占中间一栏，不再需要左侧让位给封面
const carMode = isCarModeEnabled()


export default memo(() => {
  return (
    <View style={styles.container} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
      <ControlBtn />
      <PlayInfo />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexShrink: 0,
    flexGrow: 1,
    marginLeft: carMode ? 0 : marginLeftRaw,
    // paddingRight: 15,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})
