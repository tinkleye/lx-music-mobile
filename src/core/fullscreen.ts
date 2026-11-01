import { setFullscreen as setNativeFullscreen } from '@/utils/nativeModules/utils'
import { isFullscreenEnabled } from '@/config/fullscreen'
import { log } from '@/utils/log'

/**
 * 【改造】把设置项「启动即全屏」应用到原生窗口。
 *
 * 原生侧启动时默认就是全屏（避免启动瞬间闪一下状态栏），
 * 这里在设置初始化完成后调用一次：如果用户关掉了开关，就把系统栏还原出来。
 * 设置页切换开关时也会调用，即时生效。
 */
export const applyFullscreenSetting = () => {
  try {
    setNativeFullscreen(isFullscreenEnabled())
  } catch (err: any) {
    // 非 Android 平台或原生模块异常时不影响 App 运行
    log.error('applyFullscreenSetting failed: ' + String(err?.message ?? err))
  }
}
