import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, TouchableOpacity, type LayoutChangeEvent } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { getRoamState, subscribeRoam, startRoam, endRoam } from '@/core/roam'
import { toast } from '@/utils/tools'

const PADDING_H = 6

/**
 * 【v55】歌曲漫游入口（横竖屏播放页 Header 共用）：
 * - 未漫游 → 显示「歌曲漫游」按钮，点击开始漫游；
 * - 漫游中 → 替换显示「漫游 · 来源」，点击结束漫游、回到按钮。
 * 【v58】漫游来源文字过长时，跑马灯左右滚动显示完整内容（超长才滚）。
 */
export default memo(({ size = 10 }: { size?: number }) => {
  const t = useI18n()
  const theme = useTheme()
  const [roam, setRoam] = useState(getRoamState())
  const [textWidth, setTextWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const translateX = useRef(new Animated.Value(0)).current

  useEffect(() => subscribeRoam(() => { setRoam({ ...getRoamState() }) }), [])

  const text = roam.active
    ? t('roam_source_badge', { source: roam.sourceDesc })
    : t('roam_list_name')

  // 【v58】文字超宽时跑马灯：先停 1.2s → 左滚到露出末尾 → 停 1.2s → 回滚到起点
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
    if (roam.active) {
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
        backgroundColor: roam.active ? theme['c-primary-light-100-alpha-700'] : theme['c-button-background'],
      }}
      onLayout={handleContainerLayout}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      {/* 【v59】alignSelf flex-start 让内层宽度随内容、不随容器拉伸；
          否则 Text 被容器宽度约束后 numberOfLines=1 直接截断成省略号，
          onTextLayout 拿到的已是截断宽度，distance 恒为 0 不滚动 */}
      <Animated.View style={{ transform: [{ translateX }], alignSelf: 'flex-start' }}>
        <Text
          size={size}
          color={roam.active ? theme['c-primary-font'] : theme['c-button-font']}
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
  // 【v59】flexShrink 0 让文字按完整内容宽度渲染，不被压缩成省略号
  text: {
    flexShrink: 0,
  },
})
