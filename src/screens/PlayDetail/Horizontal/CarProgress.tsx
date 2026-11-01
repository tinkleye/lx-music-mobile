import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useDrag } from '@/utils/hooks'
import { useProgress } from '@/store/player/hook'

// 【改造】车机模式专用进度条：
// 原来的进度条可视高度只有 3.6px、触摸区约 24px，车机上很难拖准，也看不出进度。
// 这里做成「8px 粗条 + 大圆点 + 46px 触摸区」，点按可跳转、按住可拖动。

const TOUCH_HEIGHT = 46
const BAR_HEIGHT = 8
const DOT_SIZE = 20

export default memo(() => {
  const theme = useTheme()
  const { progress, maxPlayTime } = useProgress()
  const [draging, setDraging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const [width, setWidth] = useState(0)
  const durationRef = useRef(maxPlayTime)

  useEffect(() => {
    durationRef.current = maxPlayTime
  }, [maxPlayTime])

  const onSetProgress = useCallback((p: number) => {
    global.app_event.setProgress(p * durationRef.current)
  }, [])

  const {
    onLayout,
    onDragStart,
    onDragEnd,
    onDrag,
  } = useDrag(onSetProgress, setDraging, setDragProgress)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (evt, gestureState) => {
        onDrag(gestureState.dx)
      },
      onPanResponderGrant: (evt, gestureState) => {
        onDragStart(gestureState.dx, evt.nativeEvent.locationX)
      },
      onPanResponderRelease: () => {
        onDragEnd()
      },
    }),
  ).current

  const currentProgress = draging ? dragProgress : progress
  const barWidth = Math.max(width * currentProgress, 0)

  return (
    <View
      style={{ height: TOUCH_HEIGHT, justifyContent: 'center' }}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width)
        onLayout(e)
      }}
    >
      <View style={{
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        backgroundColor: theme['c-primary-light-300-alpha-800'],
      }} />
      <View style={{
        position: 'absolute',
        left: 0,
        top: (TOUCH_HEIGHT - BAR_HEIGHT) / 2,
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        width: barWidth,
        backgroundColor: draging ? theme['c-primary-dark-100-alpha-300'] : theme['c-primary'],
      }} />
      <View style={{
        position: 'absolute',
        left: barWidth - DOT_SIZE / 2,
        top: (TOUCH_HEIGHT - DOT_SIZE) / 2,
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: theme['c-primary'],
        borderWidth: 2,
        borderColor: theme['c-content-background'],
      }} />
    </View>
  )
})
