import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'

import Text from '@/components/common/Text'
import Slider from '@/components/common/Slider'
import { Icon } from '@/components/common/Icon'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useI18n } from '@/lang'
import {
  CAR_LYRIC_COLORS,
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
 * - 双击空白处：返回原播放界面
 * - 长按空白处：弹出设置面板（字号 / 字色 / 对齐 / 字重 / 翻译 / 背景），拖动即时生效
 * - 面板打开时点一下：先收起面板
 * - 底部进度条可直接点按 / 拖动跳转，时间在左下、总时长在右下
 */

const BAR_HEIGHT = 5
const THUMB_SIZE = 13
const TOUCH_HEIGHT = scaleSizeH(40)

/**
 * 底部进度条 + 时间。
 *
 * 拆成独立组件的原因有两个：
 * 1. 播放进度每几百毫秒变一次，放在主组件里会把大号歌词一起重渲染；
 * 2. 拖动进度需要自己的手势状态，独立出来后不影响外面的双击/长按判定。
 */
const ImmersiveProgress = memo(({ hintVisible, hintLabel }: { hintVisible: boolean, hintLabel: string }) => {
  const { progress, maxPlayTime, nowPlayTimeStr, maxPlayTimeStr } = useProgress()
  const [dragging, setDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const [width, setWidth] = useState(0)
  const durationRef = useRef(maxPlayTime)

  useEffect(() => {
    durationRef.current = maxPlayTime
  }, [maxPlayTime])

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
    <View style={styles.bottomBar} pointerEvents="box-none">
      <View style={styles.timeRow} pointerEvents="none">
        <Text size={12} color="rgba(255,255,255,0.62)" style={styles.timeText}>{nowLabel}</Text>
        <View style={styles.hintSlot}>
          <Text size={11} color={`rgba(255,255,255,${hintVisible ? 0.32 : 0})`}>{hintLabel}</Text>
        </View>
        <Text size={12} color="rgba(255,255,255,0.62)" style={{ ...styles.timeText, textAlign: 'right' }}>{maxPlayTimeStr}</Text>
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
    </View>
  )
})

/** 设置面板里的一个分段选择项 */
const Segment = <T extends string | number>({ label, value, options, onChange }: {
  label: string
  value: T
  options: Array<{ value: T, label: string }>
  onChange: (value: T) => void
}) => (
  <View style={styles.settingRow}>
    <Text size={13} color="rgba(255,255,255,0.65)" style={styles.settingLabel}>{label}</Text>
    <View style={styles.segmentGroup}>
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
              <Text size={13} color={active ? '#111' : 'rgba(255,255,255,0.75)'}>{option.label}</Text>
            </Pressable>
          )
        })
      }
    </View>
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
  const [display, setDisplay] = useState(() => ({
    text: lines[line]?.text ?? '',
    translation: lines[line]?.extendedLyrics?.[0] ?? '',
  }))

  const enterOpacity = useRef(new Animated.Value(0)).current
  const lineOpacity = useRef(new Animated.Value(1)).current
  const lineLift = useRef(new Animated.Value(0)).current
  const panelAnim = useRef(new Animated.Value(0)).current
  const lastTapRef = useRef(0)
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null)
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

  // 换句时先淡出再淡入，配合一点点上浮，看起来像「浮上来」
  useEffect(() => {
    // 刚进入这个模式时直接落到当前这句，不要先淡出一次（会闪）
    if (isFirstLineRef.current) {
      isFirstLineRef.current = false
      setDisplay({ text, translation })
      return
    }
    lineOpacity.stopAnimation()
    Animated.timing(lineOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setDisplay({ text, translation })
      lineLift.setValue(scaleSizeH(10))
      Animated.parallel([
        Animated.timing(lineOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(lineLift, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, translation])

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
    }
  }, [restartHint])

  const handleClose = useCallback(() => {
    Animated.timing(enterOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => { onClose() })
  }, [enterOpacity, onClose])

  const openPanel = useCallback(() => {
    setShowSetting(true)
    setShowHint(false)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
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
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0
      handleClose()
      return
    }
    lastTapRef.current = now
    restartHint()
  }, [closePanel, handleClose, restartHint, showSetting])

  const update = useCallback((patch: Partial<CarLyricSetting>) => {
    setSetting({ ...saveCarLyricSetting(patch) })
  }, [])

  const lyricSize = setting.fontSize
  const transSize = Math.max(Math.round(lyricSize * 0.42), 14)
  const isCenter = setting.align == 'center'
  const hasLyric = !!display.text
  const emptyText = t('car_lyric_no_lyric')
  const showCover = setting.background == 'cover' && !!musicInfo.pic
  // 模糊半径跟着屏幕短边走：太小看不出模糊，太大安卓会糊成色块
  const blurRadius = Math.round(Math.min(Math.min(width, height) * 0.035, 40))

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
          backgroundColor: showCover ? 'rgba(6,7,10,0.56)' : 'rgba(7,7,9,0.97)',
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
        <View style={styles.topBar} pointerEvents="none">
          <View style={styles.topDot} />
          <Text size={12} color="rgba(255,255,255,0.55)" numberOfLines={1}>
            {`${musicInfo.name}${musicInfo.singer ? `  ·  ${musicInfo.singer}` : ''}`}
          </Text>
        </View>

        {/* 中间：当前这一句 */}
        <View style={styles.lyricArea} pointerEvents="none">
          <Animated.View style={{ opacity: lineOpacity, transform: [{ translateY: lineLift }], width: '100%' }}>
            <Text
              style={{
                textAlign: setting.align,
                lineHeight: Math.round(setSpText(lyricSize) * 1.26),
                letterSpacing: 1.2,
                fontWeight: setting.bold ? '700' : '400',
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 16,
                paddingLeft: isCenter ? 0 : scaleSizeW(6),
              }}
              size={lyricSize}
              color={hasLyric ? setting.color : 'rgba(255,255,255,0.3)'}
              textBreakStrategy="simple"
            >{hasLyric ? display.text : emptyText}</Text>
            {
              setting.showTranslation && hasLyric && display.translation
                ? (
                    <Text
                      style={{
                        marginTop: scaleSizeH(16),
                        textAlign: setting.align,
                        lineHeight: Math.round(setSpText(transSize) * 1.35),
                        letterSpacing: 0.8,
                        opacity: 0.62,
                        textShadowColor: 'rgba(0,0,0,0.5)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 10,
                      }}
                      size={transSize}
                      color={setting.color}
                      textBreakStrategy="simple"
                    >{display.translation}</Text>
                  )
                : null
            }
          </Animated.View>
        </View>
      </Pressable>

      {/* ---------- 底部：时间 + 可拖动进度条 ---------- */}
      <ImmersiveProgress hintVisible={showHint && !showSetting} hintLabel={t('car_lyric_hint')} />

      {/* ---------- 设置面板 ---------- */}
      {
        showSetting
          ? (
              <>
                <Animated.View style={{ ...styles.panelScrim, opacity: panelAnim }} pointerEvents="none" />
                <Animated.View
                  style={{
                    ...styles.panel,
                    opacity: panelAnim,
                    transform: [{ translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
                  }}
                >
                  <View style={styles.panelInner} onStartShouldSetResponder={() => true}>
                    <View style={styles.panelHeader}>
                      <Text size={15} color="#fff">{t('car_lyric_immersive')}</Text>
                      <Pressable onPress={closePanel} style={styles.panelClose} hitSlop={8}>
                        <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
                      </Pressable>
                    </View>

                    {/* 字号 */}
                    <View style={styles.settingRow}>
                      <Text size={13} color="rgba(255,255,255,0.65)" style={styles.settingLabel}>{t('car_lyric_font_size')}</Text>
                      <View style={styles.sliderWrap}>
                        <Slider
                          value={lyricSize}
                          minimumValue={28}
                          maximumValue={140}
                          step={2}
                          onValueChange={(value) => { update({ fontSize: Math.round(value) }) }}
                        />
                      </View>
                      <Text size={13} color="rgba(255,255,255,0.75)" style={styles.settingValue}>{lyricSize}</Text>
                    </View>

                    {/* 字色 */}
                    <View style={styles.settingRow}>
                      <Text size={13} color="rgba(255,255,255,0.65)" style={styles.settingLabel}>{t('car_lyric_font_color')}</Text>
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
                    </View>

                    <Segment
                      label={t('car_lyric_align')}
                      value={setting.align}
                      options={[
                        { value: 'center', label: t('car_lyric_align_center') },
                        { value: 'left', label: t('car_lyric_align_left') },
                      ]}
                      onChange={value => { update({ align: value }) }}
                    />
                    <Segment
                      label={t('car_lyric_weight')}
                      value={setting.bold ? 'bold' : 'normal'}
                      options={[
                        { value: 'normal', label: t('car_lyric_weight_normal') },
                        { value: 'bold', label: t('car_lyric_weight_bold') },
                      ]}
                      onChange={value => { update({ bold: value == 'bold' }) }}
                    />
                    <Segment
                      label={t('car_lyric_show_translation')}
                      value={setting.showTranslation ? 'on' : 'off'}
                      options={[
                        { value: 'on', label: t('car_lyric_on') },
                        { value: 'off', label: t('car_lyric_off') },
                      ]}
                      onChange={value => { update({ showTranslation: value == 'on' }) }}
                    />
                    <Segment
                      label={t('car_lyric_bg')}
                      value={setting.background}
                      options={[
                        { value: 'cover', label: t('car_lyric_bg_cover') },
                        { value: 'dark', label: t('car_lyric_bg_dark') },
                      ]}
                      onChange={value => { update({ background: value }) }}
                    />

                    <Text size={11} color="rgba(255,255,255,0.35)" style={styles.panelTip}>{t('car_lyric_panel_tip')}</Text>
                  </View>
                </Animated.View>
              </>
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
  hintSlot: {
    flex: 1,
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
  panelScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scaleSizeW(28),
    paddingTop: scaleSizeH(12),
    paddingBottom: scaleSizeH(18),
    backgroundColor: 'rgba(18,18,21,0.97)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  // 超宽屏下把设置项收在中间，避免滑块被拉成一米长
  panelInner: {
    width: '100%',
    maxWidth: 780,
    alignSelf: 'center',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSizeH(4),
  },
  panelClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scaleSizeH(44),
  },
  settingLabel: {
    width: scaleSizeW(64),
  },
  settingValue: {
    width: scaleSizeW(38),
    textAlign: 'right',
  },
  sliderWrap: {
    flex: 1,
    paddingRight: scaleSizeW(10),
  },
  swatchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSizeW(10),
  },
  swatchRing: {
    width: scaleSizeW(38),
    height: scaleSizeW(38),
    borderRadius: scaleSizeW(19),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: scaleSizeW(26),
    height: scaleSizeW(26),
    borderRadius: scaleSizeW(13),
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    paddingLeft: scaleSizeW(16),
    paddingRight: scaleSizeW(16),
    paddingTop: scaleSizeH(7),
    paddingBottom: scaleSizeH(7),
    borderRadius: 16,
  },
  panelTip: {
    marginTop: scaleSizeH(6),
  },
})
