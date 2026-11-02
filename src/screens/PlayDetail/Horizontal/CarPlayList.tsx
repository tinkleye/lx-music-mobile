import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, FlatList, PanResponder, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { usePlayInfo } from '@/store/player/hook'
import { getListMusicSync } from '@/utils/listManage'
import { playListById } from '@/core/player/player'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { scaleSizeH } from '@/utils/pixelRatio'
import { useI18n } from '@/lang'

/**
 * 【改造】车机模式播放页的「当前播放列表」面板。
 *
 * 显示 playerListId 对应的实际播放队列（随机播放时也是按当前队列顺序）。
 * 交互规则：
 *   - 任何触摸 / 滚动都会重置 10 秒计时
 *   - 10 秒无操作自动关闭，回到原来的播放界面
 *   - 也可以点右上角按钮手动返回
 */

const AUTO_BACK_MS = 10000
const ITEM_HEIGHT = scaleSizeH(48)

export default memo(({ onClose }: { onClose: () => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const playInfo = usePlayInfo()
  const [, forceUpdate] = useState(0)

  // onClose 每次父组件 render 都是新函数，用 ref 保存最新引用，
  // 避免重建计时器（否则任何父级重渲染都会把 10 秒重新计时）
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bumpTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onCloseRef.current()
    }, AUTO_BACK_MS)
  }, [])

  useEffect(() => {
    bumpTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [bumpTimer])

  // 列表内容变化时刷新（增删歌曲等）
  useEffect(() => {
    const handleUpdate = (ids: string[]) => {
      if (playInfo.playerListId && ids.includes(playInfo.playerListId)) forceUpdate(v => v + 1)
    }
    global.app_event.on('myListMusicUpdate', handleUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleUpdate)
    }
  }, [playInfo.playerListId])

  // 【改造】向左滑动关闭面板：跟手位移 + 松手判定，滑动方向以水平为主时才接管手势，
  // 保证上下滚动列表不受影响。
  const translateX = useRef(new Animated.Value(0)).current
  const panResponder = useRef(PanResponder.create({
    // 必须用 Capture 阶段判断，否则列表的滚动会先把触摸吃掉
    onMoveShouldSetPanResponderCapture: (_, g) =>
      g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(g.dx)
    },
    onPanResponderRelease: (_, g) => {
      bumpTimer()
      if (g.dx < -70 || g.vx < -0.6) {
        // 滑够了就顺势收起：先滑出屏幕再真正关闭，避免"啪"地消失
        Animated.timing(translateX, {
          toValue: -999,
          duration: 160,
          useNativeDriver: false,
        }).start(() => {
          // 先卸载面板再复位，避免关闭瞬间看到面板弹回原位
          onCloseRef.current()
          translateX.setValue(0)
        })
      } else {
        Animated.spring(translateX, { toValue: 0, bounciness: 0, useNativeDriver: false }).start()
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, bounciness: 0, useNativeDriver: false }).start()
    },
  })).current

  const listId = playInfo.playerListId
  const musics = listId ? getListMusicSync(listId) : []
  const currentIndex = playInfo.playerPlayIndex

  const handlePlay = (id: string) => {
    bumpTimer()
    if (!listId) return
    void playListById(listId, id)
  }

  const renderItem = ({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
    const isCurrent = index == currentIndex
    return (
      <TouchableOpacity
        style={{ ...styles.item, height: ITEM_HEIGHT }}
        activeOpacity={0.6}
        onPress={() => { handlePlay(item.id) }}
      >
        <View style={styles.itemIndex}>
          {
            isCurrent
              ? <Icon name="play-outline" color={theme['c-primary-font']} size={15} />
              : <Text size={12} color={theme['c-500']}>{index + 1}</Text>
          }
        </View>
        <View style={styles.itemInfo}>
          <Text
            numberOfLines={1}
            size={15}
            color={isCurrent ? theme['c-primary-font'] : theme['c-font']}
          >{item.name}</Text>
          <Text numberOfLines={1} size={11} color={theme['c-font-label']}>{item.singer}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      // 触摸任意位置都重置自动返回计时（返回 false 不拦截子组件手势）
      onStartShouldSetResponder={() => { bumpTimer(); return false }}
      style={{
        ...styles.container,
        borderRightColor: theme['c-border-background'],
        transform: [{ translateX }],
      }}
    >
      <View style={{ ...styles.header, borderBottomColor: theme['c-border-background'] }}>
        <Icon name="menu" color={theme['c-primary-font']} size={18} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} size={16}>{t('car_play_list_title')}</Text>
          <Text numberOfLines={1} size={11} color={theme['c-font-label']}>
            {musics.length} · {t('car_play_list_auto_back')}
          </Text>
        </View>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.5} onPress={() => { onCloseRef.current() }}>
          <Icon name="back-2" color={theme['c-font']} size={18} />
        </TouchableOpacity>
      </View>
      {
        musics.length
          ? (
              <FlatList
                data={musics}
                keyExtractor={m => m.id}
                renderItem={renderItem}
                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                initialScrollIndex={currentIndex > 0 && currentIndex < musics.length ? currentIndex : 0}
                onScrollBeginDrag={bumpTimer}
                onMomentumScrollEnd={bumpTimer}
                showsVerticalScrollIndicator={false}
                style={styles.list}
              />
            )
          : (
              <View style={styles.empty}>
                <Text size={13} color={theme['c-font-label']}>{t('car_play_list_empty')}</Text>
              </View>
            )
      }
    </Animated.View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    borderRightWidth: BorderWidths.normal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 8,
    borderBottomWidth: BorderWidths.normal,
    gap: 8,
  },
  headerText: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  itemIndex: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
