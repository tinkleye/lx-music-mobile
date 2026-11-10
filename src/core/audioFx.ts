import { NativeModules } from 'react-native'
import settingState from '@/store/setting/state'

/**
 * 【车机改造】均衡器：把系统 EQ/重低音挂到播放器音频会话。
 * 预设为 5 段设计，实际频段数因设备而异，按比例映射。
 */

export const EQ_PRESETS = {
  off: { label: '关闭', bands: [0, 0, 0, 0, 0], bass: 0 },
  pop: { label: '流行', bands: [2, 1, 0, -1, -1], bass: 0 },
  rock: { label: '摇滚', bands: [3, 1, -1, 1, 2], bass: 0 },
  vocal: { label: '人声', bands: [-1, 0, 2, 2, 0], bass: 0 },
  classical: { label: '古典', bands: [0, 0, 0, 2, 2], bass: 0 },
  bass: { label: '重低音', bands: [5, 4, 1, 0, 0], bass: 500 },
} as const

export type EQPresetName = keyof typeof EQ_PRESETS

export const getEQPresetNames = () => Object.keys(EQ_PRESETS) as EQPresetName[]

let currentSessionId = -1

// 预设增益(dB) → 毫贝，并按实际频段数等比映射
const buildBandLevels = (preset: EQPresetName, bandCount: number): number[] => {
  const src = EQ_PRESETS[preset].bands
  const levels: number[] = []
  for (let i = 0; i < bandCount; i++) {
    // 把 5 段设计映射到 N 段：取比例位置两侧插值
    const pos = (i / Math.max(1, bandCount - 1)) * (src.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(src.length - 1, lo + 1)
    const frac = pos - lo
    const db = src[lo] * (1 - frac) + src[hi] * frac
    levels.push(Math.round(db * 100))
  }
  return levels
}

/**
 * 将当前 EQ 设置应用到播放器；在播放器就绪后与每次会话变化时调用
 */
export const applyEqualizer = async(force = false) => {
  try {
    const preset: EQPresetName = settingState.setting['player.eqPreset'] ?? 'off'
    const TrackPlayer = NativeModules.TrackPlayerModule
    if (!TrackPlayer?.getAudioSessionId) return
    const sessionId: number = await TrackPlayer.getAudioSessionId()
    if (!sessionId || sessionId <= 0) return
    if (currentSessionId == sessionId && !force) return
    currentSessionId = sessionId

    const fx = NativeModules.AudioFxModule
    const ok = await fx.attach(sessionId)
    if (!ok) return

    const bandCount: number = await fx.getBandCount()
    if (bandCount <= 0) return

    if (preset == 'off') {
      await fx.setEnabled(false)
    } else {
      await fx.setEnabled(true)
      await fx.setBandLevels(buildBandLevels(preset, bandCount))
      await fx.setBassBoost(EQ_PRESETS[preset].bass)
    }
  } catch {
    // EQ 挂载失败不影响播放
  }
}

/**
 * 用户切换预设
 */
export const setEQPreset = async(preset: EQPresetName) => {
  const { updateSetting } = await import('@/core/common')
  updateSetting({ 'player.eqPreset': preset })
  // 预设切换需要强制重发
  currentSessionId = -1
  await applyEqualizer()
}
