import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, TouchableOpacity, type LayoutChangeEvent } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { usePlayInfo } from '@/store/player/hook'
import { getRoamState, subscribeRoam, startRoam, endRoam, isRoamList } from '@/core/roam'
import { toast } from '@/utils/tools'

const PADDING_H = 6
// 【v62】滚动层显式宽度：足够容纳任意漫游来源文字，让 Text 完整渲染不被截断，
// onTextLayout 才能量到真实文字宽（absolute 方案在 Yoga 测量时仍受父容器宽约束，无效）
const MARQUEE_WIDTH = 2000

/**
 * 【v55】歌曲漫游入口（横竖屏播放页 Header 共用）：
 * - 未漫游 → 显示「歌曲漫游」按钮，点击开始漫游；
 * - 漫游中 → 替换显示「漫游 · 来源」，点击结束漫游、回到按钮。
 * 【v62】漫游判定改为「漫游标记 且 当前播放列表是漫游队列」——
 *   之前只凭持久化的 roam.active，切到普通歌单播放时 active 残留 true，
 *   导致「指定列表播放」也误显示成漫游中。
 */
export default memo(({ size = 10 }: { size?: number }) => {
  const t = useI18n()
  const theme = useTheme()
  const [roam, setRoam] = useState(getRoamState())
  const [textWidth, setTextWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const translateX = useRef(new Animated.Value(0)).current
  const playInfo = usePlayInfo()

  useEffect(() => subscribeRoam(() => { setRoam({ ...getRoamState() }) }), [])

  const isRoaming = roam.active && isRoamList(playInfo.playerListId)

  const text = isRoaming
    ? t('roam_source_badge', { source: roam.sourceDesc })
    : t('roam_list_name')

  // 文字超宽时跑马灯：先停 1.2s → 左滚到露出末尾 → 停 1.2s → 回滚到起点
  useEffect(() => {
    const usable = containerWidth - PADDING_H * 2
    const distance = textWidth - usable
    if (distance > 4 && usable > 0) {
      translateX.setValue(0)
      const anim = Animated.loop(
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(translateX, {
            toValue: -distance,
            duration: Math.max(1500, distance * 40),
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(1200),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 400,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      )
      anim.start()
      return () => { anim.stop() }
    }
    translateX.setValue(0)
    return undefined
  }, [textWidth, containerWidth, text, translateX])

  const handlePress = () => {
    if (isRoaming) {
      void endRoam()
      toast(t('roam_ended_tip'))
    } else {
      void startRoam()
    }
  }

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width)
  }

  return (
    <TouchableOpacity
      style={{
        ...styles.badge,
        backgroundColor: isRoaming ? theme['c-primary-light-100-alpha-700'] : theme['c-button-background'],
      }}
      onLayout={handleContainerLayout}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      {/* 【v62】滚动层显式大宽度，Text 完整渲染量真实宽，badge overflow hidden 作窗口 */}
      <Animated.View style={{ width: MARQUEE_WIDTH, transform: [{ translateX }] }}>
        <Text
          size={size}
          color={isRoaming ? theme['c-primary-font'] : theme['c-button-font']}
          numberOfLines={1}
          style={styles.text}
          onTextLayout={e => { setTextWidth(e.nativeEvent.lines[0]?.width ?? 0) }}
        >{text}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
})

const styles = createStyle({
  badge: {
    borderRadius: 8,
    paddingHorizontal: PADDING_H,
    paddingVertical: 2,
    maxWidth: 200,
    flexShrink: 1,
    overflow: 'hidden',
  },
  // 完整渲染、不压缩
  text: {
    flexShrink: 0,
  },
})
