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
    // 【改造】把状态栏显隐写进全局默认值，这是"空调栏闪现"的源头修复。
    //
    // react-native-navigation 在每次切换页面时都会按「该页面的 statusBar 配置」
    // 重新应用一次窗口标志（setStatusBarVisible → clearFlags / addFlags）。
    // 如果某个页面漏配 visible，RNN 会按默认值 visible: true 处理，
    // 那一瞬间就会 clearFlags(FLAG_FULLSCREEN)，车机马上把空调栏推出来，
    // 等我们的原生守护再补回去，用户看到的就是"闪一下"。
    //
    // 写进 defaultOptions 后，任何没有显式配置的页面都会跟随车机模式，
    // 从源头上不再产生 clearFlags。
    statusBar: {
      visible: !isFullscreenEnabled(),
      drawBehind: true,
      backgroundColor: 'transparent',
      style: 'light',
    },
    // animations: {
    //   setRoot: {
    //     waitForRender: true,
    //   },
    // },
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
