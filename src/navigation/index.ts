import { Navigation } from 'react-native-navigation'
import * as screenNames from './screenNames'
import * as navigations from './navigation'
import { isFullscreenEnabled } from '@/config/fullscreen'

import registerScreens from './registerScreens'
import { removeComponentId } from '@/core/common'
import { onAppLaunched } from './regLaunchedEvent'

let unRegisterEvent: ReturnType<ReturnType<typeof Navigation.events>['registerScreenPoppedListener']>

const init = (callback: () => void | Promise<void>) => {
  // Register all screens on launch
  registerScreens()

  if (unRegisterEvent) unRegisterEvent.remove()

  Navigation.setDefaultOptions({
    // animations: {
    //   setRoot: {
    //     waitForRender: true,
    //   },
    // },
    // 【改造】默认状态栏可见性必须跟随车机模式。
    // react-native-navigation 在 setRoot / push 时会先用默认值应用一遍窗口参数，
    // 默认的 statusBar.visible 是 true —— 这一步会 clearFlags(FLAG_FULLSCREEN)，
    // 车机上表现为"进入某个页面后底部空调栏又冒出来"。
    // 这里把默认值对齐成全屏状态，从源头少一次被重置的机会（原生侧另有守护兜底）。
    statusBar: {
      visible: !isFullscreenEnabled(),
      drawBehind: true,
      backgroundColor: 'transparent',
    },
  })
  unRegisterEvent = Navigation.events().registerScreenPoppedListener(({ componentId }) => {
    removeComponentId(componentId)
  })
  onAppLaunched(() => {
    console.log('Register app launched listener')
    void callback()
  })
}

export * from './utils'
export * from './event'
export * from './hooks'

export {
  init,
  screenNames,
  navigations,
}
