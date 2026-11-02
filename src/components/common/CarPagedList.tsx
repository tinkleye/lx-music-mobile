import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  FlatList,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'

/**
 * 【车机改造】分页列表容器
 *
 * 车机上竖着滚动列表不好用（行驶中滑动容易误触、也看不清下一行），
 * 所以把「一屏 = 一页」的列表改成左右翻页：一次能完整看到一页内容，
 * 左滑/右滑翻页，不用长距离滚动。
 *
 * 这个组件只负责「排版 + 翻页」，具体的每一行长什么样还是由调用方给
 * `renderItem`，所以排行榜、我的列表、歌单三种列表共用它。
 *
 * 用法要点：
 * - 需要在有确定宽高的父容器里使用（它自己铺满父容器）
 * - itemHeight 是一行的高度，用来算一页能放几行
 * - numColumns 是一行放几列（车机宽屏一般 2 列）
 *
 * 翻页手感：
 * - 页面内容跟随滑动做「交叉淡入淡出 + 轻微视差」，滑到一半时新旧两页
 *   一起可见，不会像原来那样「啪」地一声整块换掉
 * - 动画值直接交给原生驱动，滑动过程中不占用 JS 线程
 * - **轻扫一下就翻页**：车机屏幕宽近 2 米（1920px），系统自带的 pagingEnabled
 *   要拖过半屏才认账，手指得刻意拉很长。这里改成自己判定松手意图：
 *   位移过 8% 屏宽、或者甩得够快，就直接落到下一页
 */

export interface CarPagedListType {
  /** 滚到第 n 个数据（不是第 n 页）所在的那一页 */
  scrollToIndex: (index: number, animated?: boolean) => void
  /** 滚到第 n 页（从 0 开始） */
  scrollToPage: (page: number, animated?: boolean) => void
  /** 一页能放多少条数据 */
  getPageSize: () => number
  /** 一共多少页 */
  getPageCount: () => number
}

export interface CarPagedListProps<T> {
  data: T[]
  /** 单行高度 */
  itemHeight: number
  /** 每行几列 */
  numColumns?: number
  renderItem: (item: T, index: number) => ReactNode
  keyExtractor?: (item: T, index: number) => string
  /** 翻到最后一页时触发（用于加载更多） */
  onEndReached?: () => void
  /** 底部左侧的状态提示，如「加载中…」 */
  tipLabel?: string | null
  /** 数据为空时显示的内容 */
  emptyComponent?: ReactNode
  /** 页面内边距（左右同宽） */
  paddingHorizontal?: number
}

/** FlatList 套上 Animated，才能把滚动位置直接交给原生动画驱动 */
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as any

/** 单页容器：根据自己离屏幕中心的距离做淡入淡出 + 视差 */
const Page = memo(({ index, width, height, paddingHorizontal, scrollX, children }: {
  index: number
  width: number
  height: number
  paddingHorizontal: number
  scrollX: Animated.Value
  children: ReactNode
}) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width]
  // 滑走的那一页淡到一半，滑进来的那一页从一半淡上来；位移只有 6% 屏宽，
  // 够看出「翻过去」的方向感，又不会晕。淡得太多会像闪一下，所以只淡到 0.5
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' })
  const translateX = scrollX.interpolate({ inputRange, outputRange: [width * 0.06, 0, -width * 0.06], extrapolate: 'clamp' })
  return (
    <Animated.View
      style={{
        width,
        height,
        paddingHorizontal,
        opacity,
        transform: [{ translateX }],
      }}
    >
      {children}
    </Animated.View>
  )
})

function CarPagedListInner<T>({
  data,
  itemHeight,
  numColumns = 1,
  renderItem,
  onEndReached,
  tipLabel,
  emptyComponent,
  paddingHorizontal = 0,
}: CarPagedListProps<T>, ref: React.ForwardedRef<CarPagedListType>) {
  const theme = useTheme()
  const listRef = useRef<FlatList<(T | null)[]>>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const pageRef = useRef(0)
  const lastPageSizeRef = useRef(0)
  // 有些页面（如「我的列表」）会在列表还没完成布局时就要跳转到当前播放的歌，
  // 那时算不出一页多少条，先把目标下标存下来，布局完成后补跳
  const pendingIndexRef = useRef<number | null>(null)
  // onEndReached 在翻页时会连续触发多次，这里做个简单的去抖
  const endReachedLockRef = useRef(false)
  // 横向滚动位置：页面淡入淡出、视差都跟着它走
  const scrollX = useRef(new Animated.Value(0)).current

  const cols = Math.max(1, Math.trunc(numColumns))
  // 一页的宽度 = 列表宽度。注意 RN 的 width 是包含 padding 的（border-box），
  // 所以页面容器必须撑满整个列表宽，内边距再往里收，格子宽度才和可见区域一致。
  // 之前把页面宽写成「列表宽 - 左右内边距」，结果 pagingEnabled 按列表宽对齐、
  // 内容却按内层宽排列，从第二页开始越差越多：左边被切掉、右边空一大块。
  const pageWidth = size.width
  const innerWidth = Math.max(size.width - paddingHorizontal * 2, 0)
  // 布局完成前算出来的行数/列数都是假值，这时候的跳转请求先挂起
  const isReady = size.width > 0 && size.height > 0
  // 一页能放几行：向下取整，保证每一行都能完整显示，不会出现「半行」
  const rows = isReady && itemHeight > 0 ? Math.max(1, Math.floor(size.height / itemHeight)) : 1
  const pageSize = rows * cols

  // 把数据切成「一页一阵列」，不足一页的用 null 补齐，保证每页大小一致
  const pages = useMemo(() => {
    if (!pageSize) return [] as (T | null)[][]
    const result: (T | null)[][] = []
    for (let i = 0; i < data.length; i += pageSize) {
      const pageData: (T | null)[] = new Array(pageSize).fill(null)
      for (let j = 0; j < pageSize && i + j < data.length; j++) pageData[j] = data[i + j]
      result.push(pageData)
    }
    return result
  }, [data, pageSize])

  const pageCount = pages.length

  const syncPage = useCallback((next: number, animated = true) => {
    const target = Math.max(0, Math.min(next, pageCount - 1))
    if (!pageWidth) return
    pageRef.current = target
    try {
      listRef.current?.scrollToOffset({ offset: target * pageWidth, animated })
    } catch {}
  }, [pageWidth, pageCount])

  useImperativeHandle(ref, () => ({
    scrollToIndex(index, animated = true) {
      if (!isReady) {
        pendingIndexRef.current = index
        return
      }
      syncPage(Math.floor(index / pageSize), animated)
    },
    scrollToPage(target, animated = true) {
      if (!isReady) return
      syncPage(target, animated)
    },
    getPageSize() {
      return pageSize
    },
    getPageCount() {
      return pageCount
    },
  }), [isReady, pageSize, pageCount, syncPage])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    if (Math.abs(width - size.width) < 1 && Math.abs(height - size.height) < 1) return
    setSize({ width, height })
  }

  // 一页能放多少条变了（旋转屏幕、改字号等）时，页码会错位，重新定位到当前页
  useEffect(() => {
    if (!isReady || !pageSize || !pageWidth) return
    // 有挂起的跳转请求（布局前就要跳到某首歌）优先处理
    if (pendingIndexRef.current != null) {
      const target = pendingIndexRef.current
      pendingIndexRef.current = null
      lastPageSizeRef.current = pageSize
      syncPage(Math.floor(target / pageSize), false)
      return
    }
    if (lastPageSizeRef.current == pageSize) return
    lastPageSizeRef.current = pageSize
    syncPage(Math.min(pageRef.current, Math.max(pageCount - 1, 0)), false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pageSize, pageWidth, pageCount])

  // 数据变少（切换列表）时把页码拉回来
  useEffect(() => {
    if (pageRef.current > pageCount - 1) syncPage(Math.max(pageCount - 1, 0), false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount])

  // 如果第一页就是最后一页（数据还没装满一页），用户没有「翻到最后一页」这个动作，
  // 这里主动要下一页数据，否则列表会一直停在第一批
  useEffect(() => {
    if (!onEndReached || !pageSize || !pageCount) return
    if (pageRef.current < pageCount - 1) return
    if (endReachedLockRef.current) return
    endReachedLockRef.current = true
    onEndReached()
    setTimeout(() => { endReachedLockRef.current = false }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount, pageSize])

  const dragRef = useRef({ x: 0, t: 0 })

  const triggerEndReached = useCallback(() => {
    if (!onEndReached || endReachedLockRef.current) return
    endReachedLockRef.current = true
    onEndReached()
    setTimeout(() => { endReachedLockRef.current = false }, 600)
  }, [onEndReached])

  const handleScrollBeginDrag = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragRef.current = { x: nativeEvent.contentOffset.x, t: Date.now() }
  }

  // 松手时自己判断「是不是想翻页」，不再等系统拖过半屏才认账
  const handleScrollEndDrag = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return
    const base = pageRef.current
    const offset = nativeEvent.contentOffset.x
    // 相对当前页的位移：过了 8% 屏宽就算翻页（原来要过半屏）
    const dx = offset - base * pageWidth
    const dt = Math.max(Date.now() - dragRef.current.t, 16)
    // 手指的平均速度（px/ms）：车机上轻轻一甩也能到 1 以上
    const speed = Math.abs(offset - dragRef.current.x) / dt
    const vx = (nativeEvent as any).velocity?.x ?? 0
    let dir = 0
    // 一：甩得够快就直接翻（iOS 有 velocity，Android 靠自己算的 speed）
    if (Math.abs(vx) > 0.05) dir = vx > 0 ? 1 : -1
    else if (speed > 0.35) dir = dx > 0 ? 1 : -1
    // 二：慢慢拖的，过了 8% 就翻
    else if (Math.abs(dx) > pageWidth * 0.08) dir = dx > 0 ? 1 : -1
    const target = Math.max(0, Math.min(base + dir, pageCount - 1))
    pageRef.current = target
    // 无论翻不翻，都主动落位：这一步会打断系统的惯性滑动，
    // 所以不会出现「已经落到下一页又被惯性带回半页」的情况
    try {
      listRef.current?.scrollToOffset({ offset: target * pageWidth, animated: true })
    } catch {}
    if (target >= pageCount - 1) triggerEndReached()
  }

  const handleMomentumEnd = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return
    const raw = nativeEvent.contentOffset.x / pageWidth
    const nearest = Math.round(raw)
    // 万一被惯性带偏没落在整页上，这里补一下
    if (Math.abs(raw - nearest) * pageWidth > 2) {
      pageRef.current = nearest
      syncPage(nearest)
      return
    }
    pageRef.current = nearest
    // 翻到最后一页 → 该加载下一页数据了
    if (nearest >= pageCount - 1) triggerEndReached()
  }

  const renderPage = ({ item: pageData, index: pageIndex }: { item: (T | null)[], index: number }) => (
    <Page
      index={pageIndex}
      // 页面容器 = 列表宽度（含内边距），这样系统按「一屏」对齐时不会错位
      width={pageWidth}
      height={size.height}
      paddingHorizontal={paddingHorizontal}
      scrollX={scrollX}
    >
      {
        Array.from({ length: rows }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row', height: itemHeight }}>
            {
              Array.from({ length: cols }, (_, col) => {
                const cellIndex = row * cols + col
                const item = pageData[cellIndex]
                return (
                  <View key={col} style={{ width: innerWidth / cols, height: itemHeight }}>
                    { item ? renderItem(item, pageIndex * pageSize + cellIndex) : null }
                  </View>
                )
              })
            }
          </View>
        ))
      }
    </Page>
  )

  const showEmpty = !data.length && !!emptyComponent

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {
        size.width > 0 && pageCount
          ? (
              <AnimatedFlatList
                ref={listRef}
                style={{ width: size.width, height: size.height }}
                data={pages}
                horizontal
                // 不用 pagingEnabled：它要拖过半屏才认账，宽屏车机上太费劲。
                // 改成松手时自己判定（见 handleScrollEndDrag），snapToInterval 只做兜底
                snapToInterval={pageWidth}
                disableIntervalMomentum
                // 翻页时不要回弹：一页就是终点，松手直接落位
                bounces={false}
                overScrollMode="never"
                // 让「甩一下」只翻一页，手感更可控
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: true },
                )}
                keyExtractor={(item, index) => `page_${index}`}
                renderItem={renderPage}
                getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={handleScrollEndDrag}
                onMomentumScrollEnd={handleMomentumEnd}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
              />
            )
          : null
      }
      {
        showEmpty
          ? <View style={styles.empty}>{emptyComponent}</View>
          : null
      }
      {
        tipLabel
          ? (
              <View style={styles.tip} pointerEvents="none">
                <Text size={11} color={theme['c-350']}>{tipLabel}</Text>
              </View>
            )
          : null
      }
    </View>
  )
}

const CarPagedList = forwardRef(CarPagedListInner) as <T>(
  props: CarPagedListProps<T> & { ref?: React.Ref<CarPagedListType> }
) => React.ReactElement

const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tip: {
    position: 'absolute',
    left: 14,
    bottom: 6,
  },
})

export default CarPagedList
