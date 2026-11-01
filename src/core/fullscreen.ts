import { setFullscreen as setNativeFullscreen } from '@/utils/nativeModules/utils'
import { isFullscreenEnabled } from '@/config/fullscreen'
import { log } from '@/utils/log'

/**
 * 【改造】把「车机模式」的全屏状态应用到原生窗口。
 *
 * 原生侧启动时默认就是全屏（避免启动瞬间闪一下状态栏），
 * 这里在设置初始化完成后调用一次：如果车机模式是关的，就把系统栏还原出来。
 * 设置页切换「车机模式」开关时也会调用，全屏部分即时生效（排版仍需重启）。
 *
 * @param enable 可选，显式指定是否全屏。设置页刚改完开关、内存里的车机模式
 *               还没同步时用这个传值，避免读到旧状态。
 */
export const applyFullscreenSetting = (enable?: boolean) => {
  try {
    setNativeFullscreen(enable ?? isFullscreenEnabled())
  } catch (err: any) {
    // 非 Android 平台或原生模块异常时不影响 App 运行
    log.error('applyFullscreenSetting failed: ' + String(err?.message ?? err))
  }
}
