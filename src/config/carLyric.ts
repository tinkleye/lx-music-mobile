import { getData, saveData } from '@/plugins/storage'

/**
 * 【车机改造】沉浸式歌词模式的显示设置
 *
 * 独立存一份，不去动 App 原有的歌词设置：
 * 沉浸式是「只看一行大字」的场景，字号、字重、背景跟播放页右栏完全是两套观感，
 * 共用一份设置会导致两边互相打架。
 */
export type CarLyricFont = 'default' | 'light' | 'serif' | 'mono'
export type CarLyricPosition = 'top' | 'center' | 'bottom'
export type CarLyricBlur = 'low' | 'medium' | 'high'
/** 换句动画：柔和（较慢的交叉淡化，最自然）/ 快速（老版）/ 关闭 */
export type CarLyricAnimate = 'soft' | 'fast' | 'off'
/** 夜间模式：跟随系统深色模式自动切换 / 强制开 / 强制关 */
export type CarLyricNightMode = 'auto' | 'on' | 'off'

export interface CarLyricSetting {
  /** 字号（Text 组件的 size 值），车机上默认就比普通歌词大一倍多 */
  fontSize: number
  /** 歌词颜色，十六进制。除了纯白，暖白/淡黄这类颜色在夜景屏幕上更柔和 */
  color: string
  /** 字体：系统默认 / 细体 / 衬线 / 等宽 */
  fontFamily: CarLyricFont
  align: 'center' | 'left'
  bold: boolean
  /** 歌词在屏幕上的垂直位置 */
  position: CarLyricPosition
  showTranslation: boolean
  /** 译文字号相对歌词字号的比例 */
  translationScale: number
  showTitle: boolean
  background: 'cover' | 'dark'
  /** 封面模糊强度 */
  blur: CarLyricBlur
  /** 换句动画：柔和 / 快速 / 关闭（旧版存的是布尔值，读取时自动转换） */
  animate: CarLyricAnimate
  /** 夜间模式：晚上字体调暗、背景压得更深，可跟随系统深色模式 */
  nightMode: CarLyricNightMode
}

const STORAGE_KEY = '@car_immersive_lyric'

export const CAR_LYRIC_DEFAULT: CarLyricSetting = {
  fontSize: 42,
  color: '#FFFFFF',
  fontFamily: 'default',
  align: 'center',
  bold: true,
  position: 'center',
  showTranslation: true,
  translationScale: 0.42,
  showTitle: true,
  background: 'cover',
  blur: 'medium',
  animate: 'soft',
  nightMode: 'auto',
}

/** 可选的字色，都是在深色背景上够亮、又不刺眼的颜色 */
export const CAR_LYRIC_COLORS = [
  '#FFFFFF',
  '#F5E7C8',
  '#FFD166',
  '#9BE7C4',
  '#8ED1FC',
  '#FFA6C1',
] as const

/** 字体 → RN 的 fontFamily；default 返回 undefined（跟随系统） */
export const CAR_LYRIC_FONT_FAMILY: Record<CarLyricFont, string | undefined> = {
  default: undefined,
  light: 'sans-serif-light',
  serif: 'serif',
  mono: 'monospace',
}

/** 模糊强度 → 相对屏幕短边的比例（再乘屏幕尺寸，并封顶） */
export const CAR_LYRIC_BLUR_RATIO: Record<CarLyricBlur, number> = {
  low: 0.022,
  medium: 0.035,
  high: 0.052,
}

/** 夜间模式下字体压暗的比例：0.62 在黑暗车厢里看得清，又不晃眼 */
export const CAR_LYRIC_NIGHT_DIM = 0.62

/** 把 #RRGGBB 颜色按比例压暗（夜间模式用），非十六进制原样返回 */
export const dimColor = (hex: string, factor: number) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return hex
  const value = parseInt(match[1], 16)
  const r = Math.round(((value >> 16) & 255) * factor)
  const g = Math.round(((value >> 8) & 255) * factor)
  const b = Math.round((value & 255) * factor)
  return `rgb(${r},${g},${b})`
}

/** 旧版本存下来的数据可能缺字段，统一和默认值合并 */
const normalize = (data?: Partial<CarLyricSetting> | null): CarLyricSetting => {
  const merged = { ...CAR_LYRIC_DEFAULT, ...(data ?? {}) }
  // animate 老版本是布尔值：true → 柔和，false → 关闭
  if (typeof (merged as unknown as { animate?: unknown }).animate == 'boolean') {
    merged.animate = (merged as unknown as { animate: boolean }).animate ? 'soft' : 'off'
  }
  if (!['soft', 'fast', 'off'].includes(merged.animate)) merged.animate = 'soft'
  if (!['auto', 'on', 'off'].includes(merged.nightMode)) merged.nightMode = 'auto'
  return merged
}

let setting: CarLyricSetting = { ...CAR_LYRIC_DEFAULT }
let isLoaded = false

export const getCarLyricSetting = () => setting

export const loadCarLyricSetting = async() => {
  if (isLoaded) return setting
  isLoaded = true
  try {
    const data = await getData<Partial<CarLyricSetting>>(STORAGE_KEY)
    if (data) setting = normalize(data)
  } catch {}
  return setting
}

export const saveCarLyricSetting = (patch: Partial<CarLyricSetting>) => {
  setting = normalize({ ...setting, ...patch })
  void saveData(STORAGE_KEY, setting)
  return setting
}
