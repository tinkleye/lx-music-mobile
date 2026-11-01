import { memo, useEffect, useRef, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Progress from '@/components/player/Progress'
import { useProgress, usePlayerMusicInfo, useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { pop } from '@/navigation'
import commonState from '@/store/common/state'
import { NAV_SHEAR_NATIVE_IDS, LIST_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { getListMusics } from '@/core/list'
import { collectMusic, uncollectMusic, playPrev, playNext, togglePlay } from '@/core/player/player'
import playerState from '@/store/player/state'

import Btn from './components/Btn'
import CommentBtn from './components/CommentBtn'
import DesktopLyricBtn from './components/DesktopLyricBtn'
import SettingPopup, { type SettingPopupType } from '../components/SettingPopup'
import TimeoutExitBtn from './MoreBtn/TimeoutExitBtn'
import MusicAddBtn from './MoreBtn/MusicAddBtn'
import PlayModeBtn from './MoreBtn/PlayModeBtn'

// 【改造】车机模式播放页左栏：参考车机 App 截图重排
// 顶部：返回 + 封面（黑胶唱片从封面右侧露出一截）+ 歌名/歌手 + 收藏
// 中部：进度条 + 两端时间
// 底部：播放模式 / 上一首 / 大圆形播放键 / 下一首，以及一行小功能按钮

const getPlayMusicId = () => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo.id : musicInfo.id
}

// 收藏（红心）按钮：当前歌曲是否已在「我的收藏」列表里，点击切换
const LoveBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const [loved, setLoved] = useState(false)

  useEffect(() => {
    const id = musicInfo.id
    if (!id) {
      setLoved(false)
      return
    }
    let dead = false
    void getListMusics(LIST_IDS.LOVE).then(musics => {
      if (!dead) setLoved(musics.some(m => m.id == id))
    })
    const handleUpdate = (ids: string[]) => {
      if (!ids.includes(LIST_IDS.LOVE)) return
      void getListMusics(LIST_IDS.LOVE).then(musics => {
        if (!dead) setLoved(musics.some(m => m.id == id))
      })
    }
    global.app_event.on('myListMusicUpdate', handleUpdate)
    return () => {
      dead = true
      global.app_event.off('myListMusicUpdate', handleUpdate)
    }
  }, [musicInfo.id])

  const toggleLove = () => {
    const currentId = getPlayMusicId()
    if (!currentId) return
    if (loved) {
      uncollectMusic()
    } else {
      collectMusic()
    }
  }

  return (
    <TouchableOpacity style={{ ...styles.loveBtn, width: size, height: size }} activeOpacity={0.5} onPress={toggleLove}>
      <Icon name="love" color={loved ? theme['c-primary'] : theme['c-350']} rawSize={size * 0.55} />
    </TouchableOpacity>
  )
}

const TimeText = ({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  return <Text size={12} color={theme['c-500']}>{timeStr}</Text>
}

export default memo(({ coverSize }: { coverSize: number }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress()
  const isPlay = useIsPlay()
  const popupRef = useRef<SettingPopupType>(null)

  const back = () => {
    void pop(commonState.componentIds.playDetail!)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }
  const handlePlayPrev = () => {
    void playPrev()
  }
  const handlePlayNext = () => {
    void playNext()
  }
  const handleTogglePlay = () => {
    togglePlay()
  }

  // 黑胶唱片从封面右侧露出的宽度
  const peekWidth = coverSize * 0.18
  const bigPlaySize = Math.max(Math.min(coverSize * 0.5, 120), 64)
  const sideBtnSize = bigPlaySize * 0.55

  return (
    <View style={styles.container} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
      <View style={styles.infoRow}>
        <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.5}>
          <Icon name="chevron-left" size={18} color={theme['c-550']} />
        </TouchableOpacity>
        <View style={{ width: coverSize + peekWidth, height: coverSize, justifyContent: 'center' }}>
          <View style={{
            position: 'absolute',
            left: coverSize * 0.18,
            top: coverSize * 0.09,
            width: coverSize * 0.82,
            height: coverSize * 0.82,
            borderRadius: coverSize * 0.41,
            backgroundColor: '#26262a',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              width: coverSize * 0.1,
              height: coverSize * 0.1,
              borderRadius: coverSize * 0.05,
              backgroundColor: '#4a4a52',
            }} />
          </View>
          <Image url={musicInfo.pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={{
            width: coverSize,
            height: coverSize,
            borderRadius: 6,
            elevation: 4,
          }} />
        </View>
        <View style={styles.infoText}>
          <Text numberOfLines={1} size={20}>{musicInfo.name}</Text>
          <Text numberOfLines={1} size={13} color={theme['c-font-label']}>{musicInfo.singer}</Text>
        </View>
        <LoveBtn size={Math.max(sideBtnSize, 40)} />
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progress}>
          <Progress progress={progress} duration={maxPlayTime} buffered={0} />
        </View>
        <View style={styles.timeRow}>
          <TimeText timeStr={nowPlayTimeStr} />
          <TimeText timeStr={maxPlayTimeStr} />
        </View>
      </View>

      <View style={styles.controlsRow}>
        <PlayModeBtn />
        <TouchableOpacity style={{ ...styles.cotrolBtn, width: sideBtnSize, height: sideBtnSize }} activeOpacity={0.5} onPress={handlePlayPrev}>
          <Icon name="prevMusic" color={theme['c-button-font']} rawSize={sideBtnSize * 0.7} />
        </TouchableOpacity>
        <TouchableOpacity style={{ ...styles.cotrolBtn, width: bigPlaySize, height: bigPlaySize, borderRadius: bigPlaySize / 2, backgroundColor: theme['c-primary'] }} activeOpacity={0.7} onPress={handleTogglePlay}>
          <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-button-font']} rawSize={bigPlaySize * 0.5} />
        </TouchableOpacity>
        <TouchableOpacity style={{ ...styles.cotrolBtn, width: sideBtnSize, height: sideBtnSize }} activeOpacity={0.5} onPress={handlePlayNext}>
          <Icon name="nextMusic" color={theme['c-button-font']} rawSize={sideBtnSize * 0.7} />
        </TouchableOpacity>
      </View>

      <View style={styles.subRow}>
        <TimeoutExitBtn />
        <MusicAddBtn />
        <CommentBtn />
        <DesktopLyricBtn />
        <Btn icon="slider" onPress={showSetting} />
      </View>
      <SettingPopup ref={popupRef} position="left" direction="horizontal" />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 16,
  },
  infoRow: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 48,
    marginRight: 4,
  },
  infoText: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 18,
    paddingRight: 10,
    gap: 4,
  },
  loveBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  progress: {
    paddingHorizontal: 10,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  controlsRow: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
  },
  subRow: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  cotrolBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
