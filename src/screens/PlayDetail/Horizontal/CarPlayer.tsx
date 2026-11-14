import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import CarProgress from './CarProgress'
import { useProgress, usePlayerMusicInfo, useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { pop } from '@/navigation'
import commonState from '@/store/common/state'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { playPrev, playNext, togglePlay } from '@/core/player/player'
import { getPlayBarCoverRect } from '@/utils/coverTransition'

import Btn from './components/Btn'
import CommentBtn from './components/CommentBtn'
import DesktopLyricBtn from './components/DesktopLyricBtn'
import SettingPopup, { type SettingPopupType } from '../components/SettingPopup'
import TimeoutExitBtn from './MoreBtn/TimeoutExitBtn'
import MusicAddBtn from './MoreBtn/MusicAddBtn'
import PlayModeBtn from './MoreBtn/PlayModeBtn'
import BlockSingerBtn from '@/screens/PlayDetail/components/BlockSingerBtn'
import RoamBadge from '@/screens/PlayDetail/components/RoamBadge'

// 【改造】车机模式播放页左栏：参考车机 App 截图重排
// 顶部：返回 + 封面（黑胶唱片从封面右侧露出一截）+ 歌名/歌手
// 中部：进度条 + 两端时间
// 底部：播放模式 / 上一首 / 大圆形播放键 / 下一首 / 当前播放列表，以及一行小功能按钮

const TimeText = ({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  return <Text size={12} color={theme['c-500']}>{timeStr}</Text>
}

export default memo(({ coverSize, onShowPlayList }: { coverSize: number, onShowPlayList: () => void }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const { maxPlayTimeStr, nowPlayTimeStr } = useProgress()
  const isPlay = useIsPlay()
  const popupRef = useRef<SettingPopupType>(null)
  // 【v53】封面阴影延迟到进入动画完成后再加，避免阴影提前出现
  const [coverElevation, setCoverElevation] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => { setCoverElevation(true) }, 320)
    return () => { clearTimeout(t) }
  }, [])

  // 【v54】横屏车机封面「斜线放大」：从底部播放条封面位置/尺寸，同时 translate+scale
  // 斜线过渡到最终位置/尺寸（RNN shared element 在此布局下 X 算不准，改自己实现）
  const coverRef = useRef<View>(null)
  const coverAnim = useRef({
    tx: new Animated.Value(0),
    ty: new Animated.Value(0),
    scale: new Animated.Value(1),
    opacity: new Animated.Value(0),
  }).current
  useEffect(() => {
    const startRect = getPlayBarCoverRect()
    if (!startRect) {
      coverAnim.opacity.setValue(1)
      return
    }
    coverRef.current?.measureInWindow((fx, fy, fw, fh) => {
      if (fw <= 0 || fh <= 0) {
        coverAnim.opacity.setValue(1)
        return
      }
      const dx = (startRect.x + startRect.width / 2) - (fx + fw / 2)
      const dy = (startRect.y + startRect.height / 2) - (fy + fh / 2)
      const s = startRect.width / fw
      coverAnim.tx.setValue(dx)
      coverAnim.ty.setValue(dy)
      coverAnim.scale.setValue(s)
      coverAnim.opacity.setValue(1)
      Animated.parallel([
        Animated.timing(coverAnim.tx, { toValue: 0, duration: 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(coverAnim.ty, { toValue: 0, duration: 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(coverAnim.scale, { toValue: 1, duration: 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]).start()
    })
  }, [])

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
          <Animated.View ref={coverRef} style={{
            width: coverSize,
            height: coverSize,
            opacity: coverAnim.opacity,
            transform: [{ translateX: coverAnim.tx }, { translateY: coverAnim.ty }, { scale: coverAnim.scale }],
          }}>
            <Image url={musicInfo.pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={{
              width: coverSize,
              height: coverSize,
              borderRadius: 6,
              elevation: coverElevation ? 4 : 0,
            }} />
          </Animated.View>
        </View>
        <View style={styles.infoText}>
          {/* 【v56】漫游入口：横屏车机播放页没渲染 Header，单独一行放在歌名上方 */}
          <View style={styles.roamRow}>
            <RoamBadge size={12} />
          </View>
          {/* 【优化】歌名过长时不再被截断成一行：允许折成两行，超出两行才省略；
              行高稍微收紧一点，两行时看起来更整齐。
              原右侧的收藏星形按钮无响应已移除，歌名可用宽度因此变宽 */}
          <Text numberOfLines={2} size={19} style={styles.songName} ellipsizeMode="tail">{musicInfo.name}</Text>
          <Text numberOfLines={1} size={13} color={theme['c-font-label']}>{musicInfo.singer}</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progress}>
          <CarProgress />
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
        {/* 【修正】原来底色用 c-primary、图标用 c-button-font，两者其实是同一个主色，
            导致绿底绿图标看不见。改为实心主色底 + 页面背景色图标（浅色主题即白图标、
            深色主题即深色图标），保证任何主题下都能看清播放/暂停状态 */}
        <TouchableOpacity style={{ ...styles.cotrolBtn, width: bigPlaySize, height: bigPlaySize, borderRadius: bigPlaySize / 2, backgroundColor: theme['c-primary'] }} activeOpacity={0.7} onPress={handleTogglePlay}>
          <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-content-background']} rawSize={bigPlaySize * 0.5} />
        </TouchableOpacity>
        <TouchableOpacity style={{ ...styles.cotrolBtn, width: sideBtnSize, height: sideBtnSize }} activeOpacity={0.5} onPress={handlePlayNext}>
          <Icon name="nextMusic" color={theme['c-button-font']} rawSize={sideBtnSize * 0.7} />
        </TouchableOpacity>
        {/* 【改造】当前播放列表：点击后在左栏显示队列，10 秒无操作自动返回；
            【v56】图标颜色改与循环按钮一致（c-550）；
            【v58】改用与循环按钮相同的 Btn 组件，尺寸/粗细一致 */}
        <Btn icon="menu" onPress={onShowPlayList} />
      </View>

      <View style={styles.subRow}>
        <TimeoutExitBtn />
        <MusicAddBtn />
        <CommentBtn />
        <DesktopLyricBtn />
        {/* 【v51】屏蔽歌手图标放到歌词按钮右边 */}
        <BlockSingerBtn size={20} />
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
    // 星形收藏按钮移除后，歌名右侧不再预留按钮宽度，左右内边距也收紧
    paddingLeft: 16,
    paddingRight: 2,
    gap: 4,
  },
  songName: {
    // createStyle 会对 lineHeight 做字号缩放，这里写原始值即可
    lineHeight: 25,
  },
  roamRow: {
    flexDirection: 'row',
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
    // 控制行多了一个「播放列表」按钮，间距略收，避免窄屏下挤出去
    gap: 20,
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
