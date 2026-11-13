/**
 * 【v54】横屏封面斜线放大过渡的位置传递。
 *
 * RNN 的 shared element 在横屏播放页（封面位于「返回按钮」右侧的 flex 布局里，
 * 水平位置与底部播放条封面存在错位）上算不准 X 位移，过渡呈现「先上再右」两段式。
 * 改为自己实现「封面从播放条位置斜线放大到最终位置」的动画，需要把底部播放条
 * 封面的全局位置/尺寸先记下来，播放页挂载时读取。
 */

export interface CoverRect {
  x: number
  y: number
  width: number
  height: number
}

let playBarCoverRect: CoverRect | null = null

/** 底部播放条封面在屏幕上的位置/尺寸（Pic.tsx 挂载时写入） */
export const setPlayBarCoverRect = (rect: CoverRect | null) => {
  playBarCoverRect = rect
}

/** 读取底部播放条封面位置（播放页封面做斜线放大动画的起点） */
export const getPlayBarCoverRect = (): CoverRect | null => playBarCoverRect
