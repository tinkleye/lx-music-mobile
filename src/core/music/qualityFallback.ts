import settingState from '@/store/setting/state'
import { QUALITY_ORDER, getDownloadQualitys, getQualityLabel } from '@/core/download'

/**
 * 【v42】播放取链失败后的音质降级兜底。
 *
 * 播放链接重试链（含换源）走完仍失败时，尝试用低一档的可用音质取一次链接；
 * 每首歌在一次取址会话里只降级一次，成功后由 player 侧清除记录，
 * 下次正常播放仍按用户设置的音质优先。
 */

const triedIds = new Set<string>()

export interface QualityFallback {
  quality: LX.Quality
  label: string
}

/**
 * 返回可用的降级音质；没有可降级空间或已尝试过则返回 null。
 */
export const getMusicQualityFallback = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem): QualityFallback | null => {
  const target = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  if (!target || target.source == 'local') return null
  if (triedIds.has(target.id)) return null

  const current = settingState.setting['player.playQuality']
  const available = getDownloadQualitys(target).map(q => q.quality)
  if (!available.length) return null

  const curIdx = QUALITY_ORDER.indexOf(current)
  if (curIdx < 0) return null

  // 从当前音质往下找第一个源声明支持的音质
  const fallback = QUALITY_ORDER.slice(curIdx + 1).find(q => available.includes(q))
  if (!fallback) return null

  triedIds.add(target.id)
  return { quality: fallback, label: getQualityLabel(fallback) }
}

/** 播放成功（或切歌）后清除降级记录 */
export const clearQualityFallback = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem | null | undefined) => {
  if (!musicInfo) return
  const target = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  if (target) triedIds.delete(target.id)
}
