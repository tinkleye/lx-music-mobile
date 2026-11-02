import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
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
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import {
  getCarLyricSetting,
  loadCarLyricSetting,
  saveCarLyricSetting,
  type CarLyricSetting,
} from '@/config/carLyric'
import { scaleSizeW, scaleSizeH } from '@/utils/pixelRatio'

/**
 * 【车机改造】沉浸式歌词
 *
 * 车机屏幕宽、离得远，播放页右栏那半屏歌词其实还有很多空间没用上。
 * 双击歌词区进入这个模式后：所有导航栏、封面、按钮全部隐去，
 * 整块屏幕只留「正在唱的这句」，字号可以拉到很大，停车时看着很舒服。
 *
 * 交互（和常见音乐 App 的沉浸歌词一致）：
 * - 双击空白处：返回原播放界面
 * - 长按空白处：弹出设置面板（字号 / 对齐 / 字重 / 翻译 / 背景），拖动即时生效
 * - 面板打开时点一下：先收起面板
 */

/** 屏幕底部那层黑色渐隐：用若干等分色块拼出来，避免为了一个渐变引入三方库 */
const GradientScrim = memo(({ rgb, from, to, slices = 14 }: { rgb: string, from: number, to: number, slices?: number }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {
      Array.from({ length: slices }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: `rgba(${rgb},${(from + (to - from) * (i / (slices - 1))).toFixed(3)})`,
          }}
        />
      ))
    }
  </View>
))

/** 底部进度条：单独拆出来，避免每 100ms 的进度更新把大号歌词一起重渲染 */
const LyricProgress = memo(() => {
  const { progress } = useProgress()
  const theme = useTheme()
  return (
    <View style={styles.progressTrack} pointerEvents="none">
      <View
        style={{
          height: '100%',
          width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
          backgroundColor: theme['c-primary'],
        }}
      />
    </View>
  )
})

const TimeRow = memo(() => {
  const { nowPlayTimeStr, maxPlayTimeStr } = useProgress()
  return (
    <View style={styles.timeRow} pointerEvents="none">
      <Text size={11} color="rgba(255,255,255,0.55)">{nowPlayTimeStr}</Text>
      <Text size={11} color="rgba(255,255,255,0.55)">{maxPlayTimeStr}</Text>
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
  const theme = useTheme()
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
      duration: 260,
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
  const transSize = Math.max(Math.round(lyricSize * 0.46), 13)
  const isCenter = setting.align == 'center'
  const hasLyric = !!display.text
  const emptyText = t('car_lyric_no_lyric')

  return (
    <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: enterOpacity, backgroundColor: '#08080a' }}>
      {/* ---------- 背景 ---------- */}
      {
        setting.background == 'cover' && musicInfo.pic
          ? (
              <Image
                source={{ uri: musicInfo.pic }}
                style={StyleSheet.absoluteFill as any}
                resizeMode="cover"
                blurRadius={Math.round(Math.min(width, height) / 22)}
              />
            )
          : null
      }
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: setting.background == 'cover' ? 'rgba(6,6,8,0.62)' : 'rgba(8,8,10,0.96)' }} pointerEvents="none" />
      {/* 上下压暗，让中间这句歌词更突出，也压住模糊封面的亮部 */}
      <GradientScrim rgb="0,0,0" from={0.45} to={0} slices={7} />
      <View style={{ ...StyleSheet.absoluteFillObject, transform: [{ rotate: '180deg' }] }} pointerEvents="none">
        <GradientScrim rgb="0,0,0" from={0.55} to={0} slices={9} />
      </View>

      {/* ---------- 主体（点按 / 长按都在这一层） ---------- */}
      <Pressable style={styles.touchArea} onPress={handlePress} onLongPress={openPanel} delayLongPress={420} android_disableSound>
        {/* 顶部：正在播放的歌，做得很轻，不抢歌词 */}
        <View style={styles.topBar} pointerEvents="none">
          <View style={styles.topDot} />
          <Text size={13} color="rgba(255,255,255,0.62)" numberOfLines={1}>
            {`${musicInfo.name}${musicInfo.singer ? `  ·  ${musicInfo.singer}` : ''}`}
          </Text>
        </View>

        {/* 中间：当前这一句 */}
        <View style={styles.lyricArea} pointerEvents="none">
          <Animated.View style={{ opacity: lineOpacity, transform: [{ translateY: lineLift }], width: '100%' }}>
            <Text
              style={{
                textAlign: setting.align,
                lineHeight: Math.round(lyricSize * 1.42),
                letterSpacing: 1,
                fontWeight: setting.bold ? '700' : '400',
                textShadowColor: 'rgba(0,0,0,0.55)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 12,
                paddingLeft: isCenter ? 0 : scaleSizeW(6),
              }}
              size={lyricSize}
              color={hasLyric ? '#fff' : 'rgba(255,255,255,0.35)'}
              textBreakStrategy="simple"
            >{hasLyric ? display.text : emptyText}</Text>
            {
              setting.showTranslation && hasLyric && display.translation
                ? (
                    <Text
                      style={{
                        marginTop: scaleSizeH(14),
                        textAlign: setting.align,
                        lineHeight: Math.round(transSize * 1.4),
                        letterSpacing: 0.6,
                        textShadowColor: 'rgba(0,0,0,0.5)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 8,
                      }}
                      size={transSize}
                      color="rgba(255,255,255,0.66)"
                      textBreakStrategy="simple"
                    >{display.translation}</Text>
                  )
                : null
            }
          </Animated.View>
        </View>

        {/* 底部：时间 + 操作提示 */}
        <View style={styles.bottomBar} pointerEvents="none">
          <TimeRow />
          <Animated.View style={{ opacity: showHint ? 1 : 0 }}>
            <Text size={11} color="rgba(255,255,255,0.42)">{t('car_lyric_hint')}</Text>
          </Animated.View>
        </View>
      </Pressable>

      {/* ---------- 底部进度条 ---------- */}
      <LyricProgress />

      {/* ---------- 设置面板 ---------- */}
      {
        showSetting
          ? (
              <Animated.View
                style={{
                  ...styles.panel,
                  opacity: panelAnim,
                  transform: [{ translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
                }}
              >
                <View onStartShouldSetResponder={() => true}>
                  <View style={styles.panelHeader}>
                    <Text size={15} color="#fff">{t('car_lyric_immersive')}</Text>
                    <Pressable onPress={closePanel} style={styles.panelClose} hitSlop={8}>
                      <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                  </View>

                  {/* 字号 */}
                  <View style={styles.settingRow}>
                    <Text size={13} color="rgba(255,255,255,0.65)" style={styles.settingLabel}>{t('car_lyric_font_size')}</Text>
                    <Slider
                      value={lyricSize}
                      minimumValue={20}
                      maximumValue={80}
                      step={2}
                      onValueChange={(value) => { update({ fontSize: Math.round(value) }) }}
                    />
                    <Text size={13} color="rgba(255,255,255,0.75)" style={styles.settingValue}>{lyricSize}</Text>
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
    paddingBottom: scaleSizeH(26),
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
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  lyricArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: scaleSizeW(56),
  },
  bottomBar: {
    alignItems: 'center',
    gap: scaleSizeH(6),
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    opacity: 0.8,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scaleSizeW(28),
    paddingTop: scaleSizeH(14),
    paddingBottom: scaleSizeH(22),
    backgroundColor: 'rgba(18,18,21,0.97)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSizeH(6),
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
    width: scaleSizeW(34),
    textAlign: 'right',
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
    marginTop: scaleSizeH(8),
  },
})
