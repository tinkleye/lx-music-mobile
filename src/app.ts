import '@/utils/errorHandle'
import { init as initLog } from '@/utils/log'
import { bootLog, getBootLog } from '@/utils/bootLog'
import '@/config/globalData'
import { getFontSize, getCarMode, getCarUIScale, getLandscapeDisplay } from '@/utils/data'
import { setCarModeEnabled, setCarUIScale, getCarUIScale as getActiveUIScale } from '@/config/carMode'
import { applyFullscreenSetting } from '@/core/fullscreen'
import { exitApp } from './utils/nativeModules/utils'
import { windowSizeTools } from './utils/windowSizeTools'
import { listenLaunchEvent } from './navigation/regLaunchedEvent'
import { setLandscapeOrientation } from '@/config/orientation'
import { tipDialog } from './utils/tools'

console.log('starting app...')
listenLaunchEvent()

void Promise.all([getFontSize(), getCarMode(), getCarUIScale(), windowSizeTools.init(), getLandscapeDisplay()]).then(async([fontSize, carMode, carUIScale, , landscape]) => {
  // 【改造】车机模式必须在这里定下来：下面 await import('@/navigation') 才会加载
  // 各个页面的模块，而页面里的 createStyle 只在加载时求值一次。
  setCarUIScale(carUIScale)
  setCarModeEnabled(carMode)
  // 【v40】方向声明与 MainActivity 启动方向一致，RNN applyOptions 不再解锁方向
  setLandscapeOrientation(landscape)
  // 【改造】全屏已并入车机模式：尽早把原生窗口状态同步好，
  // 避免关闭车机模式时启动瞬间闪一下系统状态栏
  applyFullscreenSetting()
  global.lx.fontSize = fontSize * getActiveUIScale()
  bootLog('Font size setting loaded.')

  let isInited = false
  let handlePushedHomeScreen: () => void | Promise<void>

  const tryGetBootLog = () => {
    try {
      return getBootLog()
    } catch (err) {
      return 'Get boot log failed.'
    }
  }

  const handleInit = async() => {
    if (isInited) return
    void initLog()
    const { default: init } = await import('@/core/init')
    try {
      handlePushedHomeScreen = await init()
    } catch (err: any) {
      void tipDialog({
        title: '初始化失败 (Init Failed)',
        message: `Boot Log:\n${tryGetBootLog()}\n\n${(err.stack ?? err.message) as string}`,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
      return
    }
    isInited ||= true
  }
  const { init: initNavigation, navigations } = await import('@/navigation')

  initNavigation(async() => {
    await handleInit()
    if (!isInited) return
    // import('@/utils/nativeModules/cryptoTest')

    await navigations.pushHomeScreen().then(() => {
      void handlePushedHomeScreen()
    }).catch((err: any) => {
      // 【车机改造】弹窗附带堆栈前几行，便于远程排障（被 metro 吞错时尤其关键）
      const stackHead = String(err.stack ?? '').split('\n').slice(0, 6).join('\n')
      void tipDialog({
        title: 'Error',
        message: `${err.message}\n\n${stackHead}`,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
    })
  })
}).catch((err) => {
  void tipDialog({
    title: '初始化失败 (Init Failed)',
    message: `Boot Log:\n\n${(err.stack ?? err.message) as string}`,
    btnText: 'Exit',
    bgClose: false,
  }).then(() => {
    exitApp()
  })
})
