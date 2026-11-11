import { getAppearance, getIsSupportedAutoTheme, onAppearanceChange } from '@/utils/tools'
import { setShouldUseDarkColors, applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes/index'
import settingState from '@/store/setting/state'
import { isCarModeEnabled } from '@/config/carMode'
import StatusBar from '@/components/common/StatusBar'
// import { Dimensions, PixelRatio } from 'react-native'


export default async(setting: LX.AppSetting) => {
  if (getIsSupportedAutoTheme()) {
    setShouldUseDarkColors(getAppearance() == 'dark')

    onAppearanceChange(color => {
      setShouldUseDarkColors((color ?? 'light') == 'dark')
      // 【车机改造】车机模式跟随系统走 common.themeMode，非车机走原版 isAutoTheme
      if (isCarModeEnabled()) {
        if (settingState.setting['common.themeMode'] == 'auto') void getTheme().then(applyTheme)
      } else if (settingState.setting['common.isAutoTheme']) {
        void getTheme().then(applyTheme)
      }
    })
  }

  applyTheme(await getTheme())

  global.state_event.on('themeUpdated', (theme) => {
    StatusBar.setBarStyle(theme.isDark ? 'light-content' : 'dark-content')
  })
  // onDimensionChange(({ window }) => {
  //   let screenW = window.width
  //   let screenH = window.height
  //   if (screenW > screenH) {
  //     const temp = screenW
  //     screenW = screenH
  //     screenH = temp
  //   }
  //   global.lx.windowInfo.screenW = screenW
  //   global.lx.windowInfo.screenH = screenH
  //   global.lx.windowInfo.screenPxW = PixelRatio.getPixelSizeForLayoutSize(screenW)
  //   global.lx.windowInfo.screenPxH = PixelRatio.getPixelSizeForLayoutSize(screenH)
  //   console.log('change', global.lx.windowInfo)
  // })
}
