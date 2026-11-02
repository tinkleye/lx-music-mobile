import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { FlatList, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

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
  onPageChange?: (page: number, pageCount: number) => void
  /** 底部左侧的状态提示，如「加载中…」「已到底」 */
  tipLabel?: string | null
  /** 数据为空时显示的内容 */
  emptyComponent?: ReactNode
  /** 是否显示右下角页码 */
  showPageIndicator?: boolean
  /** 页面内边距 */
  paddingHorizontal?: number
}

function CarPagedListInner<T>({
  data,
  itemHeight,
  numColumns = 1,
  renderItem,
  onEndReached,
  onPageChange,
  tipLabel,
  emptyComponent,
  showPageIndicator = true,
  paddingHorizontal = 0,
}: CarPagedListProps<T>, ref: React.ForwardedRef<CarPagedListType>) {
  const theme = useTheme()
  const listRef = useRef<FlatList<(T | null)[]>>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  const lastPageSizeRef = useRef(0)
  // 有些页面（如「我的列表」）会在列表还没完成布局时就要跳转到当前播放的歌，
  // 那时算不出一页多少条，先把目标下标存下来，布局完成后补跳
  const pendingIndexRef = useRef<number | null>(null)
  // onEndReached 在翻页时会连续触发多次，这里做个简单的去抖
  const endReachedLockRef = useRef(false)

  const cols = Math.max(1, Math.trunc(numColumns))
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
    if (!innerWidth) return
    pageRef.current = target
    setPage(target)
    try {
      listRef.current?.scrollToOffset({ offset: target * innerWidth, animated })
    } catch {}
  }, [innerWidth, pageCount])

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
    if (!isReady || !pageSize || !innerWidth) return
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
  }, [isReady, pageSize, innerWidth, pageCount])

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

  const handleMomentumEnd = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!innerWidth) return
    const next = Math.round(nativeEvent.contentOffset.x / innerWidth)
    if (next != pageRef.current) {
      pageRef.current = next
      setPage(next)
      onPageChange?.(next, pageCount)
    }
    // 翻到最后一页 → 该加载下一页数据了
    if (next >= pageCount - 1 && !endReachedLockRef.current) {
      endReachedLockRef.current = true
      onEndReached?.()
      setTimeout(() => { endReachedLockRef.current = false }, 600)
    }
  }

  const renderPage = ({ item: pageData, index: pageIndex }: { item: (T | null)[], index: number }) => (
    <View style={{ width: innerWidth, height: size.height, paddingHorizontal }}>
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
    </View>
  )

  const showEmpty = !data.length && !!emptyComponent

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {
        size.width > 0 && pageCount
          ? (
              <FlatList
                ref={listRef}
                style={{ width: size.width, height: size.height }}
                data={pages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                keyExtractor={(item, index) => `page_${index}`}
                renderItem={renderPage}
                getItemLayout={(_, index) => ({ length: innerWidth, offset: innerWidth * index, index })}
                onMomentumScrollEnd={handleMomentumEnd}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
              />
            )
          : null
      }
      {
        showEmpty
          ? <View style={styles.empty}>{emptyComponent}</View>
          : null
      }
      {/* 页码提示：车机上翻页没有滚动条，用右下角一个小页码告诉用户「还有多少页」 */}
      {
        showPageIndicator && pageCount > 1
          ? (
              <View style={styles.indicator} pointerEvents="none">
                <Text size={11} color={theme['c-350']}>{`${Math.min(page + 1, pageCount)} / ${pageCount}`}</Text>
              </View>
            )
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
  indicator: {
    position: 'absolute',
    right: 12,
    bottom: 6,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.18)',
  },
  tip: {
    position: 'absolute',
    left: 14,
    bottom: 6,
  },
})

export default CarPagedList
