import { isCarModeEnabled } from '@/config/carMode'

/**
 * 【改造】全屏不再是一个独立开关，它已并入「车机模式」。
 *
 * 打开车机模式 = 车机版排版 + 自动全屏（隐藏系统状态栏、底部导航栏，
 *                在车机上通常还会连带隐藏底部空调栏）
 * 关闭车机模式 = 回到原版 App（系统栏恢复显示，排版也回到手机版）
 *
 * 这样只需要一个开关，不会出现「开了车机排版但状态栏还在」这种半吊子状态。
 * 本函数在导航配置、顶部安全区计算等处使用：车机模式下状态栏高度按 0 处理，
 * 让内容完全贴顶。
 */
export const isFullscreenEnabled = (): boolean => isCarModeEnabled()
