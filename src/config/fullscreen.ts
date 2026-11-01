import settingState from '@/store/setting/state'

/**
 * 【改造】是否启用「启动即全屏」。
 *
 * 读取设置项 common.startupFullscreen，默认开启。
 * 供导航配置、顶部安全区计算使用 —— 关闭全屏时要让状态栏回来、恢复动态留白。
 */
export const isFullscreenEnabled = (): boolean => {
  return settingState.setting['common.startupFullscreen'] !== false
}
