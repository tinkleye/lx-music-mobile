import { getData, saveData } from '@/plugins/storage'

/**
 * 【车机改造】沉浸式歌词模式的显示设置
 *
 * 独立存一份，不去动 App 原有的歌词设置：
 * 沉浸式是「只看一行大字」的场景，字号、字重、背景跟播放页右栏完全是两套观感，
 * 共用一份设置会导致两边互相打架。
 */
export interface CarLyricSetting {
  /** 字号（Text 组件的 size 值），车机上默认就比普通歌词大一倍多 */
  fontSize: number
  /** 歌词颜色，十六进制。除了纯白，暖白/淡黄这类颜色在夜景屏幕上更柔和 */
  color: string
  align: 'center' | 'left'
  bold: boolean
  showTranslation: boolean
  background: 'cover' | 'dark'
}

const STORAGE_KEY = '@car_immersive_lyric'

export const CAR_LYRIC_DEFAULT: CarLyricSetting = {
  fontSize: 42,
  color: '#FFFFFF',
  align: 'center',
  bold: true,
  showTranslation: true,
  background: 'cover',
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

let setting: CarLyricSetting = { ...CAR_LYRIC_DEFAULT }
let isLoaded = false

export const getCarLyricSetting = () => setting

export const loadCarLyricSetting = async() => {
  if (isLoaded) return setting
  isLoaded = true
  try {
    const data = await getData<CarLyricSetting>(STORAGE_KEY)
    if (data) setting = { ...CAR_LYRIC_DEFAULT, ...data }
  } catch {}
  return setting
}

export const saveCarLyricSetting = (patch: Partial<CarLyricSetting>) => {
  setting = { ...setting, ...patch }
  void saveData(STORAGE_KEY, setting)
  return setting
}
