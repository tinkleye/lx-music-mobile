/**
 * 【改造】车机模式。
 *
 * 车机屏幕的特点：尺寸大、距离人眼远（60~70cm 而不是手机的 30cm）、
 * 行驶中手指会晃动、常见 8:3 超宽屏（如 1920x720）。
 *
 * 车机模式是唯一的模式开关，做三件事：
 *   1. 整体缩放：把界面的尺寸和字号统一放大，远距离也能看清、一次点准；
 *   2. 重新排版：导航栏显示文字、播放页改成左右两栏、去掉重复标题栏，
 *      避免超宽屏把内容拉得太散；
 *   3. 自动全屏：隐藏系统状态栏、底部导航栏，在车机上通常还能连带隐藏
 *      底部的空调控制栏（全屏判断见 config/fullscreen.ts）。
 *
 * 关闭车机模式 = 回到原版 App：排版恢复手机版，系统栏也一并显示回来。
 *
 * 注意：开关状态在启动最早期（app.ts）读取，必须在导航等页面模块被加载之前
 * 就确定下来，因为这些模块的 createStyle 只在加载时求值一次。
 * 所以切换开关后需要重启 App 才能完全生效。
 */

let enabled = false
let uiScale = 1.15

/** 是否启用车机模式 */
export const isCarModeEnabled = (): boolean => enabled
export const setCarModeEnabled = (enable: boolean) => {
  enabled = enable
}

/** 界面整体放大倍数，车机模式下生效；1.0 表示维持原有尺寸 */
export const getCarUIScale = (): number => enabled ? uiScale : 1
export const setCarUIScale = (scale: number) => {
  uiScale = scale
}

/**
 * 车机模式下的布局参数。单位与原有样式一致（dp），会和其他尺寸一样
 * 再经过 scaleSizeH / scaleSizeW 的屏幕换算，不要在这里做二次放大。
 */
export const CAR = {
  /**
   * 左侧导航栏宽度。
   *
   * 原来 68 只够放一个图标；加宽是为了放「图标 + 下面一行文字」。
   * 实测 92、74 都偏空，收到 66：最长的一项「我的列表」四个字约 44 宽，
   * 两侧仍各有 11 的余量；图标 22 宽，两侧 22。再小文字就会显得挤。
   */
  navWidth: 66,
  /** 导航图标字号 */
  navIconSize: 22,
  /** 导航文字字号 */
  navLabelSize: 11,
  /** 导航项上下内边距，加大触摸区域 */
  navItemPaddingV: 12,
  /** 顶部标题栏：横屏下原来是 42 * 0.8，车机上不再打折 */
  headerScale: 1,
  /** 歌词区最大阅读宽度：太宽了一行字太长，眼睛要来回扫 */
  lyricMaxWidth: 880,
} as const
