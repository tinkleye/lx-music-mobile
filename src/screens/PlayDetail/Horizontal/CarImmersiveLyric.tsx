import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'

import Text from '@/components/common/Text'
import Slider from '@/components/common/Slider'
import { Icon } from '@/components/common/Icon'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { toggleTranslation } from '@/core/lyric'
import { usePlayerMusicInfo, useProgress, useIsPlay } from '@/store/player/hook'
import { playPrev, playNext, togglePlay } from '@/core/player/player'
import settingState from '@/store/setting/state'
import { useI18n } from '@/lang'
import {
  CAR_LYRIC_BLUR_RATIO,
  CAR_LYRIC_COLORS,
  CAR_LYRIC_FONT_FAMILY,
  CAR_LYRIC_NIGHT_DIM,
  dimColor,
  getCarLyricSetting,
  loadCarLyricSetting,
  saveCarLyricSetting,
  type CarLyricSetting,
} from '@/config/carLyric'
import { CAR_LYRIC_SCRIM } from '@/config/carLyricBg'
import { scaleSizeW, scaleSizeH, setSpText } from '@/utils/pixelRatio'
import { useDrag } from '@/utils/hooks'
import { formatPlayTime2 } from '@/utils/common'

/**
 * 【车机改造】沉浸式歌词
 *
 * 车机屏幕宽、离得远，播放页右栏那半屏歌词其实还有很多空间没用上。
 * 双击歌词区进入这个模式后：所有导航栏、封面、按钮全部隐去，
 * 整块屏幕只留「正在唱的这句」，字号可以拉到很大，停车时看着很舒服。
 *
 * 交互（和常见音乐 App 的沉浸歌词一致）：
 * - 单击空白处：显示 / 隐藏底部控制条（时间、进度、上一首、播放暂停、下一首），5 秒无操作自动收起
 * - 双击空白处：返回原播放界面
 * - 长按空白处：弹出设置面板（字号 / 字色 / 对齐 / 字重 / 翻译 / 背景），拖动即时生效
 * - 面板打开时点一下：先收起面板
 * - 底部进度条可直接点按 / 拖动跳转，时间在左下、总时长在右下
 */

const BAR_HEIGHT = 5
const THUMB_SIZE = 13
const TOUCH_HEIGHT = scaleSizeH(40)
const PLAY_BTN_SIZE = Math.round(scaleSizeH(44))
/** 控制条无操作后自动收起的时间 */
export const CONTROLS_HIDE_DELAY = 5000

/**
 * 底部控制条：时间 + 可拖动进度 + 上一首 / 播放暂停 / 下一首。
 *
 * 拆成独立组件的原因有三个：
 * 1. 播放进度每几百毫秒变一次，放在主组件里会把大号歌词一起重渲染；
 * 2. 拖动进度需要自己的手势状态，独立出来后不影响外面的单击/双击/长按判定；
 * 3. 默认是隐藏的（车机上只看歌词最清爽），单击才浮出来。
 */
const ImmersiveBar = memo(({ visible, onInteract }: { visible: boolean, onInteract: () => void }) => {
  const { progress, maxPlayTime, nowPlayTimeStr, maxPlayTimeStr } = useProgress()
  const isPlay = useIsPlay()
  const [dragging, setDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const [width, setWidth] = useState(0)
  const durationRef = useRef(maxPlayTime)
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    durationRef.current = maxPlayTime
  }, [maxPlayTime])

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [anim, visible])

  const onSetProgress = useCallback((p: number) => {
    global.app_event.setProgress(p * durationRef.current)
  }, [])
  const { onLayout, onDragStart, onDragEnd, onDrag } = useDrag(onSetProgress, setDragging, setDragProgress)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        onDragStart(gestureState.dx, evt.nativeEvent.locationX)
      },
      onPanResponderMove: (evt, gestureState) => {
        onDrag(gestureState.dx)
      },
      onPanResponderRelease: () => { onDragEnd() },
      onPanResponderTerminate: () => { onDragEnd() },
    }),
  ).current

  const shown = dragging ? dragProgress : progress
  const barWidth = Math.max(width * shown, 0)
  const nowLabel = dragging ? formatPlayTime2(dragProgress * maxPlayTime) : nowPlayTimeStr

  return (
    <Animated.View
      style={{
        ...styles.bottomBar,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [scaleSizeH(16), 0] }) }],
      }}
      // 隐藏时不吃触摸，单击 / 双击 / 长按都能落到下面的歌词层
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.timeRow} pointerEvents="none">
        <Text size={12} color="rgba(255,255,255,0.66)" style={styles.timeText}>{nowLabel}</Text>
        <View style={styles.timeFill} />
        <Text size={12} color="rgba(255,255,255,0.66)" style={{ ...styles.timeText, textAlign: 'right' }}>{maxPlayTimeStr}</Text>
      </View>
      <View
        style={styles.trackTouch}
        {...panResponder.panHandlers}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width)
          onLayout(e)
        }}
      >
        <View style={styles.track} pointerEvents="none" />
        <View style={{ ...styles.trackFill, width: barWidth }} pointerEvents="none" />
        <View
          style={{
            ...styles.thumb,
            left: barWidth - THUMB_SIZE / 2,
            transform: [{ scale: dragging ? 1.15 : 1 }],
          }}
          pointerEvents="none"
        />
      </View>
      {/* 上一首 / 播放暂停 / 下一首：车机上按钮要够大，别再让人找 */}
      <View style={styles.ctrlRow}>
        <Pressable
          style={styles.sideBtn}
          onPress={() => { onInteract(); void playPrev() }}
          android_disableSound
        >
          <Icon name="prevMusic" size={24} color="rgba(255,255,255,0.88)" />
        </Pressable>
        <Pressable
          style={styles.playBtn}
          onPress={() => { onInteract(); togglePlay() }}
          android_disableSound
        >
          <Icon name={isPlay ? 'pause' : 'play'} size={24} color="#121214" />
        </Pressable>
        <Pressable
          style={styles.sideBtn}
          onPress={() => { onInteract(); void playNext() }}
          android_disableSound
        >
          <Icon name="nextMusic" size={24} color="rgba(255,255,255,0.88)" />
        </Pressable>
      </View>
    </Animated.View>
  )
})

/** 设置面板：两栏网格里的一个格子（标签在上，控件在下） */
const Cell = ({ label, children }: { label: string, children: ReactNode }) => (
  <View style={styles.cell}>
    <Text size={12} color="rgba(255,255,255,0.5)" numberOfLines={1} style={styles.cellLabel}>{label}</Text>
    <View style={styles.cellBody}>{children}</View>
  </View>
)

/** 一组分段选择按钮（紧凑版，面板里两栏并排用） */
const Options = <T extends string | number>({ value, options, onChange }: {
  value: T
  options: Array<{ value: T, label: string }>
  onChange: (value: T) => void
}) => (
  <View style={styles.optionRow}>
    {
      options.map(option => {
        const active = option.value == value
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => { onChange(option.value) }}
            style={{
              ...styles.segment,
              backgroundColor: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.10)',
            }}
          >
            <Text size={12} color={active ? '#111' : 'rgba(255,255,255,0.75)'}>{option.label}</Text>
          </Pressable>
        )
      })
    }
  </View>
)

export default memo(({ onClose }: { onClose: () => void }) => {
  const t = useI18n()
  const { width, height } = useWindowDimensions()
  const musicInfo = usePlayerMusicInfo()
  const { line } = useLrcPlay()
  const lines = useLrcSet()

  const [setting, setSetting] = useState<CarLyricSetting>(getCarLyricSetting())
  const [showSetting, setShowSetting] = useState(false)
  const [showHint, setShowHint] = useState(true)
  // 底部控制条默认隐藏，单击才浮出来，5 秒没操作自动收起
  const [showControls, setShowControls] = useState(false)
  /**
   * 换句动画用「双层交叉淡化」：两个槽位轮流装新旧两句歌词，
   * 换句时旧句淡出上移、新句淡入上浮，两句话同时在屏上交叠，
   * 中间不再出现「先空一下再冒出来」的黑档，看起来连贯得多。
   */
  type LyricSlot = { text: string, translation: string }
  const [slots, setSlots] = useState<LyricSlot[]>([{ text: '', translation: '' }, { text: '', translation: '' }])
  // 当前显示内容的槽位下标（0/1）
  const activeSlotRef = useRef(0)
  const slotOpacity = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(0)).current,
  ]
  const slotLift = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ]

  const enterOpacity = useRef(new Animated.Value(0)).current
  const panelAnim = useRef(new Animated.Value(0)).current
  const lastTapRef = useRef(0)
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null)
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 单击后要等一下，确认不是双击的第二下，再去显示控制条
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstLineRef = useRef(true)

  const current = lines[line]
  const text = current?.text ?? ''
  const translation = current?.extendedLyrics?.[0] ?? ''

  useEffect(() => {
    void loadCarLyricSetting().then(setSetting)
    Animated.timing(enterOpacity, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [enterOpacity])

  /**
   * 歌词解析插件只有在「显示翻译」打开时，才会把译文放进 extendedLyrics。
   * 所以这个模式里要翻译、而全局没开翻译时，临时帮它打开；退出时还原。
   * 不这么做的话，面板里勾了「显示翻译」也永远没有内容——这就是上一版「翻译无效」的原因。
   */
  const translationForcedRef = useRef(false)
  useEffect(() => {
    if (!setting.showTranslation) {
      if (translationForcedRef.current) {
        translationForcedRef.current = false
        void toggleTranslation(false)
      }
      return
    }
    if (settingState.setting['player.isShowLyricTranslation']) return
    if (translationForcedRef.current) return
    translationForcedRef.current = true
    void toggleTranslation(true)
  }, [setting.showTranslation])

  useEffect(() => () => {
    if (!translationForcedRef.current) return
    translationForcedRef.current = false
    void toggleTranslation(false)
  }, [])

  // 换句：旧句淡出上移、新句淡入上浮，交叉进行（柔和档更慢更连贯）
  useEffect(() => {
    const incoming = { text, translation }
    // 刚进入这个模式时直接落到当前这句，不要先淡出一次（会闪）
    if (isFirstLineRef.current) {
      isFirstLineRef.current = false
      const idx = activeSlotRef.current
      slotOpacity.forEach((v, i) => v.stopAnimation())
      slotOpacity[idx].setValue(1)
      slotLift[idx].setValue(0)
      setSlots(prev => prev.map((s, i) => i == idx ? incoming : s))
      return
    }
    // 关掉动画（部分车机 GPU 弱）就直接换字
    if (setting.animate == 'off') {
      slotOpacity.forEach(v => v.stopAnimation())
      slotLift.forEach(v => v.stopAnimation())
      const idx = activeSlotRef.current
      slotOpacity[idx].setValue(1)
      slotLift[idx].setValue(0)
      slotOpacity[1 - idx].setValue(0)
      setSlots(prev => prev.map((s, i) => i == idx ? incoming : s))
      return
    }
    const soft = setting.animate == 'soft'
    const outIdx = activeSlotRef.current
    const inIdx = 1 - outIdx
    // 动画途中又来新句：停住当前动画，从当前透明度继续交叉，不闪不跳
    slotOpacity[outIdx].stopAnimation()
    slotOpacity[inIdx].stopAnimation()
    slotLift[outIdx].stopAnimation()
    slotLift[inIdx].stopAnimation()
    slotLift[inIdx].setValue(scaleSizeH(12))
    setSlots(prev => prev.map((s, i) => i == inIdx ? incoming : s))
    Animated.parallel([
      Animated.timing(slotOpacity[outIdx], { toValue: 0, duration: soft ? 340 : 180, useNativeDriver: true }),
      Animated.timing(slotLift[outIdx], { toValue: -scaleSizeH(10), duration: soft ? 400 : 240, useNativeDriver: true }),
      Animated.timing(slotOpacity[inIdx], { toValue: 1, duration: soft ? 480 : 300, useNativeDriver: true }),
      Animated.timing(slotLift[inIdx], { toValue: 0, duration: soft ? 540 : 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { activeSlotRef.current = inIdx })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, translation, setting.animate])

  // 提示文字 5 秒后自动淡出，别一直挂在屏幕上
  const restartHint = useCallback(() => {
    setShowHint(true)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    hintTimerRef.current = setTimeout(() => { setShowHint(false) }, 5000)
  }, [])

  useEffect(() => {
    restartHint()
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    }
  }, [restartHint])

  const handleClose = useCallback(() => {
    Animated.timing(enterOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => { onClose() })
  }, [enterOpacity, onClose])

  // 显示控制条并重新计时：点按钮也算「有操作」，5 秒后再收起
  const showControlsFor = useCallback(() => {
    setShowControls(true)
    setShowHint(false)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => { setShowControls(false) }, CONTROLS_HIDE_DELAY)
  }, [])

  const hideControls = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = null
    setShowControls(false)
  }, [])

  const openPanel = useCallback(() => {
    setShowSetting(true)
    setShowHint(false)
    setShowControls(false)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    Animated.timing(panelAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [panelAnim])

  const closePanel = useCallback(() => {
    Animated.timing(panelAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => { setShowSetting(false) })
  }, [panelAnim])

  const handlePress = useCallback(() => {
    if (showSetting) {
      closePanel()
      return
    }
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // 双击：退出沉浸模式
      lastTapRef.current = 0
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current)
        tapTimerRef.current = null
      }
      handleClose()
      return
    }
    lastTapRef.current = now
    // 单击：等 240ms 确认没有第二下，再切换控制条
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null
      // 这里不要清 lastTapRef：双击的第二下可能刚好落在 240~300ms 之间，
      // 清了就认不出双击，会退化成「又单击一次」
      if (showControls) hideControls()
      else showControlsFor()
    }, 240)
  }, [closePanel, handleClose, hideControls, showControls, showControlsFor, showSetting])

  const update = useCallback((patch: Partial<CarLyricSetting>) => {
    setSetting({ ...saveCarLyricSetting(patch) })
  }, [])

  const lyricSize = setting.fontSize
  const transSize = Math.max(Math.round(lyricSize * setting.translationScale), 12)
  const isCenter = setting.align == 'center'
  const emptyText = t('car_lyric_no_lyric')
  /**
   * 夜间模式：跟随系统深色模式（或强制开）时，把字体压暗、背景压得更深，
   * 晚上行车不至于晃眼。字色只对十六进制色生效，压暗比例见 CAR_LYRIC_NIGHT_DIM
   */
  const colorScheme = useColorScheme()
  const isNight = setting.nightMode == 'on' || (setting.nightMode == 'auto' && colorScheme == 'dark')
  const lyricColor = isNight ? dimColor(setting.color, CAR_LYRIC_NIGHT_DIM) : setting.color
  const emptyColor = isNight ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.3)'
  const showCover = setting.background == 'cover' && !!musicInfo.pic
  // 模糊半径跟着屏幕短边走：太小看不出模糊，太大安卓会糊成色块
  const blurRadius = Math.round(Math.min(Math.min(width, height) * CAR_LYRIC_BLUR_RATIO[setting.blur], 60))
  const fontFamily = CAR_LYRIC_FONT_FAMILY[setting.fontFamily]
  // 歌词垂直位置：偏上 / 居中 / 偏下
  const areaJustify = setting.position == 'top'
    ? 'flex-start'
    : setting.position == 'bottom' ? 'flex-end' : 'center'

  /**
   * 长句显示策略：先换行（最多 maxLines 行），换行后仍放不下才缩小字号。
   * 估算整句在这个字号下要占多宽，和「每行可视宽 × 行数」的总容量比：
   * - 容量足够 → 保持原字号，交给系统自然换行
   * - 容量不够 → 按比例缩小（中文/全角按 1 个字宽、英文数字按 0.56 算，
   *   letter-spacing 按字符数计入），缩到下限（14）仍放不下就继续换行，绝不裁字。
   */
  const fitFontSize = (raw: string, base: number, spacing: number, maxLines: number) => {
    if (!raw || width <= 0) return base
    const scr = PixelRatio.get()
    const avail = (width - scaleSizeW(64) * 2) * scr
    let em = 0
    for (const ch of raw) em += ch.charCodeAt(0) > 0x2e7f ? 1 : 0.56
    const needed = em * setSpText(base) * scr + raw.length * spacing * scr
    const capacity = avail * maxLines * 0.98
    if (needed <= capacity) return base
    return Math.max(Math.floor(base * capacity / needed), 14)
  }
  // 交叉淡化的舞台高度按「歌词两行 + 译文两行」预留，两句歌词同屏叠放时
  // 位置不会因为行数不同而上下跳；单行歌词在舞台里垂直居中
  const stageH = Math.round(setSpText(lyricSize) * 1.26 * 2)
    + (setting.showTranslation ? scaleSizeH(16) + Math.round(setSpText(transSize) * 1.35 * 2) : 0)

  // 悬浮设置卡宽度：约占屏宽 1/3、封顶 560，保证中间的歌词还看得见
  const panelWidth = Math.max(Math.min(Math.round(width * 0.34), 560), 420)

  return (
    <Animated.View
      style={{
        ...StyleSheet.absoluteFillObject,
        opacity: enterOpacity,
        backgroundColor: '#070709',
        overflow: 'hidden',
      }}
    >
      {/* ---------- 背景：封面模糊 + 大范围压暗 ---------- */}
      {
        showCover
          ? (
              <Image
                source={{ uri: musicInfo.pic! }}
                // 稍微放大一点，裁掉模糊在边缘产生的暗边
                style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.18 }] }]}
                resizeMode="cover"
                blurRadius={blurRadius}
              />
            )
          : null
      }
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          // 夜间模式把封面背景再压深一截，配合调暗的字体，晚上不晃眼
          backgroundColor: showCover
            ? (isNight ? 'rgba(4,5,8,0.78)' : 'rgba(6,7,10,0.56)')
            : (isNight ? 'rgba(5,5,7,0.99)' : 'rgba(7,7,9,0.97)'),
        }}
        pointerEvents="none"
      />
      {/* 上下压暗：一张拉伸的渐变图，过渡是逐像素的，不会出现色带 */}
      <Image
        source={{ uri: CAR_LYRIC_SCRIM }}
        style={styles.scrimBottom}
        resizeMode="stretch"
      />
      <Image
        source={{ uri: CAR_LYRIC_SCRIM }}
        style={styles.scrimTop}
        resizeMode="stretch"
      />

      {/* ---------- 主体（点按 / 长按都在这一层） ---------- */}
      <Pressable style={styles.touchArea} onPress={handlePress} onLongPress={openPanel} delayLongPress={420} android_disableSound>
        {/* 顶部：正在播放的歌，做得很轻，不抢歌词 */}
        {
          setting.showTitle
            ? (
                <View style={styles.topBar} pointerEvents="none">
                  <View style={styles.topDot} />
                  <Text size={12} color="rgba(255,255,255,0.55)" numberOfLines={1}>
                    {`${musicInfo.name}${musicInfo.singer ? `  ·  ${musicInfo.singer}` : ''}`}
                  </Text>
                </View>
              )
            : null
        }

        {/* 中间：当前这一句（双层交叉淡化舞台） */}
        <View style={{ ...styles.lyricArea, justifyContent: areaJustify }} pointerEvents="none">
          <View style={{ width: '100%', height: stageH }}>
            {
              slots.map((slot, slotIndex) => {
                const lyricFit = fitFontSize(slot.text, lyricSize, 1.2, 2)
                const transFit = fitFontSize(slot.translation, transSize, 0.8, 2)
                return (
                  <Animated.View
                    key={slotIndex}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      height: stageH,
                      justifyContent: 'center',
                      opacity: slotOpacity[slotIndex],
                      transform: [{ translateY: slotLift[slotIndex] }],
                    }}
                  >
                    <Text
                      style={{
                        textAlign: setting.align,
                        lineHeight: Math.round(setSpText(lyricFit) * 1.26),
                        letterSpacing: 1.2,
                        fontWeight: setting.bold ? '700' : '400',
                        fontFamily,
                        textShadowColor: 'rgba(0,0,0,0.6)',
                        textShadowOffset: { width: 0, height: 2 },
                        textShadowRadius: 16,
                        paddingLeft: isCenter ? 0 : scaleSizeW(6),
                      }}
                      size={lyricFit}
                      color={slot.text ? lyricColor : emptyColor}
                      textBreakStrategy="simple"
                    >{slot.text || emptyText}</Text>
                    {
                      setting.showTranslation && slot.translation
                        ? (
                            <Text
                              style={{
                                marginTop: scaleSizeH(16),
                                textAlign: setting.align,
                                lineHeight: Math.round(setSpText(transFit) * 1.35),
                                letterSpacing: 0.8,
                                opacity: 0.62,
                                fontFamily,
                                textShadowColor: 'rgba(0,0,0,0.5)',
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 10,
                              }}
                              size={transFit}
                              color={lyricColor}
                              textBreakStrategy="simple"
                            >{slot.translation}</Text>
                          )
                        : null
                    }
                  </Animated.View>
                )
              })
            }
          </View>
        </View>
      </Pressable>

      {/* ---------- 底部：单击才浮出的控制条（时间 / 进度 / 上一首 / 播放 / 下一首） ---------- */}
      <ImmersiveBar visible={showControls && !showSetting} onInteract={showControlsFor} />

      {/* 刚进入时的操作提示，5 秒自动消失 */}
      {
        showHint && !showControls && !showSetting
          ? (
              <View style={styles.hintBar} pointerEvents="none">
                <Text size={11} color="rgba(255,255,255,0.3)">{t('car_lyric_hint')}</Text>
              </View>
            )
          : null
      }

      {/* ---------- 设置面板：右侧悬浮小卡片，不压暗全屏，歌词实时可见 ---------- */}
      {
        showSetting
          ? (
              <Animated.View
                style={{
                  ...styles.panel,
                  width: panelWidth,
                  top: Math.round(height * 0.04),
                  maxHeight: height * 0.92,
                  opacity: panelAnim,
                  transform: [{ translateX: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                }}
              >
                {/* 注意：这里千万不要挂 onStartShouldSetResponder，
                    安卓上它会抢走触摸手势，里面的滚动区就拖不动了（第 22 版修掉的坑） */}
                <View style={styles.panelInner}>
                    <View style={styles.panelHeader}>
                      <Text size={15} color="#fff">{t('car_lyric_immersive')}</Text>
                      <Pressable onPress={closePanel} style={styles.panelClose} hitSlop={8}>
                        <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
                      </Pressable>
                    </View>

                    {/* 设置项排成两栏网格，尽量一屏放下；真放不下时面板内部可滚（手势不再被拦截） */}
                    <ScrollView
                      style={{ maxHeight: height * 0.8 }}
                      contentContainerStyle={{ paddingBottom: scaleSizeH(4) }}
                      showsVerticalScrollIndicator={false}
                      bounces={false}
                      overScrollMode="never"
                      nestedScrollEnabled
                    >
                      {/* 第 1 行：字号 | 字色 */}
                      <View style={styles.gridRow}>
                        <Cell label={t('car_lyric_font_size')}>
                          <View style={styles.sliderWrap}>
                            <Slider
                              value={lyricSize}
                              minimumValue={28}
                              maximumValue={140}
                              step={2}
                              onValueChange={(value) => { update({ fontSize: Math.round(value) }) }}
                            />
                          </View>
                          <Text size={12} color="rgba(255,255,255,0.75)" style={styles.cellValue}>{lyricSize}</Text>
                        </Cell>
                        <Cell label={t('car_lyric_font_color')}>
                          <View style={styles.swatchGroup}>
                            {
                              CAR_LYRIC_COLORS.map(color => {
                                const active = setting.color == color
                                return (
                                  <Pressable
                                    key={color}
                                    onPress={() => { update({ color }) }}
                                    style={{ ...styles.swatchRing, borderColor: active ? 'rgba(255,255,255,0.9)' : 'transparent' }}
                                    hitSlop={4}
                                  >
                                    <View style={{ ...styles.swatch, backgroundColor: color }} />
                                  </Pressable>
                                )
                              })
                            }
                          </View>
                        </Cell>
                      </View>

                      {/* 第 2 行：字体 | 位置 */}
                      <View style={styles.gridRow}>
                        <Cell label={t('car_lyric_font')}>
                          <Options
                            value={setting.fontFamily}
                            options={[
                              { value: 'default', label: t('car_lyric_font_default') },
                              { value: 'light', label: t('car_lyric_font_light') },
                              { value: 'serif', label: t('car_lyric_font_serif') },
                              { value: 'mono', label: t('car_lyric_font_mono') },
                            ]}
                            onChange={value => { update({ fontFamily: value }) }}
                          />
                        </Cell>
                        <Cell label={t('car_lyric_position')}>
                          <Options
                            value={setting.position}
                            options={[
                              { value: 'top', label: t('car_lyric_pos_top') },
                              { value: 'center', label: t('car_lyric_pos_center') },
                              { value: 'bottom', label: t('car_lyric_pos_bottom') },
                            ]}
                            onChange={value => { update({ position: value }) }}
                          />
                        </Cell>
                      </View>

                      {/* 第 3 行：对齐 | 字重 */}
                      <View style={styles.gridRow}>
                        <Cell label={t('car_lyric_align')}>
                          <Options
                            value={setting.align}
                            options={[
                              { value: 'center', label: t('car_lyric_align_center') },
                              { value: 'left', label: t('car_lyric_align_left') },
                            ]}
                            onChange={value => { update({ align: value }) }}
                          />
                        </Cell>
                        <Cell label={t('car_lyric_weight')}>
                          <Options
                            value={setting.bold ? 'bold' : 'normal'}
                            options={[
                              { value: 'normal', label: t('car_lyric_weight_normal') },
                              { value: 'bold', label: t('car_lyric_weight_bold') },
                            ]}
                            onChange={value => { update({ bold: value == 'bold' }) }}
                          />
                        </Cell>
                      </View>

                      {/* 第 4 行：显示翻译 | 译文字号 */}
                      <View style={styles.gridRow}>
                        <Cell label={t('car_lyric_show_translation')}>
                          <Options
                            value={setting.showTranslation ? 'on' : 'off'}
                            options={[
                              { value: 'on', label: t('car_lyric_on') },
                              { value: 'off', label: t('car_lyric_off') },
                            ]}
                            onChange={value => { update({ showTranslation: value == 'on' }) }}
                          />
                        </Cell>
                        <Cell label={t('car_lyric_trans_size')}>
                          <Options
                            value={setting.translationScale > 0.47 ? 'large' : setting.translationScale < 0.38 ? 'small' : 'medium'}
                            options={[
                              { value: 'small', label: t('car_lyric_size_small') },
                              { value: 'medium', label: t('car_lyric_size_medium') },
                              { value: 'large', label: t('car_lyric_size_large') },
                            ]}
                            onChange={value => {
                              update({ translationScale: value == 'small' ? 0.34 : value == 'large' ? 0.54 : 0.42 })
                            }}
                          />
                        </Cell>
                      </View>

                      {/* 第 5 行：顶部歌名 | 背景 */}
                      <View style={styles.gridRow}>
                        <Cell label={t('car_lyric_show_title')}>
                          <Options
                            value={setting.showTitle ? 'on' : 'off'}
                            options={[
                              { value: 'on', label: t('car_lyric_on') },
                              { value: 'off', label: t('car_lyric_off') },
                            ]}
                            onChange={value => { update({ showTitle: value == 'on' }) }}
                          />
                        </Cell>
                        <Cell label={t('car_lyric_bg')}>
                          <Options
                            value={setting.background}
                            options={[
                              { value: 'cover', label: t('car_lyric_bg_cover') },
                              { value: 'dark', label: t('car_lyric_bg_dark') },
                            ]}
                            onChange={value => { update({ background: value }) }}
                          />
                        </Cell>
                      </View>

                      {/* 第 6 行：背景模糊 | 夜间模式 */}
                      <View style={styles.gridRow}>
                        <Cell label={t('car_lyric_blur')}>
                          <Options
                            value={setting.blur}
                            options={[
                              { value: 'low', label: t('car_lyric_size_small') },
                              { value: 'medium', label: t('car_lyric_size_medium') },
                              { value: 'high', label: t('car_lyric_size_large') },
                            ]}
                            onChange={value => { update({ blur: value }) }}
                          />
                        </Cell>
                        <Cell label={t('car_lyric_night')}>
                          <Options
                            value={setting.nightMode}
                            options={[
                              { value: 'auto', label: t('car_lyric_night_auto') },
                              { value: 'on', label: t('car_lyric_night_on') },
                              { value: 'off', label: t('car_lyric_night_off') },
                            ]}
                            onChange={value => { update({ nightMode: value }) }}
                          />
                        </Cell>
                      </View>

                      {/* 第 7 行：换句动画（柔和 / 快速 / 关闭） */}
                      <View style={styles.gridRow}>
                        <Cell label={t('car_lyric_animate')}>
                          <Options
                            value={setting.animate}
                            options={[
                              { value: 'soft', label: t('car_lyric_anim_soft') },
                              { value: 'fast', label: t('car_lyric_anim_fast') },
                              { value: 'off', label: t('car_lyric_anim_off') },
                            ]}
                            onChange={value => { update({ animate: value }) }}
                          />
                        </Cell>
                      </View>
                    </ScrollView>

                    <Text size={11} color="rgba(255,255,255,0.35)" style={styles.panelTip}>{t('car_lyric_panel_tip')}</Text>
                  </View>
              </Animated.View>
            )
          : null
      }
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  touchArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: scaleSizeH(22),
    // 给底部时间 + 进度条留出位置，歌词再长也不会压到进度条上
    paddingBottom: scaleSizeH(78),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.9,
  },
  topDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  lyricArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: scaleSizeW(64),
  },
  // 底部渐变遮罩：图片本身是「上透明 → 下黑」，下边直接铺，上边旋转 180°
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
  },
  scrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '34%',
    transform: [{ rotate: '180deg' }],
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scaleSizeW(26),
    paddingBottom: scaleSizeH(10),
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSizeW(6),
    paddingBottom: scaleSizeH(4),
  },
  timeText: {
    minWidth: scaleSizeW(52),
  },
  timeFill: {
    flex: 1,
  },
  ctrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleSizeW(46),
    paddingTop: scaleSizeH(2),
  },
  sideBtn: {
    width: PLAY_BTN_SIZE,
    height: PLAY_BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: PLAY_BTN_SIZE + scaleSizeH(8),
    height: PLAY_BTN_SIZE + scaleSizeH(8),
    borderRadius: (PLAY_BTN_SIZE + scaleSizeH(8)) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  hintBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: scaleSizeH(26),
    alignItems: 'center',
  },
  trackTouch: {
    height: TOUCH_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: (TOUCH_HEIGHT - BAR_HEIGHT) / 2,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  thumb: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  /* ---------- 悬浮设置卡（右侧，约 1/3 屏宽，歌词仍可见） ---------- */
  panel: {
    position: 'absolute',
    right: scaleSizeW(18),
    paddingVertical: scaleSizeH(8),
    paddingHorizontal: scaleSizeW(12),
    backgroundColor: 'rgba(15,15,19,0.93)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  panelInner: {
    width: '100%',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSizeH(2),
  },
  panelClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  /* ---------- 两栏网格设置面板（紧凑档） ---------- */
  gridRow: {
    flexDirection: 'row',
    gap: scaleSizeW(12),
    marginBottom: scaleSizeH(3),
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  cellLabel: {
    marginBottom: scaleSizeH(1),
  },
  cellBody: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: scaleSizeH(26),
  },
  cellValue: {
    minWidth: scaleSizeW(26),
    textAlign: 'right',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  sliderWrap: {
    flex: 1,
    paddingRight: scaleSizeW(6),
  },
  swatchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scaleSizeW(5),
  },
  swatchRing: {
    width: scaleSizeW(24),
    height: scaleSizeW(24),
    borderRadius: scaleSizeW(12),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: scaleSizeW(16),
    height: scaleSizeW(16),
    borderRadius: scaleSizeW(8),
  },
  segment: {
    paddingLeft: scaleSizeW(10),
    paddingRight: scaleSizeW(10),
    paddingTop: scaleSizeH(4),
    paddingBottom: scaleSizeH(4),
    borderRadius: 12,
  },
  panelTip: {
    marginTop: scaleSizeH(4),
  },
})
