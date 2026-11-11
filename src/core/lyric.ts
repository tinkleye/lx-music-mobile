import {
  play as lrcPlay,
  setLyric as lrcSetLyric,
  pause as lrcPause,
  setPlaybackRate as lrcSetPlaybackRate,
  toggleTranslation as lrcToggleTranslation,
  toggleRoma as lrcToggleRoma,
  init as lrcInit,
} from '@/plugins/lyric'
import {
  playDesktopLyric,
  setDesktopLyric,
  pauseDesktopLyric,
  setDesktopLyricPlaybackRate,
  toggleDesktopLyricTranslation,
  toggleDesktopLyricRoma,
} from '@/core/desktopLyric'
import { getPosition } from '@/plugins/player'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { updateNowPlayingTitles } from '@/plugins/player/utils'
import { sanitizeLyricForMediaSession } from '@/utils/music'

/**
 * init lyric
 */
export const init = async() => {
  return lrcInit()
}

/**
 * 【v34】增强型（逐字）LRC 降级处理。
 * 逐字 LRC 会在一行文本内嵌大量时间标签，如：[00:48.793]谁[00:49.342]令[00:49.593]我...
 * 底层解析库 lrc-file-parser 只剥离行首时间标签组，行内时间标签会原样残留在
 * 歌词文本里显示出来。这里把行内时间标签剥掉，降级为普通逐行 LRC
 * （保留每行首时间标签组，滚动同步不受影响）。
 * 覆盖 app 内歌词视图、桌面歌词、MediaSession 三个下游。
 */
const lineStartTimeExp = /^(?:\[[\d:.]+\])+/
const inlineTimeHasExp = /\[[\d:.]+\]/ // 仅 test 用（避免 /g 正则 lastIndex 状态残留）
const inlineTimeExp = /\[[\d:.]+\]/g

export const sanitizeEnhancedLrc = (lrc: string): string => {
  if (!lrc) return lrc
  const lines = lrc.split(/\r\n|\n|\r/)
  let changed = false
  const out = lines.map(line => {
    const m = line.match(lineStartTimeExp)
    if (!m) return line
    const text = line.slice(m[0].length)
    if (!inlineTimeHasExp.test(text)) return line
    changed = true
    return m[0] + text.replace(inlineTimeExp, '')
  })
  return changed ? out.join('\n') : lrc
}

/**
 * set lyric
 * @param lyric lyric str
 * @param translation lyric translation
 */
const handleSetLyric = async(lyric: string, translation = '', romalrc = '') => {
  const cleanLyric = sanitizeEnhancedLrc(lyric)
  lrcSetLyric(cleanLyric, translation, romalrc)
  await setDesktopLyric(cleanLyric, translation, romalrc)
  if (settingState.setting['player.isShowBluetoothFullLyric']) {
    void updateNowPlayingTitles({
      lyric: sanitizeLyricForMediaSession(cleanLyric),
    })
  }
}

/**
 * play lyric
 * @param time play time
 */
export const handlePlay = (time: number) => {
  lrcPlay(time)
  void playDesktopLyric(time)
}

/**
 * pause lyric
 */
export const pause = () => {
  lrcPause()
  void pauseDesktopLyric()
}

/**
 * stop lyric
 */
export const stop = () => {
  void handleSetLyric('')
}

/**
 * set playback rate
 * @param playbackRate playback rate
 */
export const setPlaybackRate = async(playbackRate: number) => {
  lrcSetPlaybackRate(playbackRate)
  await setDesktopLyricPlaybackRate(playbackRate)
  if (playerState.isPlay) {
    setTimeout(() => {
      void getPosition().then((position) => {
        handlePlay(position * 1000)
      })
    })
  }
}

/**
 * toggle show translation
 * @param isShowTranslation is show translation
 */
export const toggleTranslation = async(isShowTranslation: boolean) => {
  lrcToggleTranslation(isShowTranslation)
  await toggleDesktopLyricTranslation(isShowTranslation)
  if (playerState.isPlay) play()
}

/**
 * toggle show roma lyric
 * @param isShowLyricRoma is show roma lyric
 */
export const toggleRoma = async(isShowLyricRoma: boolean) => {
  lrcToggleRoma(isShowLyricRoma)
  await toggleDesktopLyricRoma(isShowLyricRoma)
  if (playerState.isPlay) play()
}

export const play = () => {
  void getPosition().then((position) => {
    handlePlay(position * 1000)
  })
}


export const setLyric = async() => {
  if (!playerState.musicInfo.id) return
  if (playerState.musicInfo.lrc) {
    let tlrc = ''
    let rlrc = ''
    if (playerState.musicInfo.tlrc) tlrc = playerState.musicInfo.tlrc
    if (playerState.musicInfo.rlrc) rlrc = playerState.musicInfo.rlrc
    await handleSetLyric(playerState.musicInfo.lrc, tlrc, rlrc)
  }

  if (playerState.isPlay) play()
}
