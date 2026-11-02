import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { FlatList, View, RefreshControl, TouchableOpacity, type FlatListProps } from 'react-native'

import ListItem from './ListItem'
// import { navigations } from '@/navigation'
import { type ListInfoItem } from '@/store/songlist/state'
import { useLayout } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { scaleSizeW, scaleSizeH, setSpText } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import CarPagedList, { type CarPagedListType } from '@/components/common/CarPagedList'
import { isCarModeEnabled } from '@/config/carMode'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

type FlatListType = FlatListProps<ListInfoItem>

// const MAX_WIDTH = scaleSizeW(110)
const MIN_WIDTH = scaleSizeW(110)
const GAP = scaleSizeW(20)

// 【改造】车机模式：歌单封面改成「一屏两行、左右翻页」
const carMode = isCarModeEnabled()
/** 车机模式下一屏显示几行封面 */
const CAR_ROWS = 2

export interface ListProps {
  onRefresh: () => void
  onLoadMore: () => void
  onOpenDetail: (item: ListInfoItem, index: number) => void
}
export type Status = 'loading' | 'refreshing' | 'end' | 'error' | 'idle'

export interface ListType {
  setList: (list: ListInfoItem[], showSource?: boolean) => void
  setStatus: (val: Status) => void
}

export default forwardRef<ListType, ListProps>(({ onRefresh, onLoadMore, onOpenDetail }, ref) => {
  const flatListRef = useRef<FlatList>(null)
  const pagedRef = useRef<CarPagedListType>(null)
  const [currentList, setList] = useState<ListInfoItem[]>([])
  const [showSource, setShowSource] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const { onLayout, width, height } = useLayout()
  const theme = useTheme()
  const t = useI18n()
  // console.log('render songlist')

  useImperativeHandle(ref, () => ({
    setList(list, showSource = false) {
      // rawListRef.current = list
      setList(list)
      setShowSource(showSource)
    },
    setStatus(val) {
      setStatus(val)
    },
  }))

  const handleLoadMore = () => {
    if (status != 'idle') return
    onLoadMore()
  }

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      width={rowInfo.width}
      showSource={showSource}
      onPress={onOpenDetail}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  // const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
  //   return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  // }
  const refreshControl = useMemo(() => (
    <RefreshControl
      colors={[theme['c-primary']]}
      // progressBackgroundColor={theme.primary}
      refreshing={status == 'refreshing'}
      onRefresh={onRefresh} />
  ), [status, onRefresh, theme])
  const footerComponent = useMemo(() => {
    let label: FooterLabel
    switch (status) {
      case 'refreshing': return null
      case 'loading':
        label = 'list_loading'
        break
      case 'end':
        label = 'list_end'
        break
      case 'error':
        label = 'list_error'
        break
      case 'idle':
        label = null
        break
    }
    return (
      <View style={{ width: '100%' }}>
        <Footer label={label} onLoadMore={onLoadMore} />
      </View>
    )
  }, [onLoadMore, status])


  // const itemWidth = useMemo(() => {
  //   let itemWidth = Math.max(Math.trunc(width * 0.125), MAX_WIDTH)
  //   // if (itemWidth < )
  // }, [width])
  // const computedItemWidth = useMemo(() => {
  //   let w = width - GAP
  //   let n = width / (MIN_WIDTH + GAP)
  //   if (n > 10) n = 10
  //   return Math.floor(w / n)
  // }, [width])
  // console.log(Math.trunc(width * 0.125), itemWidth)
  // console.log(itemWidth, MIN_WIDTH, GAP, width)
  const rowInfo = useMemo(() => {
    let w = width - GAP
    let n = width / (MIN_WIDTH + GAP)
    if (n > 10) n = 10
    let computedItemWidth = Math.floor(w / n)
    const num = Math.max(Math.floor(width / computedItemWidth), 2)
    return {
      num,
      width: (width - GAP) / num,
    }
  }, [width])

  /**
   * 【车机改造】一屏两行的排版计算。
   *
   * 原来是「竖向滚动 + 按屏宽算列数」，行高由内容决定，
   * 结果第二行封面经常被屏幕底边切掉（用户反馈「两行显示不全」）。
   * 现在反过来算：先按「一屏正好两行」定死行高，由行高反推封面尺寸，
   * 再由屏宽决定放几列。这样两行封面 + 两行标题都保证落在屏幕内。
   */
  const carLayout = useMemo(() => {
    if (!carMode || !width || !height) return null
    const gap = scaleSizeW(12)
    const cellHeight = height / CAR_ROWS
    const lineHeight = Math.round(setSpText(12) * 1.35)
    const titleHeight = lineHeight * 2 + scaleSizeH(6)
    // 纵向留给封面的最大高度（扣掉两行标题和间距）
    const coverMax = Math.max(cellHeight - titleHeight - gap, scaleSizeW(40))
    // 横向能放几列，封面尽量接近正方形
    let cols = Math.floor(width / (coverMax + gap))
    cols = Math.max(2, Math.min(cols, 8))
    const cellWidth = width / cols
    const cover = Math.min(cellWidth - gap, coverMax)
    return { gap, cellHeight, lineHeight, titleHeight, cols, cellWidth, cover }
  }, [width, height])

  const carTip = useMemo(() => {
    switch (status) {
      case 'loading': return t('list_loading')
      case 'end': return t('list_end')
      case 'error': return t('list_error')
      default: return null
    }
  }, [status, t])

  // 非车机模式的竖向列表数据（末尾补空位，让最后一行的封面按列对齐）
  const list = useMemo(() => {
    const list = [...currentList]
    let whiteItemNum = (list.length % rowInfo.num)
    if (whiteItemNum > 0) whiteItemNum = rowInfo.num - whiteItemNum
    for (let i = 0; i < whiteItemNum; i++) {
      list.push({
        id: `white__${i}`,
        play_count: '',
        author: '',
        name: '',
        img: '',
        desc: '',
        // @ts-expect-error
        source: '',
      })
    }
    return list
  }, [currentList, rowInfo])

  // 【车机改造】两行封面 + 左右翻页
  if (carMode) {
    return (
      <View style={styles.container} onLayout={onLayout}>
        {
          carLayout && width > 0
            ? (
                <CarPagedList
                  ref={pagedRef}
                  data={currentList}
                  itemHeight={carLayout.cellHeight}
                  numColumns={carLayout.cols}
                  keyExtractor={item => item.id}
                  onEndReached={handleLoadMore}
                  tipLabel={currentList.length ? carTip : null}
                  emptyComponent={<Text size={13} color={theme['c-font-label']}>{t('car_paged_list_empty')}</Text>}
                  renderItem={(item, index) => (
                    <View style={{ width: carLayout.cellWidth, height: carLayout.cellHeight }}>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => { onOpenDetail(item, index) }}
                        style={{ width: carLayout.cover }}
                      >
                        <Image
                          url={item.img}
                          nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`}
                          style={{ width: carLayout.cover, height: carLayout.cover, borderRadius: 8, backgroundColor: theme['c-content-background'] }}
                        />
                        { showSource ? <Text style={styles.sourceLabel} size={9} color="#fff">{item.source}</Text> : null }
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.6} onPress={() => { onOpenDetail(item, index) }}>
                        <Text
                          style={{
                            width: carLayout.cover,
                            height: carLayout.titleHeight - scaleSizeH(6),
                            lineHeight: carLayout.lineHeight,
                            marginTop: scaleSizeH(6) / 2,
                          }}
                          size={12}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >{item.name}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )
            : null
        }
      </View>
    )
  }

  // console.log(rowNum)

  return (
    <View style={styles.container} onLayout={onLayout}>
      {
        width == 0
          ? null
          : (
              <FlatList
                key={String(rowInfo.num)}
                ref={flatListRef}
                style={styles.list}
                columnWrapperStyle={{ justifyContent: 'space-evenly' }}
                numColumns={rowInfo.num}
                data={list}
                maxToRenderPerBatch={4}
                // updateCellsBatchingPeriod={80}
                windowSize={8}
                removeClippedSubviews={true}
                // initialNumToRender={12}
                renderItem={renderItem}
                keyExtractor={getkey}
                // getItemLayout={getItemLayout}
                // onRefresh={onRefresh}
                // refreshing={refreshing}
                onEndReachedThreshold={0.6}
                onEndReached={handleLoadMore}
                refreshControl={refreshControl}
                ListFooterComponent={footerComponent}
              />
            )
      }
    </View>
  )
})

type FooterLabel = 'list_loading' | 'list_end' | 'list_error' | null
const Footer = ({ label, onLoadMore }: {
  label: FooterLabel
  onLoadMore: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const handlePress = () => {
    if (label != 'list_error') return
    onLoadMore()
  }
  return (
    label
      ? (
          <View>
            <Text onPress={handlePress} style={styles.footer} color={theme['c-font-label']}>{t(label)}</Text>
          </View>
        )
      : null
  )
}


const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
  footer: {
    textAlign: 'center',
    padding: 10,
  },
  // 【改造】车机模式下封面右上角的来源标签
  sourceLabel: {
    paddingLeft: 5,
    paddingBottom: 2,
    paddingRight: 5,
    position: 'absolute',
    top: 0,
    right: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
})
