import { Navigation } from 'react-native-navigation'
import * as screenNames from './screenNames'
import * as navigations from './navigation'
import { isFullscreenEnabled } from '@/config/fullscreen'
import { isLandscapeOrientation } from '@/config/orientation'

import registerScreens from './registerScreens'
import { removeComponentId } from '@/core/common'
import { onAppLaunched } from './regLaunchedEvent'

let unRegisterEvent: ReturnType<ReturnType<typeof Navigation.events>['registerScreenPoppedListener']>

// 【v40】方向声明：MainActivity 启动时按设置已定好方向；这里写进 RNN 全局
// defaultOptions，让 RNN 每次页面切换 applyOptions 时 setRequestedOrientation
// 应用的是与之一致的值，而不是默认的 UNSPECIFIED（解锁方向 —— 旧版手机上
// "先横屏再竖屏"闪现的另一半根源）。app.ts 启动时通过 config/orientation 设置。
const init = (callback: () => void | Promise<void>) => {
  // Register all screens on launch
  registerScreens()

  if (unRegisterEvent) unRegisterEvent.remove()

  Navigation.setDefaultOptions({
    // 【v40】方向与原生启动方向保持一致：横屏设备声明 sensorLandscape、
    // 竖屏设备声明 portrait，RNN 的 applyOrientation 不再造成可见变化
    layout: {
      orientation: [isLandscapeOrientation() ? 'sensorLandscape' : 'portrait'],
    },
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
    // 【改造】底部导航栏（车机上挂着空调栏）也要显式声明。
    //
    // 这是空调栏闪现的最终根因：导航库对没有设置的页面默认按「显示」处理，
    // 每次页面切换都会调用新版 insets API 的 showNavigationBar()，
    // 里面有一步 setDecorFitsSystemWindows(true)，把窗口从
    // "内容延伸到系统栏之下"的全屏状态拉回来 —— 空调栏就跟着冒出来。
    // 声明 visible:false 后，导航库走 hideNavigationBar()，
    // 正好等价于我们想要的沉浸式隐藏（含上滑临时唤出自动缩回）。
    navigationBar: {
      visible: !isFullscreenEnabled(),
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
