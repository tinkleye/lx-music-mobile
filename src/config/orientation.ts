/**
 * 【v40】横屏显示方向标志（模块级，供启动早期与导航默认选项共享）。
 *
 * 必须放在 config 目录（轻量、无副作用）：app.ts 在车机模式设定之后才会
 * await import('@/navigation')——页面模块的 createStyle 只在加载时求值一次，
 * 若 app.ts 直接静态 import navigation 会导致所有页面样式提前求值
 * （v31 启动崩溃的同款陷阱，勿改回）。
 *
 * 值与 MainActivity 启动时 applyStartupOrientation 的结果一致：
 * 原生负责第一帧之前的方向，这里负责 RNN setDefaultOptions 声明同值，
 * 使 RNN 每次页面切换的 setRequestedOrientation 与当前方向一致。
 */

let landscape = true

export const isLandscapeOrientation = (): boolean => landscape
export const setLandscapeOrientation = (value: boolean) => {
  landscape = value
}
